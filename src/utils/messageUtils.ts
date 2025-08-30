import {
  Metadata,
  StreamMessage,
  MessageType,
  CommandType,
  ChatPayload,
  CommandPayload,
  CommandResponsePayload,
  EventPayload,
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
