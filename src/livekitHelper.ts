import { Room } from 'livekit-client';
import { Metadata, CommandPayload, ChatPayload, StreamMessage } from './types/streamingProvider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function log(...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]`, ...args);
}

// Message topics for LiveKit text streams
export const MESSAGE_TOPICS = {
  AVATAR_COMMAND: 'avatar-command',
  CHAT_MESSAGE: 'chat-message',
  SYSTEM_MESSAGE: 'system-message',
} as const;

// Helper function to check if room is ready to send messages
export function isRoomReady(room: Room): boolean {
  return room.state === 'connected' && room.localParticipant.identity !== undefined;
}

export async function setAvatarParams(
  room: Room,
  meta: Metadata,
  onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void,
) {
  // Check if room is connected before sending message
  if (!isRoomReady(room)) {
    console.warn('Cannot send message: room not ready', {
      roomState: room.state,
      identity: room.localParticipant.identity,
    });
    return;
  }

  // Remove empty or undefined values from meta
  const cleanedMeta = Object.fromEntries(Object.entries(meta).filter(([_, value]) => !!value));

  const message: StreamMessage = {
    v: 2,
    type: 'command',
    mid: `msg-${Date.now()}`,
    pld: {
      cmd: 'set-params',
      data: cleanedMeta,
    },
  };

  const jsondata = JSON.stringify(message);
  log(`setAvatarParams, size=${jsondata.length}, data=${jsondata}`);

  // Notify about command being sent
  onCommandSend?.('set-params', cleanedMeta);

  try {
    await room.localParticipant.sendText(jsondata, {
      topic: MESSAGE_TOPICS.AVATAR_COMMAND,
    });
  } catch (error) {
    console.error('Failed to send avatar params:', error);
    throw error;
  }
}

export async function interruptResponse(
  room: Room,
  onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void,
) {
  // Check if room is connected before sending message
  if (!isRoomReady(room)) {
    console.warn('Cannot send message: room not ready', {
      roomState: room.state,
      identity: room.localParticipant.identity,
    });
    return;
  }

  const message: StreamMessage = {
    v: 2,
    type: 'command',
    mid: `msg-${Date.now()}`,
    pld: {
      cmd: 'interrupt',
    },
  };

  const jsondata = JSON.stringify(message);
  log(`interruptResponse, size=${jsondata.length}, data=${jsondata}`);

  // Notify about command being sent
  onCommandSend?.('interrupt');

  try {
    await room.localParticipant.sendText(jsondata, {
      topic: MESSAGE_TOPICS.AVATAR_COMMAND,
    });
  } catch (error) {
    console.error('Failed to send interrupt command:', error);
    throw error;
  }
}

export async function sendMessageToAvatar(room: Room, messageId: string, content: string) {
  // Check if room is connected before sending message
  if (!isRoomReady(room)) {
    console.warn('Cannot send message: room not ready', {
      roomState: room.state,
      identity: room.localParticipant.identity,
    });
    throw new Error('Room not connected');
  }

  // Validate inputs
  if (!content) {
    throw new Error('Content cannot be empty');
  }

  const message: StreamMessage = {
    v: 2,
    type: 'chat',
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
      topic: MESSAGE_TOPICS.CHAT_MESSAGE,
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
  if (!isRoomReady(room)) {
    console.warn('Cannot send streaming message: room not ready', {
      roomState: room.state,
      identity: room.localParticipant.identity,
    });
    throw new Error('Room not connected');
  }

  log(`sendStreamingMessageToAvatar, messageId=${messageId}`);

  try {
    const streamWriter = await room.localParticipant.streamText({
      topic: MESSAGE_TOPICS.CHAT_MESSAGE,
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
  // Register handler for avatar commands
  if (handlers.onAvatarCommand) {
    room.registerTextStreamHandler(MESSAGE_TOPICS.AVATAR_COMMAND, async (reader, participantInfo) => {
      try {
        const messageText = await reader.readAll();
        const streamMessage = JSON.parse(messageText) as StreamMessage;

        if (streamMessage.type === 'command') {
          handlers.onAvatarCommand?.(streamMessage.pld as CommandPayload, participantInfo);
        }
      } catch (error) {
        console.error('Failed to parse avatar command:', error);
      }
    });
  }

  // Register handler for chat messages
  if (handlers.onChatMessage) {
    room.registerTextStreamHandler(MESSAGE_TOPICS.CHAT_MESSAGE, async (reader, participantInfo) => {
      try {
        // Check if this is a streaming message or complete message
        const info = reader.info;

        if (info.size !== undefined) {
          // Complete message - read all at once
          const messageText = await reader.readAll();
          const streamMessage = JSON.parse(messageText) as StreamMessage;

          if (streamMessage.type === 'chat') {
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
            if (streamMessage.type === 'chat') {
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
  }

  // Register handler for system messages
  if (handlers.onSystemMessage) {
    room.registerTextStreamHandler(MESSAGE_TOPICS.SYSTEM_MESSAGE, async (reader, participantInfo) => {
      try {
        const messageText = await reader.readAll();
        handlers.onSystemMessage?.(messageText, participantInfo);
      } catch (error) {
        console.error('Failed to parse system message:', error);
      }
    });
  }
}

// Helper function to unregister all message handlers
export function unregisterMessageHandlers(room: Room) {
  // LiveKit will automatically clean up handlers when room disconnects,
  // but we can explicitly remove them if needed
  try {
    // Note: LiveKit doesn't provide a direct way to unregister specific handlers,
    // so we rely on room cleanup
    log('Message handlers will be cleaned up on room disconnect');
  } catch (error) {
    console.error('Failed to unregister message handlers:', error);
  }
}
