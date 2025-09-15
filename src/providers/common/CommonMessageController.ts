import { logger } from '../../core/Logger';
import { StreamingError, ErrorCode } from '../../types/error.types';
import { ChatMessage } from '../../types/streaming.types';
import { SystemMessageEvent, ChatMessageEvent, CommandEvent } from '../../types/provider.interfaces';
import { MessageAdapter } from './adapters/MessageAdapter';
import {
  MessageProviderConfig,
  MessageControllerCallbacks,
  StreamMessage,
  CommandPayload,
  CommandResponsePayload,
  ChatResponsePayload,
} from './types/message.types';

export class CommonMessageController {
  private adapter: MessageAdapter;
  private config: MessageProviderConfig;
  private callbacks: MessageControllerCallbacks = {};

  constructor(adapter: MessageAdapter, config: MessageProviderConfig) {
    this.adapter = adapter;
    this.config = config;
  }

  setCallbacks(callbacks: MessageControllerCallbacks): void {
    this.callbacks = callbacks;
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    this.adapter.setupMessageListener(this.handleIncomingMessage.bind(this));
  }

  private handleIncomingMessage(data: Uint8Array): void {
    try {
      const text = new TextDecoder().decode(data);
      logger.debug('Message received', {
        length: data.length,
        text: text.substring(0, 100), // Log first 100 chars for debugging
      });

      // Try to parse as stream message
      try {
        const parsedData = JSON.parse(text) as Record<string, unknown>;
        logger.debug('Parsed JSON data', { data: parsedData });
        this.processStreamMessage(parsedData);
      } catch (parseError) {
        logger.warn('Failed to parse JSON, treating as simple text message', {
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          text: text.substring(0, 100),
        });

        // If not JSON, treat as simple text message
        const message: ChatMessage = {
          id: `msg-${Date.now()}`,
          content: text,
          timestamp: Date.now(),
          fromParticipant: 'system',
          type: 'text',
        };
        this.callbacks.onMessageReceived?.(message);
      }
    } catch (error) {
      logger.error('Error handling incoming message', {
        error: error instanceof Error ? error.message : String(error),
        payloadLength: data.length,
      });
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private processStreamMessage(data: Record<string, unknown>): void {
    try {
      // Validate message format
      const streamMessage = data as unknown as StreamMessage;
      const { v, type, mid, pld } = streamMessage;

      if (v !== 2) {
        logger.debug('Ignoring message with unsupported version', { version: v });
        return;
      }

      logger.debug('Processing stream message', { type, mid });

      switch (type) {
        case 'chat':
          this.handleChatMessage(mid || `msg-${Date.now()}`, pld as ChatResponsePayload);
          break;
        case 'event':
          this.handleSystemEvent(mid || `event-${Date.now()}`, pld as unknown as { event: string });
          break;
        case 'command':
          this.handleCommandMessage(mid || `cmd-${Date.now()}`, pld as CommandPayload | CommandResponsePayload);
          break;
        default:
          logger.debug('Unknown message type received', { type, mid });
      }
    } catch (error) {
      logger.error('Error processing stream message', {
        error: error instanceof Error ? error.message : String(error),
        data,
      });
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleChatMessage(messageId: string, payload: ChatResponsePayload): void {
    const { text, from } = payload;
    const event: ChatMessageEvent = {
      messageId: `chat_${messageId}`,
      text,
      from: from === 'bot' ? 'avatar' : from,
    };

    this.callbacks.onChatMessage?.(event);

    // Create legacy ChatMessage for backward compatibility
    const chatMessage: ChatMessage = {
      id: messageId || `msg-${Date.now()}`,
      content: payload.text,
      timestamp: Date.now(),
      fromParticipant: 'avatar',
      type: 'text',
    };
    this.callbacks.onMessageReceived?.(chatMessage);
  }

  private handleSystemEvent(messageId: string, payload: { event: string }): void {
    const { event } = payload;

    let eventType: SystemMessageEvent['eventType'];
    let text: string;

    switch (event) {
      case 'audio_start':
        eventType = 'avatar_audio_start';
        text = '🎤 Avatar started speaking';
        // Update speaking state
        this.callbacks.onSpeakingStateChanged?.(true);
        break;
      case 'audio_end':
        eventType = 'avatar_audio_end';
        text = '✅ Avatar finished speaking';
        // Update speaking state
        this.callbacks.onSpeakingStateChanged?.(false);
        break;
      default:
        logger.debug('Unknown system event received', { event });
        return;
    }

    const systemEvent: SystemMessageEvent = {
      messageId: `event_${messageId}`,
      text,
      eventType,
    };

    this.callbacks.onSystemMessage?.(systemEvent);
  }

  private handleCommandMessage(messageId: string, payload: CommandPayload | CommandResponsePayload): void {
    if ('code' in payload) {
      // This is a command acknowledgment
      const { cmd, code, msg } = payload;
      const success = code === 1000;
      const statusText = success ? 'Success' : 'Failed';
      const eventType = cmd === 'interrupt' ? 'interrupt_ack' : 'set_params_ack';

      const systemEvent: SystemMessageEvent = {
        messageId: `cmd_ack_${messageId}`,
        text: `${success ? '✅' : '❌'} ${cmd}: ${statusText}${msg ? ` (${msg})` : ''}`,
        eventType,
      };

      this.callbacks.onSystemMessage?.(systemEvent);

      const commandEvent: CommandEvent = {
        command: cmd,
        success,
        message: msg,
      };

      this.callbacks.onCommand?.(commandEvent);
      this.callbacks.onCommandResponse?.(cmd, code, msg);
    } else {
      // This is a command being sent
      const { cmd, data } = payload;
      const eventType = cmd === 'interrupt' ? 'interrupt' : 'set_params';
      const dataStr = data ? ` with data: ${JSON.stringify(data)}` : '';
      const messageText = cmd === 'set-params' && data ? `📤 ${cmd}${dataStr} ℹ️` : `📤 ${cmd}${dataStr}`;

      const metadata = cmd === 'set-params' && data ? { fullParams: data } : undefined;

      const systemEvent: SystemMessageEvent = {
        messageId: `cmd_send_${messageId}`,
        text: messageText,
        eventType,
        metadata,
      };

      this.callbacks.onSystemMessage?.(systemEvent);

      const commandEvent: CommandEvent = {
        command: cmd,
        data,
      };

      this.callbacks.onCommand?.(commandEvent);
      this.callbacks.onCommandSent?.(cmd, data);
    }
  }

  // Public methods for sending messages
  async sendMessage(messageId: string, content: string): Promise<void> {
    try {
      logger.info('Sending message to avatar', { messageId, contentLength: content.length });

      if (!this.adapter.isReady()) {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Adapter not ready for sending messages');
      }

      if (!content) {
        throw new StreamingError(ErrorCode.INVALID_CONFIGURATION, 'Message content cannot be empty');
      }

      const chunks = this.splitMessageIntoChunks(content, messageId);
      logger.debug('Message split into chunks', {
        totalChunks: chunks.length,
        messageId,
      });

      await this.sendMessageChunks(chunks, messageId);
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.API_REQUEST_FAILED,
              `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
            );

      logger.error('Failed to send message', {
        error: streamingError.message,
        messageId,
        contentLength: content.length,
      });
      throw streamingError;
    }
  }

  async interruptResponse(): Promise<void> {
    try {
      logger.info('Sending interrupt command');

      if (!this.adapter.isReady()) {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Adapter not ready for sending messages');
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

      const encoder = new TextEncoder();
      const data = encoder.encode(jsonData);

      await this.adapter.sendData(data);

      // Trigger both onCommandSent and onCommand callbacks
      this.callbacks.onCommandSent?.('interrupt');

      const commandEvent: CommandEvent = {
        command: 'interrupt',
      };
      this.callbacks.onCommand?.(commandEvent);
    } catch (error) {
      const streamingError = new StreamingError(
        ErrorCode.API_REQUEST_FAILED,
        `Failed to send interrupt: ${error instanceof Error ? error.message : String(error)}`,
      );

      logger.error('Failed to send interrupt command', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  async setAvatarParameters(metadata: Record<string, unknown>): Promise<void> {
    try {
      logger.info('Setting avatar parameters', { metadata });

      if (!this.adapter.isReady()) {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Adapter not ready for sending messages');
      }

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

      const encoder = new TextEncoder();
      const data = encoder.encode(jsonData);

      await this.adapter.sendData(data);

      // Trigger both onCommandSent and onCommand callbacks
      this.callbacks.onCommandSent?.('set-params', cleanedMeta);

      const commandEvent: CommandEvent = {
        command: 'set-params',
        data: cleanedMeta,
      };
      this.callbacks.onCommand?.(commandEvent);
    } catch (error) {
      const streamingError = new StreamingError(
        ErrorCode.API_REQUEST_FAILED,
        `Failed to set avatar parameters: ${error instanceof Error ? error.message : String(error)}`,
      );

      logger.error('Failed to set avatar parameters', {
        error: streamingError.message,
        metadata,
      });
      throw streamingError;
    }
  }

  // Private helper methods
  private splitMessageIntoChunks(content: string, messageId: string): string[] {
    const baseEncoded = this.encodeMessage('', 0, false, messageId);
    const maxQuestionLength = Math.floor((this.config.maxEncodedSize - baseEncoded.length) / 4);

    const chunks: string[] = [];
    let remainingMessage = content;
    let chunkIndex = 0;

    while (remainingMessage.length > 0) {
      let chunk = remainingMessage.slice(0, maxQuestionLength);
      let encoded = this.encodeMessage(chunk, chunkIndex, false, messageId);

      while (encoded.length > this.config.maxEncodedSize && chunk.length > 1) {
        chunk = chunk.slice(0, Math.ceil(chunk.length / 2));
        encoded = this.encodeMessage(chunk, chunkIndex, false, messageId);
      }

      if (encoded.length > this.config.maxEncodedSize) {
        throw new StreamingError(ErrorCode.INVALID_CONFIGURATION, 'Message content too large for chunking', {
          details: { chunkSize: encoded.length, maxSize: this.config.maxEncodedSize },
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

      const minimumTimeMs = Math.ceil((1000 * chunkSize) / this.config.bytesPerSecond);
      const startTime = Date.now();

      logger.debug('Sending message chunk', {
        chunkIndex: i + 1,
        totalChunks: chunks.length,
        chunkSize,
        isLastChunk,
        messageId,
      });

      try {
        await this.adapter.sendData(encodedChunk);
      } catch (error) {
        throw new StreamingError(ErrorCode.API_REQUEST_FAILED, `Failed to send chunk ${i + 1}/${chunks.length}`, {
          details: { chunkIndex: i, messageId, originalError: error },
        });
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

  cleanup(): void {
    this.adapter.removeMessageListener();
    this.adapter.cleanup();
    this.callbacks = {};
    logger.info('Common message controller cleanup completed');
  }
}
