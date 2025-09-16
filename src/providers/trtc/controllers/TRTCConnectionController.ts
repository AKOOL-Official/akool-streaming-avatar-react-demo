import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { TRTCCredentials, TRTCConnectionControllerCallbacks, TRTCParams } from '../types';
import { ErrorMapper } from '../../../errors/ErrorMapper';

// TRTC SDK v5 client interface (simplified)
interface TRTCClient {
  enterRoom(params: TRTCParams): Promise<void>;
  exitRoom(): Promise<void>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback?: (...args: unknown[]) => void): void;
  getSDKVersion(): string;
}

export class TRTCConnectionController {
  private client: TRTCClient;
  private isConnected = false;
  private isConnecting = false;
  private callbacks: TRTCConnectionControllerCallbacks = {};
  private credentials: TRTCCredentials | null = null;

  constructor(client: TRTCClient) {
    this.client = client;
    this.setupEventHandlers();
  }

  setCallbacks(callbacks: TRTCConnectionControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  async connect(credentials: TRTCCredentials): Promise<void> {
    try {
      if (this.isConnecting) {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Connection already in progress', { provider: 'trtc' });
      }

      if (this.isConnected) {
        logger.debug('TRTC already connected');
        return;
      }

      logger.info('Connecting to TRTC room', {
        sdkAppId: credentials.trtc_app_id,
        roomId: credentials.trtc_room_id,
        userId: credentials.trtc_user_id,
      });

      this.isConnecting = true;
      this.credentials = credentials;

      const params: TRTCParams = {
        sdkAppId: credentials.trtc_app_id,
        strRoomId: credentials.trtc_room_id,
        userId: credentials.trtc_user_id,
        userSig: credentials.trtc_user_sig,
        role: 1, // Anchor role
      };

      await this.client.enterRoom(params);

      this.isConnected = true;
      this.isConnecting = false;

      logger.info('Successfully connected to TRTC room');
      this.callbacks.onConnected?.();
    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;

      logger.error('Failed to connect to TRTC room', { error });

      const streamingError = error instanceof StreamingError ? error : ErrorMapper.mapTRTCError(error);

      this.callbacks.onError?.(streamingError);
      throw streamingError;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (!this.isConnected && !this.isConnecting) {
        logger.debug('TRTC already disconnected');
        return;
      }

      logger.info('Disconnecting from TRTC room');

      await this.client.exitRoom();

      this.isConnected = false;
      this.isConnecting = false;
      this.credentials = null;

      logger.info('Successfully disconnected from TRTC room');
      this.callbacks.onDisconnected?.();
    } catch (error) {
      logger.error('Failed to disconnect from TRTC room', { error });

      const streamingError = error instanceof StreamingError ? error : ErrorMapper.mapTRTCError(error);

      this.callbacks.onError?.(streamingError);
      throw streamingError;
    }
  }

  getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
    if (this.isConnected) return 'connected';
    if (this.isConnecting) return 'connecting';
    return 'disconnected';
  }

  getCurrentCredentials(): TRTCCredentials | null {
    return this.credentials;
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  private setupEventHandlers(): void {
    // TRTC SDK v5 events
    this.client.on('onEnterRoom', (...args: unknown[]) => {
      const result = args[0] as number;
      if (result > 0) {
        logger.info('TRTC room entered successfully', { elapsed: result });
        this.isConnected = true;
        this.isConnecting = false;
        this.callbacks.onConnected?.();
      } else {
        logger.error('Failed to enter TRTC room', { result });
        this.isConnecting = false;
        this.isConnected = false;

        const error = new StreamingError(ErrorCode.CONNECTION_FAILED, `Failed to enter TRTC room: ${result}`, {
          provider: 'trtc',
          details: { result },
        });
        this.callbacks.onError?.(error);
      }
    });

    this.client.on('onExitRoom', (...args: unknown[]) => {
      const reason = args[0] as number;
      logger.info('TRTC room exited', { reason });
      this.isConnected = false;
      this.isConnecting = false;
      this.callbacks.onDisconnected?.();
    });

    this.client.on('onConnectionLost', () => {
      logger.warn('TRTC connection lost');
      this.isConnected = false;

      const error = new StreamingError(ErrorCode.CONNECTION_LOST, 'TRTC connection lost', { provider: 'trtc' });
      this.callbacks.onError?.(error);
    });

    this.client.on('onTryToReconnect', () => {
      logger.info('TRTC attempting to reconnect');
      this.callbacks.onReconnecting?.();
    });

    this.client.on('onConnectionRecovery', () => {
      logger.info('TRTC connection recovered');
      this.isConnected = true;
      this.callbacks.onReconnected?.();
    });

    this.client.on('onError', (...args: unknown[]) => {
      const [errCode, errMsg] = args as [number, string];
      logger.error('TRTC SDK error', { errCode, errMsg });

      const error = new StreamingError(ErrorCode.UNKNOWN_ERROR, `TRTC SDK error: ${errMsg}`, {
        provider: 'trtc',
        details: { errCode, errMsg },
      });
      this.callbacks.onError?.(error);
    });

    this.client.on('onWarning', (...args: unknown[]) => {
      const [warningCode, warningMsg] = args as [number, string];
      logger.warn('TRTC SDK warning', { warningCode, warningMsg });
    });
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up TRTC connection controller');

      // Remove all event listeners
      this.client.off('onEnterRoom');
      this.client.off('onExitRoom');
      this.client.off('onConnectionLost');
      this.client.off('onTryToReconnect');
      this.client.off('onConnectionRecovery');
      this.client.off('onError');
      this.client.off('onWarning');

      // Disconnect if still connected
      if (this.isConnected || this.isConnecting) {
        await this.disconnect();
      }

      this.callbacks = {};
      this.credentials = null;

      logger.info('TRTC connection controller cleanup completed');
    } catch (error) {
      logger.error('Error during TRTC connection controller cleanup', { error });
    }
  }
}
