import { Room } from 'livekit-client';
import {
  Metadata,
  CommandPayload,
  ChatPayload,
  StreamMessage,
  MessageType,
  CommandType,
} from './types/streamingProvider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function log(...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]`, ...args);
}

// Helper function to check if room is ready to send messages
export function isRoomReady(room: Room): boolean {
  return room.state === 'connected' && 
         room.localParticipant.identity !== undefined &&
         room.localParticipant.identity !== '';
}

export async function setAvatarParams(
  room: Room,
  meta: Metadata,
  onCommandSend?: (cmd: CommandType, data?: Record<string, unknown>) => void,
) {
  // Wait for room to be fully ready with retry logic
  const maxRetries = 5;
  const retryDelay = 200; // 200ms between retries
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (isRoomReady(room)) {
      break;
    }
    
    if (attempt === maxRetries - 1) {
      console.warn('Cannot send message: room not ready after retries', {
        roomState: room.state,
        identity: room.localParticipant.identity,
        attempt: attempt + 1,
      });
      return;
    }
    
    // Wait before next retry
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }

  // Remove empty or undefined values from meta
  const cleanedMeta = Object.fromEntries(Object.entries(meta).filter(([_, value]) => !!value));

  const message: StreamMessage = {
    v: 2,
    type: MessageType.COMMAND,
    mid: `msg-${Date.now()}`,
    pld: {
      cmd: CommandType.SET_PARAMS,
      data: cleanedMeta,
    },
  };

  const jsondata = JSON.stringify(message);
  log(`setAvatarParams, size=${jsondata.length}, data=${jsondata}`);

  // Notify about command being sent
  onCommandSend?.(CommandType.SET_PARAMS, cleanedMeta);

  try {
    // Use publishData with reliable delivery for commands to ensure delivery
    const encodedData = new TextEncoder().encode(jsondata);
    await room.localParticipant.publishData(encodedData, { reliable: true });
  } catch (error) {
    console.error('Failed to send avatar params:', error);
    throw error;
  }
}

export async function interruptResponse(
  room: Room,
  onCommandSend?: (cmd: CommandType, data?: Record<string, unknown>) => void,
) {
  // Wait for room to be fully ready with retry logic
  const maxRetries = 5;
  const retryDelay = 200; // 200ms between retries
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (isRoomReady(room)) {
      break;
    }
    
    if (attempt === maxRetries - 1) {
      console.warn('Cannot send interrupt: room not ready after retries', {
        roomState: room.state,
        identity: room.localParticipant.identity,
        attempt: attempt + 1,
      });
      return;
    }
    
    // Wait before next retry
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }

  const message: StreamMessage = {
    v: 2,
    type: MessageType.COMMAND,
    mid: `msg-${Date.now()}`,
    pld: {
      cmd: CommandType.INTERRUPT,
    },
  };

  const jsondata = JSON.stringify(message);
  log(`interruptResponse, size=${jsondata.length}, data=${jsondata}`);

  // Notify about command being sent
  onCommandSend?.(CommandType.INTERRUPT);

  try {
    // Use publishData with reliable delivery for commands to ensure delivery
    const encodedData = new TextEncoder().encode(jsondata);
    await room.localParticipant.publishData(encodedData, { reliable: true });
  } catch (error) {
    console.error('Failed to send interrupt command:', error);
    throw error;
  }
}

export async function sendMessageToAvatar(room: Room, messageId: string, content: string) {
  // Check if room is ready before sending data packet
  if (!isRoomReady(room)) {
    console.warn('Cannot send data packet: room not ready', {
      roomState: room.state,
      identity: room.localParticipant.identity,
    });
    throw new Error('Room not connected');
  }

  // Move constants to top level for better configuration
  const MAX_ENCODED_SIZE = 950; // Same as Agora for consistency
  const BYTES_PER_SECOND = 6000;

  // Improved message encoder with proper typing
  const encodeMessage = (text: string, idx: number, fin: boolean): Uint8Array => {
    const message: StreamMessage = {
      v: 2,
      type: MessageType.CHAT,
      mid: messageId,
      idx,
      fin,
      pld: {
        text,
      },
    };
    return new TextEncoder().encode(JSON.stringify(message));
  };

  // Validate inputs
  if (!content) {
    throw new Error('Content cannot be empty');
  }

  // Calculate maximum content length
  const baseEncoded = encodeMessage('', 0, false);
  const maxQuestionLength = Math.floor((MAX_ENCODED_SIZE - baseEncoded.length) / 4);

  // Split message into chunks
  const chunks: string[] = [];
  let remainingMessage = content;
  let chunkIndex = 0;

  while (remainingMessage.length > 0) {
    let chunk = remainingMessage.slice(0, maxQuestionLength);
    let encoded = encodeMessage(chunk, chunkIndex, false);

    // Binary search for optimal chunk size if needed
    while (encoded.length > MAX_ENCODED_SIZE && chunk.length > 1) {
      chunk = chunk.slice(0, Math.ceil(chunk.length / 2));
      encoded = encodeMessage(chunk, chunkIndex, false);
    }

    if (encoded.length > MAX_ENCODED_SIZE) {
      throw new Error('Message encoding failed: content too large for chunking');
    }

    chunks.push(chunk);
    remainingMessage = remainingMessage.slice(chunk.length);
    chunkIndex++;
  }

  log(`Splitting message into ${chunks.length} chunks`);

  // Send chunks with rate limiting
  for (let i = 0; i < chunks.length; i++) {
    const isLastChunk = i === chunks.length - 1;
    const encodedChunk = encodeMessage(chunks[i], i, isLastChunk);
    const chunkSize = encodedChunk.length;

    const minimumTimeMs = Math.ceil((1000 * chunkSize) / BYTES_PER_SECOND);
    const startTime = Date.now();

    log(`Sending chunk ${i + 1}/${chunks.length}, size=${chunkSize} bytes`);

    try {
      // Use publishData with lossy delivery for real-time performance
      await room.localParticipant.publishData(encodedChunk, { reliable: false });
    } catch (error: unknown) {
      throw new Error(`Failed to send chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!isLastChunk) {
      const elapsedMs = Date.now() - startTime;
      const remainingDelay = Math.max(0, minimumTimeMs - elapsedMs);
      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }
    }
  }
}

// Message chunk reassembly for data packets
const messageChunks = new Map<string, { chunks: Map<number, string>; totalChunks?: number }>();

// Helper function to process received data packet chunks
function processDataPacketChunk(data: Uint8Array, _participantInfo: { identity: string }): StreamMessage | null {
  try {
    const messageText = new TextDecoder().decode(data);
    const streamMessage = JSON.parse(messageText) as StreamMessage;
    
    // If this is not a chunked message, return immediately
    if (streamMessage.idx === undefined || streamMessage.fin === undefined) {
      return streamMessage;
    }
    
    // Handle chunked messages
    const messageId = streamMessage.mid;
    if (!messageChunks.has(messageId)) {
      messageChunks.set(messageId, { chunks: new Map() });
    }
    
    const messageData = messageChunks.get(messageId)!;
    messageData.chunks.set(streamMessage.idx, (streamMessage.pld as ChatPayload).text || '');
    
    // If this is the final chunk, reassemble the message
    if (streamMessage.fin) {
      messageData.totalChunks = streamMessage.idx + 1;
    }
    
    // Check if we have all chunks
    if (messageData.totalChunks !== undefined && messageData.chunks.size === messageData.totalChunks) {
      // Reassemble the complete message
      let completeText = '';
      for (let i = 0; i < messageData.totalChunks; i++) {
        const chunk = messageData.chunks.get(i);
        if (chunk !== undefined) {
          completeText += chunk;
        }
      }
      
      // Clean up stored chunks
      messageChunks.delete(messageId);
      
      // Return the complete message
      return {
        ...streamMessage,
        pld: {
          ...streamMessage.pld,
          text: completeText,
        },
      };
    }
    
    // Message is not complete yet
    return null;
  } catch (error) {
    console.error('Failed to process data packet chunk:', error);
    return null;
  }
}

// Helper function to register message handlers using data packets
export function registerMessageHandlers(
  room: Room,
  handlers: {
    onAvatarCommand?: (command: CommandPayload, from: { identity: string }) => void;
    onChatMessage?: (message: ChatPayload, from: { identity: string }) => void;
    onSystemMessage?: (message: string, from: { identity: string }) => void;
  },
) {
  // Register data packet handler to receive all messages
  const dataPacketHandler = (payload: Uint8Array, participant?: import('livekit-client').RemoteParticipant) => {
    try {
      const participantInfo = {
        identity: participant?.identity || 'unknown',
      };

      const streamMessage = processDataPacketChunk(payload, participantInfo);
      
      // Only process complete messages (not partial chunks)
      if (!streamMessage) {
        return;
      }

      if (streamMessage.type === MessageType.COMMAND) {
        // Try to parse as structured command first
        try {
          handlers.onAvatarCommand?.(streamMessage.pld as CommandPayload, participantInfo);
        } catch {
          // If parsing fails, treat as plain text system message
          const messageText = new TextDecoder().decode(payload);
          handlers.onSystemMessage?.(messageText, participantInfo);
        }
      } else if (streamMessage.type === MessageType.CHAT) {
        handlers.onChatMessage?.(streamMessage.pld as ChatPayload, participantInfo);
      }
    } catch (error) {
      console.error('Failed to parse data packet:', error);
      
      // Fallback: try to parse as plain text system message
      try {
        const messageText = new TextDecoder().decode(payload);
        const participantInfo = {
          identity: participant?.identity || 'unknown',
        };
        handlers.onSystemMessage?.(messageText, participantInfo);
      } catch {
        // Ignore if we can't even decode as text
      }
    }
  };

  // Remove existing handler if any and add new one
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  room.off('dataReceived', dataPacketHandler as any);
  room.on('dataReceived', dataPacketHandler);
  
  log('Data packet handlers registered for all message types');
}

// Helper function to unregister all message handlers
export function unregisterMessageHandlers(room: Room) {
  try {
    // Remove all data packet handlers
    // Using removeAllListeners to remove all handlers for the event
    room.removeAllListeners('dataReceived');
    log('Data packet handlers unregistered');
  } catch (error) {
    console.error('Failed to unregister message handlers:', error);
  }
}
