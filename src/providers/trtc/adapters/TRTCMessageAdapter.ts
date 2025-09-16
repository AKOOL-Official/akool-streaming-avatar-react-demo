import { MessageAdapter } from '../../common/adapters/MessageAdapter';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import TRTC from 'trtc-sdk-v5';

export interface TRTCMessageConfig {
  maxMessageSize?: number;
  defaultCmdId?: number;
  reliable?: boolean;
  ordered?: boolean;
}

export class TRTCMessageAdapter implements MessageAdapter {
  private client: TRTC;
  private config: Required<TRTCMessageConfig>;
  private messageCallbacks = new Map<string, (data: Uint8Array) => void>();
  private isReadyState = false;

  constructor(client: TRTC, config: TRTCMessageConfig = {}) {
    this.client = client;
    this.config = {
      maxMessageSize: config.maxMessageSize || 1024, // 1KB default
      defaultCmdId: config.defaultCmdId || 1,
      reliable: config.reliable !== false, // Default to reliable
      ordered: config.ordered !== false, // Default to ordered
    };
    this.setupEventHandlers();
  }

  async sendData(data: Uint8Array): Promise<void> {
    try {
      if (data.length > this.config.maxMessageSize) {
        throw new StreamingError(
          ErrorCode.MESSAGE_TOO_LARGE,
          `Message size ${data.length} exceeds maximum ${this.config.maxMessageSize}`,
          { provider: 'trtc', messageSize: data.length, maxSize: this.config.maxMessageSize },
        );
      }

      // Convert Uint8Array to ArrayBuffer as required by TRTC SDK
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

      this.client.sendCustomMessage({
        cmdId: this.config.defaultCmdId,
        data: arrayBuffer,
      });

      logger.debug('TRTC raw message sent', {
        size: data.length,
        cmdId: this.config.defaultCmdId,
        reliable: this.config.reliable,
        ordered: this.config.ordered,
      });
    } catch (error) {
      logger.error('Failed to send TRTC raw message', { error, size: data.length });
      throw new StreamingError(ErrorCode.MESSAGE_SEND_FAILED, 'Failed to send TRTC message', {
        provider: 'trtc',
        originalError: error,
      });
    }
  }

  async sendSEIMessage(data: Uint8Array, repeatCount = 1): Promise<void> {
    try {
      if (data.length > this.config.maxMessageSize) {
        throw new StreamingError(
          ErrorCode.MESSAGE_TOO_LARGE,
          `SEI message size ${data.length} exceeds maximum ${this.config.maxMessageSize}`,
          { provider: 'trtc', messageSize: data.length, maxSize: this.config.maxMessageSize },
        );
      }

      // Convert Uint8Array to ArrayBuffer as required by TRTC SDK
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

      this.client.sendSEIMessage(arrayBuffer);

      logger.debug('TRTC SEI message sent', {
        size: data.length,
        repeatCount,
      });
    } catch (error) {
      logger.error('Failed to send TRTC SEI message', { error, size: data.length });
      throw new StreamingError(ErrorCode.MESSAGE_SEND_FAILED, 'Failed to send TRTC SEI message', {
        provider: 'trtc',
        originalError: error,
      });
    }
  }

  isReady(): boolean {
    return this.isReadyState;
  }

  setReady(ready: boolean): void {
    this.isReadyState = ready;
    logger.debug('TRTC message adapter ready state changed', { ready });
  }

  setupMessageListener(callback: (data: Uint8Array) => void): void {
    const callbackId = `callback-${Date.now()}-${Math.random()}`;
    this.messageCallbacks.set(callbackId, callback);
    logger.info('TRTC message listener setup', {
      callbackId,
      totalCallbacks: this.messageCallbacks.size,
    });
  }

  removeMessageListener(): void {
    this.messageCallbacks.clear();
  }

  onMessage(callback: (data: Uint8Array) => void): () => void {
    const callbackId = `callback-${Date.now()}-${Math.random()}`;
    this.messageCallbacks.set(callbackId, callback);

    return () => {
      this.messageCallbacks.delete(callbackId);
    };
  }

  getMaxMessageSize(): number {
    return this.config.maxMessageSize;
  }

  updateConfig(config: Partial<TRTCMessageConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    logger.info('TRTC message adapter config updated', { config: this.config });
  }

  private setupEventHandlers(): void {
    // Custom command message events
    this.client.on(TRTC.EVENT.CUSTOM_MESSAGE, this.handleCustomMessage);

    // Note: SEI and MISS_CUSTOM_MESSAGE events are not currently used
    // as they are not available as TRTC.EVENT constants in this SDK version

    logger.info('TRTC message event handlers registered');
  }

  private handleCustomMessage = (event: any) => {
    const messageEvent = event as { userId: string; cmdId: number; seq: number; data: ArrayBuffer } | undefined;
    if (!messageEvent?.userId || !messageEvent?.data) {
      logger.warn('TRTC custom command message received with invalid data', { event: messageEvent });
      return;
    }

    try {
      logger.info('TRTC custom command message received', {
        userId: messageEvent.userId,
        cmdId: messageEvent.cmdId,
        seq: messageEvent.seq,
        dataSize: messageEvent.data.byteLength,
      });

      // Convert ArrayBuffer to Uint8Array for compatibility
      const message = new Uint8Array(messageEvent.data);

      // Forward to all registered callbacks
      logger.info('Forwarding message to callbacks', {
        callbackCount: this.messageCallbacks.size,
        userId: messageEvent.userId,
        cmdId: messageEvent.cmdId,
      });
      this.messageCallbacks.forEach((callback) => {
        try {
          callback(message);
        } catch (error) {
          logger.error('Error in TRTC message callback', {
            error,
            userId: messageEvent.userId,
            cmdId: messageEvent.cmdId,
          });
        }
      });
    } catch (error) {
      logger.error('Failed to handle TRTC custom command message', {
        error,
        userId: messageEvent?.userId,
        cmdId: messageEvent?.cmdId,
      });
    }
  };

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up TRTC message adapter');

      // Remove event listeners
      this.client.off(TRTC.EVENT.CUSTOM_MESSAGE, this.handleCustomMessage);
      // Note: SEI and MISS_CUSTOM_MESSAGE events are not currently used
      // this.client.off(TRTC.EVENT.SEI_MESSAGE);
      // this.client.off(TRTC.EVENT.MISS_CUSTOM_MESSAGE);

      // Clear callbacks
      this.messageCallbacks.clear();

      logger.info('TRTC message adapter cleanup completed');
    } catch (error) {
      logger.error('Error during TRTC message adapter cleanup', { error });
    }
  }
}
