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
    await room.localParticipant.sendText(jsondata, {
      topic: MessageType.COMMAND,
    });
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
    await room.localParticipant.sendText(jsondata, {
      topic: MessageType.COMMAND,
    });
  } catch (error) {
    console.error('Failed to send interrupt command:', error);
    throw error;
  }
}

export async function sendMessageToAvatar(room: Room, messageId: string, content: string) {
  // Wait for room to be fully ready with retry logic
  const maxRetries = 3; // Fewer retries for chat messages
  const retryDelay = 100; // Shorter delay for chat
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (isRoomReady(room)) {
      break;
    }
    
    if (attempt === maxRetries - 1) {
      console.warn('Cannot send chat message: room not ready after retries', {
        roomState: room.state,
        identity: room.localParticipant.identity,
        attempt: attempt + 1,
      });
      throw new Error('Room not connected');
    }
    
    // Wait before next retry
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }

  // Validate inputs
  if (!content) {
    throw new Error('Content cannot be empty');
  }

  const message: StreamMessage = {
    v: 2,
    type: MessageType.CHAT,
    mid: messageId,
    pld: {
      text: content,
    },
  };

  const jsondata = JSON.stringify(message);
  log(`sendMessageToAvatar, messageId=${messageId}, size=${jsondata.length}`);

  try {
    // LiveKit automatically handles chunking for large messages
    await room.localParticipant.sendText(jsondata, {
      topic: MessageType.CHAT,
    });
  } catch (error: unknown) {
    throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// New function for streaming messages (useful for AI responses)
export async function sendStreamingMessageToAvatar(
  room: Room,
  messageId: string,
  contentStream: AsyncIterable<string>,
) {
  // Wait for room to be fully ready with retry logic
  const maxRetries = 3; // Fewer retries for streaming messages
  const retryDelay = 100; // Shorter delay for streaming
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (isRoomReady(room)) {
      break;
    }
    
    if (attempt === maxRetries - 1) {
      console.warn('Cannot send streaming message: room not ready after retries', {
        roomState: room.state,
        identity: room.localParticipant.identity,
        attempt: attempt + 1,
      });
      throw new Error('Room not connected');
    }
    
    // Wait before next retry
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }

  log(`sendStreamingMessageToAvatar, messageId=${messageId}`);

  try {
    const streamWriter = await room.localParticipant.streamText({
      topic: MessageType.CHAT,
      attributes: { messageId }, // Include messageId in attributes
    });

    for await (const chunk of contentStream) {
      await streamWriter.write(chunk);
    }

    await streamWriter.close();
    log(`Completed streaming message, messageId=${messageId}`);
  } catch (error: unknown) {
    throw new Error(`Failed to send streaming message: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to register message handlers
export function registerMessageHandlers(
  room: Room,
  handlers: {
    onAvatarCommand?: (command: CommandPayload, from: { identity: string }) => void;
    onChatMessage?: (message: ChatPayload, from: { identity: string }) => void;
    onSystemMessage?: (message: string, from: { identity: string }) => void;
  },
) {
  // Register unified handler for all command messages (avatar commands and system messages)
  if (handlers.onAvatarCommand || handlers.onSystemMessage) {
    try {
      room.registerTextStreamHandler(MessageType.COMMAND, async (reader, participantInfo) => {
        try {
          const messageText = await reader.readAll();
          
          // Try to parse as JSON first (structured command)
          try {
            const streamMessage = JSON.parse(messageText) as StreamMessage;
            if (streamMessage.type === MessageType.COMMAND) {
              handlers.onAvatarCommand?.(streamMessage.pld as CommandPayload, participantInfo);
            }
          } catch {
            // If JSON parsing fails, treat as plain text system message
            handlers.onSystemMessage?.(messageText, participantInfo);
          }
        } catch (error) {
          console.error('Failed to parse command message:', error);
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already been set')) {
        log('Command handler already registered, skipping...');
      } else {
        throw error; // Re-throw if it's a different error
      }
    }
  }

  // Register handler for chat messages
  if (handlers.onChatMessage) {
    try {
      room.registerTextStreamHandler(MessageType.CHAT, async (reader, participantInfo) => {
        try {
          // Check if this is a streaming message or complete message
          const info = reader.info;

          if (info.size !== undefined) {
            // Complete message - read all at once
            const messageText = await reader.readAll();
            const streamMessage = JSON.parse(messageText) as StreamMessage;

            if (streamMessage.type === MessageType.CHAT) {
              handlers.onChatMessage?.(streamMessage.pld as ChatPayload, participantInfo);
            }
          } else {
            // Streaming message - read incrementally
            let fullMessage = '';
            for await (const chunk of reader) {
              fullMessage += chunk;
              // You could emit partial updates here if needed
            }

            // Process complete streamed message
            try {
              const streamMessage = JSON.parse(fullMessage) as StreamMessage;
              if (streamMessage.type === MessageType.CHAT) {
                handlers.onChatMessage?.(streamMessage.pld as ChatPayload, participantInfo);
              }
            } catch {
              // If not JSON, treat as plain text
              handlers.onChatMessage?.({ text: fullMessage }, participantInfo);
            }
          }
        } catch (error) {
          console.error('Failed to parse chat message:', error);
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already been set')) {
        log('Chat handler already registered, skipping...');
      } else {
        throw error; // Re-throw if it's a different error
      }
    }
  }
}

// Helper function to unregister all message handlers
export function unregisterMessageHandlers(room: Room) {
  // LiveKit will automatically clean up handlers when room disconnects,
  // but we can explicitly remove them if needed
  try {
    // Note: LiveKit doesn't provide a direct way to unregister specific handlers,
    // so we rely on room cleanup. The handlers will be cleaned up when the room disconnects.
    log('Message handlers will be cleaned up on room disconnect');
    
    // If the room is still connected, we can't unregister individual handlers,
    // but we can note that they should be cleaned up on next connect
    if (room.state === 'connected' || room.state === 'connecting') {
      log('Room is still active, handlers will persist until disconnect');
    }
  } catch (error) {
    console.error('Failed to unregister message handlers:', error);
  }
}
