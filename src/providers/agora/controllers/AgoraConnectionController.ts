import { IAgoraRTCClient } from 'agora-rtc-sdk-ng';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { SessionCredentials } from '../../../types/api.schemas';

export interface AgoraConnectionConfig {
  credentials: SessionCredentials;
}

export interface ConnectionEventCallbacks {
  onConnected?: () => void;
  onDisconnected?: (reason?: string) => void;
  onConnectionFailed?: (error: StreamingError) => void;
  onTokenWillExpire?: () => void;
  onTokenDidExpire?: () => void;
}

export class AgoraConnectionController {
  private client: IAgoraRTCClient;
  private isConnected = false;
  private callbacks: ConnectionEventCallbacks = {};

  constructor(client: IAgoraRTCClient) {
    this.client = client;
  }

  async connect(config: AgoraConnectionConfig, callbacks: ConnectionEventCallbacks = {}): Promise<void> {
    try {
      logger.info('Starting Agora connection', {
        agora_channel: config.credentials.agora_channel,
        agora_uid: config.credentials.agora_uid,
        agora_app_id: config.credentials.agora_app_id,
        agora_token: config.credentials.agora_token,
      });

      this.callbacks = callbacks;

      // Set up event listeners before connecting
      this.setupEventListeners();

      const { agora_app_id, agora_channel, agora_token, agora_uid } = config.credentials;

      if (!agora_app_id || !agora_channel || !agora_token || agora_uid === undefined) {
        throw new StreamingError(ErrorCode.INVALID_CREDENTIALS, 'Missing required Agora credentials', {
          details: { credentials: config.credentials },
        });
      }

      await this.client.join(agora_app_id, agora_channel, agora_token, agora_uid);

      this.isConnected = true;

      logger.info('Successfully connected to Agora channel', {
        channelName: agora_channel,
        userId: agora_uid,
        connectionState: this.client.connectionState,
      });

      this.callbacks.onConnected?.();
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to connect to Agora channel', {
        error: streamingError.message,
        code: streamingError.code,
        details: streamingError.context.details,
      });

      this.callbacks.onConnectionFailed?.(streamingError);
      throw streamingError;
    }
  }

  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting from Agora channel');

      // Remove event listeners first
      this.removeEventListeners();

      // Stop and close all local tracks
      await this.cleanupLocalTracks();

      // Unpublish all tracks
      if (this.isConnected) {
        await this.client.unpublish();
        await this.client.leave();
      }

      this.isConnected = false;

      logger.info('Successfully disconnected from Agora channel');
      this.callbacks.onDisconnected?.();
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Error during disconnect', {
        error: streamingError.message,
        code: streamingError.code,
      });

      // Still mark as disconnected even if there was an error
      this.isConnected = false;
      this.callbacks.onDisconnected?.(streamingError.message);
    }
  }

  private async cleanupLocalTracks(): Promise<void> {
    try {
      const localTracks = this.client.localTracks;
      for (const track of localTracks) {
        try {
          track.stop();
          track.close();
        } catch (trackError) {
          logger.warn('Failed to cleanup local track', {
            trackType: track.trackMediaType,
            error: trackError instanceof Error ? trackError.message : String(trackError),
          });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup local tracks', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private setupEventListeners(): void {
    // Token expiration events
    this.client.on('token-privilege-will-expire', () => {
      logger.warn('Agora token will expire in 30 seconds');
      this.callbacks.onTokenWillExpire?.();
    });

    this.client.on('token-privilege-did-expire', () => {
      logger.error('Agora token has expired');
      this.isConnected = false;
      this.callbacks.onTokenDidExpire?.();
    });

    // Connection state changes
    this.client.on('connection-state-change', (curState, revState, reason) => {
      logger.info('Agora connection state changed', {
        currentState: curState,
        previousState: revState,
        reason,
      });

      if (curState === 'DISCONNECTED' || curState === 'DISCONNECTING') {
        this.isConnected = false;
        this.callbacks.onDisconnected?.(reason);
      }
    });

    // Exception handling
    this.client.on('exception', (e) => {
      const streamingError = ErrorMapper.mapAgoraError(e);

      // Handle audio level warnings as non-critical errors
      if (e.code === 2002 || e.code === 4002) {
        // AUDIO_OUTPUT_LEVEL_TOO_LOW and AUDIO_OUTPUT_LEVEL_TOO_LOW_RECOVER
        logger.warn('Agora audio level warning (non-critical)', {
          code: e.code,
          message: e.msg,
          uid: e.uid,
        });
        // Don't call onConnectionFailed for audio level warnings
        return;
      }

      logger.error('Agora exception occurred', {
        code: e.code,
        message: e.msg,
        uid: e.uid,
      });

      this.callbacks.onConnectionFailed?.(streamingError);
    });
  }

  private removeEventListeners(): void {
    this.client.removeAllListeners('token-privilege-will-expire');
    this.client.removeAllListeners('token-privilege-did-expire');
    this.client.removeAllListeners('connection-state-change');
    this.client.removeAllListeners('exception');
  }

  // Getters
  get connected(): boolean {
    return this.isConnected && this.client.connectionState === 'CONNECTED';
  }

  get connectionState(): string {
    return this.client.connectionState;
  }

  get uid(): number | string | undefined {
    return this.client.uid;
  }

  // Check if client is ready for stream messages
  isReadyForMessages(): boolean {
    return this.connected && this.client.uid !== undefined;
  }

  // Clean up method for proper resource management
  async cleanup(): Promise<void> {
    await this.disconnect();
    this.callbacks = {};
  }
}
