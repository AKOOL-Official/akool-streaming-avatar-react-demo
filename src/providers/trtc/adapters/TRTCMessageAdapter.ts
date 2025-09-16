import { MessageAdapter } from '../../common/adapters/MessageAdapter';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import TRTC from 'trtc-sdk-v5';

// TRTC SDK v5 client interface for custom messages
interface TRTCClient {
  sendCustomCmdMsg(cmdId: number, data: ArrayBuffer, reliable?: boolean, ordered?: boolean): Promise<void>;
  sendSEIMsg(data: ArrayBuffer, repeatCount?: number): Promise<void>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback?: (...args: unknown[]) => void): void;
}

export interface TRTCMessageConfig {
  maxMessageSize?: number;
  defaultCmdId?: number;
  reliable?: boolean;
  ordered?: boolean;
}

export class TRTCMessageAdapter implements MessageAdapter {
  private client: TRTCClient;
  private config: Required<TRTCMessageConfig>;
  private messageCallbacks = new Map<string, (data: Uint8Array) => void>();
  private isReadyState = false;

  constructor(client: TRTCClient, config: TRTCMessageConfig = {}) {
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

      await this.client.sendCustomCmdMsg(
        this.config.defaultCmdId,
        arrayBuffer,
        this.config.reliable,
        this.config.ordered,
      );

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

      await this.client.sendSEIMsg(arrayBuffer, repeatCount);

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
    this.client.on(TRTC.EVENT.CUSTOM_MESSAGE, (...args: unknown[]) => {
      const event = args[0] as { userId: string; cmdId: number; seq: number; data: ArrayBuffer } | undefined;
      if (!event?.userId || !event?.data) {
        logger.warn('TRTC custom command message received with invalid data', { event });
        return;
      }

      try {
        logger.info('TRTC custom command message received', {
          userId: event.userId,
          cmdId: event.cmdId,
          seq: event.seq,
          dataSize: event.data.byteLength,
        });

        // Convert ArrayBuffer to Uint8Array for compatibility
        const message = new Uint8Array(event.data);

        // Forward to all registered callbacks
        logger.info('Forwarding message to callbacks', {
          callbackCount: this.messageCallbacks.size,
          userId: event.userId,
          cmdId: event.cmdId,
        });
        this.messageCallbacks.forEach((callback) => {
          try {
            callback(message);
          } catch (error) {
            logger.error('Error in TRTC message callback', { error, userId: event.userId, cmdId: event.cmdId });
          }
        });
      } catch (error) {
        logger.error('Failed to handle TRTC custom command message', {
          error,
          userId: event?.userId,
          cmdId: event?.cmdId,
        });
      }
    });

    // SEI message events (disabled - not used)
    // this.client.on('onRecvSEIMsg', (...args: unknown[]) => {
    //   const [userId, message] = args as [string, Uint8Array];
    //   try {
    //     logger.info('TRTC SEI message received', {
    //       userId,
    //       messageSize: message.length
    //     });

    //     // Forward to all registered callbacks
    //     this.messageCallbacks.forEach(callback => {
    //       try {
    //         callback(message);
    //       } catch (error) {
    //         logger.error('Error in TRTC SEI message callback', { error, userId });
    //       }
    //     });
    //   } catch (error) {
    //     logger.error('Failed to handle TRTC SEI message', { error, userId });
    //   }
    // });

    // Note: Missed message events may not be available in this SDK version
    // this.client.on(TRTC.EVENT.MISS_CUSTOM_MESSAGE, (...args: unknown[]) => {
    //   const [userId, cmdId, errCode, missed] = args as [string, number, number, number];
    //   logger.warn('TRTC custom command message missed', {
    //     userId,
    //     cmdId,
    //     errCode,
    //     missed
    //   });
    // });

    logger.info('TRTC message event handlers registered');
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up TRTC message adapter');

      // Remove event listeners
      this.client.off('onRecvCustomCmdMsg');
      this.client.off('onRecvSEIMsg');
      this.client.off('onMissCustomCmdMsg');

      // Clear callbacks
      this.messageCallbacks.clear();

      logger.info('TRTC message adapter cleanup completed');
    } catch (error) {
      logger.error('Error during TRTC message adapter cleanup', { error });
    }
  }
}
