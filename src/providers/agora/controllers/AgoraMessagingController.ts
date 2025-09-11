import { RTCClient } from '../../../agoraHelper';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { AvatarMetadata } from '../../../types/api.schemas';

export interface StreamMessage {
  v: number;
  type: string;
  mid?: string;
  idx?: number;
  fin?: boolean;
  pld: CommandPayload | ChatPayload | CommandResponsePayload | ChatResponsePayload;
}

export interface CommandPayload {
  cmd: string;
  data?: Record<string, unknown>;
}

export interface ChatPayload {
  text: string;
  meta?: Record<string, unknown>;
}

export interface CommandResponsePayload {
  cmd: string;
  code: number;
  msg?: string;
}

export interface ChatResponsePayload {
  text: string;
  from: 'bot' | 'user';
}

export interface MessagingEventCallbacks {
  onCommandSent?: (cmd: string, data?: Record<string, unknown>) => void;
  onCommandResponse?: (cmd: string, code: number, message?: string) => void;
  onMessageResponse?: (response: ChatResponsePayload) => void;
}

export class AgoraMessagingController {
  private client: RTCClient;
  private callbacks: MessagingEventCallbacks = {};

  // Constants for message size limits
  private static readonly MAX_ENCODED_SIZE = 950;
  private static readonly BYTES_PER_SECOND = 6000;

  constructor(client: RTCClient) {
    this.client = client;
  }

  setCallbacks(callbacks: MessagingEventCallbacks): void {
    this.callbacks = callbacks;
  }

  async setAvatarParameters(metadata: AvatarMetadata): Promise<void> {
    try {
      logger.info('Setting avatar parameters', { metadata });

      if (!this.isClientReady()) {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Client not ready for sending messages', {
          details: { connectionState: this.client.connectionState, uid: this.client.uid },
        });
      }

      // Remove empty or undefined values from metadata
      const cleanedMeta = Object.fromEntries(
        Object.entries(metadata).filter(([_, value]) => value !== undefined && value !== null && value !== ''),
      );

      const message: StreamMessage = {
        v: 2,
        type: 'command',
        mid: `msg-${Date.now()}`,
        pld: {
          cmd: 'set-params',
          data: cleanedMeta,
        },
      };

      const jsonData = JSON.stringify(message);
      logger.debug('Sending avatar parameters', {
        messageSize: jsonData.length,
        cleanedParameters: cleanedMeta,
      });

      await this.client.sendStreamMessage(jsonData, false);

      // Notify callback about command being sent
      this.callbacks.onCommandSent?.('set-params', cleanedMeta);
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to set avatar parameters', {
        error: streamingError.message,
        metadata,
      });
      throw streamingError;
    }
  }

  async interruptResponse(): Promise<void> {
    try {
      logger.info('Sending interrupt command');

      if (!this.isClientReady()) {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Client not ready for sending messages', {
          details: { connectionState: this.client.connectionState, uid: this.client.uid },
        });
      }

      const message: StreamMessage = {
        v: 2,
        type: 'command',
        mid: `msg-${Date.now()}`,
        pld: {
          cmd: 'interrupt',
        },
      };

      const jsonData = JSON.stringify(message);
      logger.debug('Sending interrupt command', { messageSize: jsonData.length });

      await this.client.sendStreamMessage(jsonData, false);

      // Notify callback about command being sent
      this.callbacks.onCommandSent?.('interrupt');
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to send interrupt command', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  async sendMessage(messageId: string, content: string): Promise<void> {
    try {
      logger.info('Sending message to avatar', { messageId, contentLength: content.length });

      if (!this.isClientReady()) {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Client not ready for sending messages', {
          details: { connectionState: this.client.connectionState, uid: this.client.uid },
        });
      }

      if (!content) {
        throw new StreamingError(ErrorCode.INVALID_CONFIGURATION, 'Message content cannot be empty');
      }

      // Split message into chunks if necessary
      const chunks = this.splitMessageIntoChunks(content, messageId);
      logger.debug('Message split into chunks', {
        totalChunks: chunks.length,
        messageId,
      });

      // Send chunks with rate limiting
      await this.sendMessageChunks(chunks, messageId);
    } catch (error) {
      const streamingError = error instanceof StreamingError ? error : ErrorMapper.mapAgoraError(error);

      logger.error('Failed to send message', {
        error: streamingError.message,
        messageId,
        contentLength: content.length,
      });
      throw streamingError;
    }
  }

  private splitMessageIntoChunks(content: string, messageId: string): string[] {
    // Calculate maximum content length
    const baseEncoded = this.encodeMessage('', 0, false, messageId);
    const maxQuestionLength = Math.floor((AgoraMessagingController.MAX_ENCODED_SIZE - baseEncoded.length) / 4);

    const chunks: string[] = [];
    let remainingMessage = content;
    let chunkIndex = 0;

    while (remainingMessage.length > 0) {
      let chunk = remainingMessage.slice(0, maxQuestionLength);
      let encoded = this.encodeMessage(chunk, chunkIndex, false, messageId);

      // Binary search for optimal chunk size if needed
      while (encoded.length > AgoraMessagingController.MAX_ENCODED_SIZE && chunk.length > 1) {
        chunk = chunk.slice(0, Math.ceil(chunk.length / 2));
        encoded = this.encodeMessage(chunk, chunkIndex, false, messageId);
      }

      if (encoded.length > AgoraMessagingController.MAX_ENCODED_SIZE) {
        throw new StreamingError(ErrorCode.INVALID_CONFIGURATION, 'Message content too large for chunking', {
          details: { chunkSize: encoded.length, maxSize: AgoraMessagingController.MAX_ENCODED_SIZE },
        });
      }

      chunks.push(chunk);
      remainingMessage = remainingMessage.slice(chunk.length);
      chunkIndex++;
    }

    return chunks;
  }

  private async sendMessageChunks(chunks: string[], messageId: string): Promise<void> {
    for (let i = 0; i < chunks.length; i++) {
      const isLastChunk = i === chunks.length - 1;
      const encodedChunk = this.encodeMessage(chunks[i], i, isLastChunk, messageId);
      const chunkSize = encodedChunk.length;

      const minimumTimeMs = Math.ceil((1000 * chunkSize) / AgoraMessagingController.BYTES_PER_SECOND);
      const startTime = Date.now();

      logger.debug('Sending message chunk', {
        chunkIndex: i + 1,
        totalChunks: chunks.length,
        chunkSize,
        isLastChunk,
        messageId,
      });

      try {
        await this.client.sendStreamMessage(encodedChunk, false);
      } catch (error) {
        throw new StreamingError(ErrorCode.API_REQUEST_FAILED, `Failed to send chunk ${i + 1}/${chunks.length}`, {
          details: { chunkIndex: i, messageId, originalError: error },
        });
      }

      // Rate limiting - wait if needed
      if (!isLastChunk) {
        const elapsedMs = Date.now() - startTime;
        const remainingDelay = Math.max(0, minimumTimeMs - elapsedMs);
        if (remainingDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingDelay));
        }
      }
    }
  }

  private encodeMessage(text: string, idx: number, fin: boolean, messageId: string): Uint8Array {
    const message: StreamMessage = {
      v: 2,
      type: 'chat',
      mid: messageId,
      idx,
      fin,
      pld: {
        text,
      },
    };
    return new TextEncoder().encode(JSON.stringify(message));
  }

  private isClientReady(): boolean {
    return this.client.connectionState === 'CONNECTED' && this.client.uid !== undefined;
  }

  // Clean up method for proper resource management
  cleanup(): void {
    this.callbacks = {};
  }
}
