import {
  Metadata,
  StreamMessage,
  MessageType,
  CommandType,
  ChatPayload,
  CommandPayload,
  CommandResponsePayload,
  EventPayload,
  SystemEventType,
  UIMessage,
  ParticipantInfo,
  ChatResponsePayload,
} from '../types/streamingProvider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function log(...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]`, ...args);
}

// Shared message encoding utilities
export function createCommandMessage(cmd: CommandType, data?: Metadata): StreamMessage {
  return {
    v: 2,
    type: MessageType.COMMAND,
    mid: `msg-${Date.now()}`,
    pld: {
      cmd,
      data,
    },
  };
}

export function createChatMessage(messageId: string, text: string, idx?: number, fin?: boolean): StreamMessage {
  return {
    v: 2,
    type: MessageType.CHAT,
    mid: messageId,
    idx,
    fin,
    pld: {
      text,
    },
  };
}

// Message chunk reassembly storage
const messageChunks = new Map<string, { chunks: Map<number, string>; totalChunks?: number }>();

// Shared message validation and chunking reassembly
export function validateStreamMessage(msg: string): { valid: boolean; parsed?: StreamMessage; error?: string } {
  try {
    const parsed = JSON.parse(msg) as StreamMessage;
    if (parsed.v !== 2) {
      return { valid: false, error: `unsupported message version, v=${parsed.v}` };
    }
    return { valid: true, parsed };
  } catch (error) {
    return { valid: false, error: `failed to parse message: ${error}` };
  }
}

// Shared message processing utilities
export function processStreamMessage(
  streamMessage: StreamMessage,
  uid: string,
  handlers: {
    onCommandResponse?: (
      cmd: CommandType,
      code: number,
      msg: string | undefined,
      messageId: string,
      uid: string,
    ) => void;
    onCommandSend?: (
      cmd: CommandType,
      data: Record<string, unknown> | undefined,
      messageId: string,
      uid: string,
    ) => void;
    onChatMessage?: (text: string, from: string | undefined, messageId: string, uid: string) => void;
    onEventMessage?: (event: string, messageId: string, uid: string, eventData?: Record<string, unknown>) => void;
  },
) {
  const { type, mid: messageId, pld } = streamMessage;

  try {
    if (type === MessageType.COMMAND) {
      const { cmd, code, msg: cmdMsg } = pld as CommandResponsePayload;

      if (code !== undefined) {
        // This is a command acknowledgment
        handlers.onCommandResponse?.(cmd, code, cmdMsg, messageId, uid);
      } else {
        // This is a command being sent (shouldn't happen in responses, but handle gracefully)
        const { data } = pld as CommandPayload;
        handlers.onCommandSend?.(cmd, data as Record<string, unknown> | undefined, messageId, uid);
      }
    } else if (type === MessageType.CHAT) {
      const { text, from } = pld as ChatPayload;
      handlers.onChatMessage?.(text, from, messageId, uid);
    } else if (type === MessageType.EVENT) {
      const { event, data } = pld as EventPayload;
      handlers.onEventMessage?.(event, messageId, uid, data);
    }
  } catch (error) {
    log('Failed to process stream message:', error);
    throw error;
  }
}

// Process message chunks for progressive display
export function processMessageChunk(streamMessage: StreamMessage): {
  message: StreamMessage;
  isFirstChunk: boolean;
  isComplete: boolean;
} | null {
  // If this is not a chunked message, return immediately as complete
  if (streamMessage.idx === undefined || streamMessage.fin === undefined) {
    return {
      message: streamMessage,
      isFirstChunk: true,
      isComplete: true,
    };
  }

  // Handle chunked chat messages only - other types return immediately
  if (streamMessage.type !== MessageType.CHAT) {
    return {
      message: streamMessage,
      isFirstChunk: true,
      isComplete: true,
    };
  }

  // Handle chunked messages
  const messageId = streamMessage.mid;
  const isFirstChunk = streamMessage.idx === 0;

  if (!messageChunks.has(messageId)) {
    messageChunks.set(messageId, { chunks: new Map() });
  }

  const messageData = messageChunks.get(messageId)!;
  const chatPayload = streamMessage.pld as ChatPayload;
  const chunkText = chatPayload.text || '';
  messageData.chunks.set(streamMessage.idx, chunkText);

  // If this is the final chunk, mark as complete
  let isComplete = false;
  if (streamMessage.fin) {
    messageData.totalChunks = streamMessage.idx + 1;
    isComplete = true;
  }

  // For progressive display, return the current chunk immediately
  // The UI will append subsequent chunks to the existing message
  const result = {
    message: {
      ...streamMessage,
      pld: {
        ...streamMessage.pld,
        text: chunkText,
      },
    },
    isFirstChunk,
    isComplete,
  };

  // Clean up if message is complete
  if (isComplete) {
    messageChunks.delete(messageId);
    log(`Message chunking completed for ${messageId} with ${messageData.totalChunks} chunks`);
  }

  return result;
}

// Shared chunking utilities for chat messages
export const MESSAGE_CONSTANTS = {
  MAX_ENCODED_SIZE: 950,
  BYTES_PER_SECOND: 6000,
} as const;

export function encodeMessage(text: string, messageId: string, idx: number, fin: boolean): Uint8Array {
  const message = createChatMessage(messageId, text, idx, fin);
  return new TextEncoder().encode(JSON.stringify(message));
}

export function calculateMaxContentLength(): number {
  const baseEncoded = encodeMessage('', 'test', 0, false);
  return Math.floor((MESSAGE_CONSTANTS.MAX_ENCODED_SIZE - baseEncoded.length) / 4);
}

export function splitMessageIntoChunks(content: string, messageId: string): string[] {
  if (!content) {
    throw new Error('Content cannot be empty');
  }

  const maxQuestionLength = calculateMaxContentLength();
  const chunks: string[] = [];
  let remainingMessage = content;
  let chunkIndex = 0;

  while (remainingMessage.length > 0) {
    let chunk = remainingMessage.slice(0, maxQuestionLength);
    let encoded = encodeMessage(chunk, messageId, chunkIndex, false);

    // Binary search for optimal chunk size if needed
    while (encoded.length > MESSAGE_CONSTANTS.MAX_ENCODED_SIZE && chunk.length > 1) {
      chunk = chunk.slice(0, Math.ceil(chunk.length / 2));
      encoded = encodeMessage(chunk, messageId, chunkIndex, false);
    }

    if (encoded.length > MESSAGE_CONSTANTS.MAX_ENCODED_SIZE) {
      throw new Error('Message encoding failed: content too large for chunking');
    }

    chunks.push(chunk);
    remainingMessage = remainingMessage.slice(chunk.length);
    chunkIndex++;
  }

  log(`Splitting message into ${chunks.length} chunks`);
  return chunks;
}

// Shared retry logic
export async function withRetry<T>(
  operation: () => Promise<T> | T,
  checkCondition: () => boolean,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    operationName?: string;
    getDebugInfo?: () => Record<string, unknown>;
  } = {},
): Promise<T | null> {
  const { maxRetries = 5, retryDelay = 200, operationName = 'operation', getDebugInfo = () => ({}) } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (checkCondition()) {
      return await operation();
    }

    if (attempt === maxRetries - 1) {
      console.warn(`Cannot execute ${operationName}: condition not met after retries`, {
        ...getDebugInfo(),
        attempt: attempt + 1,
      });
      return null;
    }

    // Wait before next retry
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }

  return null;
}

// Rate limiting utility
export async function rateLimit(chunkSize: number, startTime: number): Promise<void> {
  const minimumTimeMs = Math.ceil((1000 * chunkSize) / MESSAGE_CONSTANTS.BYTES_PER_SECOND);
  const elapsedMs = Date.now() - startTime;
  const remainingDelay = Math.max(0, minimumTimeMs - elapsedMs);

  if (remainingDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingDelay));
  }
}

// Time formatting utilities for UI
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function shouldShowTimeSeparator(currentMessage: UIMessage, previousMessage: UIMessage | undefined): boolean {
  if (!previousMessage) return false;
  const timeDiff = currentMessage.timestamp - previousMessage.timestamp;

  // Show separator if gap is more than 30 seconds
  if (timeDiff > 30000) return true;

  // Show separator every 5 minutes (300000 ms) regardless of gap
  const currentMinute = Math.floor(currentMessage.timestamp / 300000);
  const previousMinute = Math.floor(previousMessage.timestamp / 300000);

  return currentMinute > previousMinute;
}

// Message formatting utilities
export interface MessageFormattingHandlers {
  onSystemMessage?: (messageId: string, text: string, systemType: string, metadata?: Record<string, unknown>) => void;
  onStreamMessage?: (
    text: string,
    from: ParticipantInfo,
    responsePayload: ChatResponsePayload,
    messageId: string,
  ) => void;
  onAudioStateChange?: (isSpeaking: boolean) => void;
}

export function formatCommandResponse(
  cmd: CommandType,
  code: number,
  msg: string | undefined,
  messageId: string,
  uid: string,
  handlers: MessageFormattingHandlers,
) {
  log(`cmd-response, cmd=${cmd}, code=${code}, msg=${msg}`);

  const status = code === 1000 ? '✅' : '❌';
  const statusText = code === 1000 ? 'Success' : 'Failed';
  const responseText = `${status} ${cmd}: ${statusText}${msg ? ` (${msg})` : ''}`;
  const systemType = cmd === CommandType.INTERRUPT ? SystemEventType.INTERRUPT_ACK : SystemEventType.SET_PARAMS_ACK;

  handlers.onSystemMessage?.(`cmd_ack_${messageId}`, responseText, systemType, { uid });
}

export function formatCommandSend(
  cmd: CommandType,
  data: Record<string, unknown> | undefined,
  messageId: string,
  uid: string,
  handlers: MessageFormattingHandlers,
) {
  const dataStr = data ? ` with data: ${JSON.stringify(data)}` : '';
  const systemType = cmd === CommandType.INTERRUPT ? SystemEventType.INTERRUPT : SystemEventType.SET_PARAMS;
  const messageText = cmd === CommandType.SET_PARAMS && data ? `📤 ${cmd}${dataStr} ℹ️` : `📤 ${cmd}${dataStr}`;
  const metadata = cmd === CommandType.SET_PARAMS && data ? { fullParams: data } : undefined;

  handlers.onSystemMessage?.(`cmd_send_${messageId}`, messageText, systemType, { uid, ...metadata });
}

export function formatChatMessage(
  text: string,
  from: string | undefined,
  messageId: string,
  uid: string,
  handlers: MessageFormattingHandlers,
) {
  const responsePayload: ChatResponsePayload = {
    text,
    from: (from === 'bot' ? 'bot' : 'user') as 'bot' | 'user', // Preserve original from: 'bot' = avatar response, 'user' = STT result
  };

  // Ensure avatar responses get unique message IDs to avoid appending to user messages
  const finalMessageId = `reply_${messageId}`;

  handlers.onStreamMessage?.(
    text,
    {
      uid,
      identity: uid.toString(),
    },
    responsePayload,
    finalMessageId,
  );
}

export function formatEventMessage(
  event: string,
  messageId: string,
  uid: string,
  eventData: Record<string, unknown> | undefined,
  handlers: MessageFormattingHandlers,
) {
  log(`event, event=${event}`);

  if (event === 'audio_start') {
    handlers.onSystemMessage?.(`event_${messageId}`, '🎤 Avatar started speaking', SystemEventType.AVATAR_AUDIO_START, {
      uid,
    });
    // Update speaking state
    handlers.onAudioStateChange?.(true);
  } else if (event === 'audio_end') {
    handlers.onSystemMessage?.(`event_${messageId}`, '✅ Avatar finished speaking', SystemEventType.AVATAR_AUDIO_END, {
      uid,
    });
    // Update speaking state
    handlers.onAudioStateChange?.(false);
  } else {
    // Handle other events generically
    handlers.onSystemMessage?.(`event_${messageId}`, `📋 Event: ${event}`, 'event', { uid, eventData });
  }
}
