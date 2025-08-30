import { RemoteParticipant, Room } from 'livekit-client';
import {
  Metadata,
  CommandPayload,
  ChatPayload,
  EventPayload,
  MessageType,
  CommandType,
} from './types/streamingProvider';
import {
  log,
  createCommandMessage,
  splitMessageIntoChunks,
  encodeMessage,
  withRetry,
  rateLimit,
  validateStreamMessage,
  processMessageChunk,
} from './utils/messageUtils';

// Helper function to check if room is ready to send messages
export function isRoomReady(room: Room): boolean {
  return (
    room.state === 'connected' && room.localParticipant.identity !== undefined && room.localParticipant.identity !== ''
  );
}

export async function setAvatarParams(
  room: Room,
  meta: Metadata,
  onCommandSend?: (cmd: CommandType, data?: Record<string, unknown>) => void,
) {
  return withRetry(
    async () => {
      // Remove empty or undefined values from meta
      const cleanedMeta = Object.fromEntries(Object.entries(meta).filter(([_, value]) => !!value));

      const message = createCommandMessage(CommandType.SET_PARAMS, cleanedMeta);
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
    },
    () => isRoomReady(room),
    {
      operationName: 'setAvatarParams',
      getDebugInfo: () => ({
        roomState: room.state,
        identity: room.localParticipant.identity,
      }),
    },
  );
}

export async function interruptResponse(
  room: Room,
  onCommandSend?: (cmd: CommandType, data?: Record<string, unknown>) => void,
) {
  return withRetry(
    async () => {
      const message = createCommandMessage(CommandType.INTERRUPT);
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
    },
    () => isRoomReady(room),
    {
      operationName: 'interruptResponse',
      getDebugInfo: () => ({
        roomState: room.state,
        identity: room.localParticipant.identity,
      }),
    },
  );
}

export async function sendMessageToAvatar(room: Room, messageId: string, content: string) {
  return withRetry(
    async () => {
      const chunks = splitMessageIntoChunks(content, messageId);

      // Send chunks with rate limiting
      for (let i = 0; i < chunks.length; i++) {
        const isLastChunk = i === chunks.length - 1;
        const encodedChunk = encodeMessage(chunks[i], messageId, i, isLastChunk);
        const chunkSize = encodedChunk.length;
        const startTime = Date.now();

        log(`Sending chunk ${i + 1}/${chunks.length}, size=${chunkSize} bytes`);

        try {
          // Use publishData with lossy delivery for real-time performance
          await room.localParticipant.publishData(encodedChunk, { reliable: false });
        } catch (error: unknown) {
          throw new Error(`Failed to send chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        if (!isLastChunk) {
          await rateLimit(chunkSize, startTime);
        }
      }
    },
    () => isRoomReady(room),
    {
      operationName: 'sendMessageToAvatar',
      getDebugInfo: () => ({
        roomState: room.state,
        identity: room.localParticipant.identity,
      }),
    },
  );
}

// Simplified message processing aligned with Agora approach

// Helper function to register message handlers using data packets - aligned with Agora approach
export function registerMessageHandlers(
  room: Room,
  handlers: {
    onAvatarCommand?: (command: CommandPayload, from: { identity: string }) => void;
    onChatMessage?: (message: ChatPayload, from: { identity: string; uid?: string; messageId?: string }) => void;
    onEventMessage?: (event: EventPayload, from: { identity: string }) => void;
    onSystemMessage?: (message: string, from: { identity: string }) => void;
  },
) {
  // Register data packet handler to receive all messages - with chunking support
  const dataPacketHandler = (payload: Uint8Array, participant?: RemoteParticipant) => {
    const msg = new TextDecoder().decode(payload);
    log(`data-packet, identity=${participant?.identity || 'unknown'}, size=${payload.length}, msg=${msg}`);

    const validation = validateStreamMessage(msg);
    if (!validation.valid) {
      log(validation.error);
      // Fallback: try to parse as plain text system message
      const participantInfo = { identity: participant?.identity || 'unknown' };
      handlers.onSystemMessage?.(msg, participantInfo);
      return;
    }

    const streamMessage = validation.parsed!;
    const participantInfo = { identity: participant?.identity || 'unknown' };

    // Process chunked messages for progressive display
    const chunkResult = processMessageChunk(streamMessage);
    if (!chunkResult) {
      // Invalid chunk, ignore
      return;
    }

    const { message } = chunkResult;
    const { type, pld } = message;

    if (type === MessageType.COMMAND) {
      try {
        handlers.onAvatarCommand?.(pld as CommandPayload, participantInfo);
      } catch {
        // If parsing fails, treat as plain text system message
        handlers.onSystemMessage?.(msg, participantInfo);
      }
    } else if (type === MessageType.CHAT) {
      // For chat messages, we want progressive display
      // Use the original mid as message ID for consistency across chunks
      const chatPayload = pld as ChatPayload;
      // Pass mid as messageId for chunk merging
      const participantWithMessageId = {
        ...participantInfo,
        messageId: message.mid, // Pass mid as messageId for chunking
      };
      handlers.onChatMessage?.(chatPayload, participantWithMessageId);
    } else if (type === MessageType.EVENT) {
      handlers.onEventMessage?.(pld as EventPayload, participantInfo);
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
