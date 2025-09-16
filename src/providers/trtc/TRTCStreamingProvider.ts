import { logger } from '../../core/Logger';
import { globalResourceManager } from '../../core/ResourceManager';
import { StreamingProvider, StreamingCredentials, StreamingEventHandlers } from '../../types/provider.interfaces';
import {
  StreamingState,
  VideoTrack,
  AudioTrack,
  VideoConfig,
  AudioConfig,
  StreamProviderType,
  Participant,
  ConnectionQuality,
  ChatMessage,
  AIDenoiserConfig,
  AIDenoiserMode,
} from '../../types/streaming.types';
import { StreamingError, ErrorCode } from '../../types/error.types';
import { SystemMessageEvent, ChatMessageEvent, CommandEvent } from '../../types/provider.interfaces';
import { NetworkStats } from '../../components/NetworkQuality';

// Import controllers following established pattern
import { TRTCConnectionController } from './controllers/TRTCConnectionController';
import { TRTCEventController } from './controllers/TRTCEventController';
import { TRTCStatsController } from './controllers/TRTCStatsController';
import { TRTCParticipantController } from './controllers/TRTCParticipantController';
import { TRTCAudioController } from './controllers/TRTCAudioController';
import { TRTCVideoController } from './controllers/TRTCVideoController';
import { CommonMessageController } from '../common/CommonMessageController';
import { TRTCMessageAdapter } from './adapters/TRTCMessageAdapter';
import { isTRTCCredentials, TRTCCredentials } from './types';
import TRTC from 'trtc-sdk-v5';

// Using actual TRTC type from SDK

export interface TRTCProviderConfig {
  client: TRTC;
  messageConfig?: {
    maxMessageSize?: number;
    defaultCmdId?: number;
    reliable?: boolean;
    ordered?: boolean;
  };
}

export class TRTCStreamingProvider implements StreamingProvider {
  public readonly providerType: StreamProviderType = 'trtc';

  private _state: StreamingState = {
    isJoined: false,
    isConnecting: false,
    isSpeaking: false,
    participants: [],
    localParticipant: null,
    networkQuality: null,
    error: null,
  };

  private stateSubscribers = new Set<(state: StreamingState) => void>();
  private eventHandlers: StreamingEventHandlers = {};

  // Controllers following established pattern
  private connectionController: TRTCConnectionController;
  private eventController: TRTCEventController;
  private statsController: TRTCStatsController;
  private participantController: TRTCParticipantController;
  private messageController: CommonMessageController;
  private audioController: TRTCAudioController;
  private videoController: TRTCVideoController;

  private client: TRTC;
  private currentCredentials: TRTCCredentials | null = null;

  constructor(config: TRTCProviderConfig) {
    this.client = config.client;

    // Initialize controllers following established pattern
    this.connectionController = new TRTCConnectionController(this.client);
    this.participantController = new TRTCParticipantController(this.client);
    this.eventController = new TRTCEventController(this.client, this.participantController);
    this.statsController = new TRTCStatsController(this.client);
    this.messageController = new CommonMessageController(new TRTCMessageAdapter(this.client, config.messageConfig), {
      maxEncodedSize: config.messageConfig?.maxMessageSize || 960,
      bytesPerSecond: 960 * 8, // 8KB/s rate limit
    });
    this.audioController = new TRTCAudioController(this.client);
    this.videoController = new TRTCVideoController(this.client);

    // Set video controller reference on event controller for remote video playback
    this.eventController.setVideoController(this.videoController);

    this.setupControllerCallbacks();

    // Register with resource manager for cleanup
    globalResourceManager.registerGlobal({
      cleanup: () => this.cleanup(),
      id: `trtc-provider-${Date.now()}`,
      type: 'TRTCStreamingProvider',
    });
  }

  get state(): StreamingState {
    return { ...this._state };
  }

  async connect(credentials: StreamingCredentials, handlers?: StreamingEventHandlers): Promise<void> {
    try {
      logger.info('Connecting TRTC streaming provider', {
        sdkAppId: (credentials as any).trtc_app_id,
        roomId: (credentials as any).trtc_room_id,
      });

      this.updateState({ isConnecting: true, error: null });
      this.eventHandlers = handlers || {};

      // Validate credentials
      if (!isTRTCCredentials(credentials)) {
        throw new StreamingError(ErrorCode.INVALID_CREDENTIALS, 'Invalid TRTC credentials provided', { credentials });
      }

      const trtcCredentials = credentials as TRTCCredentials;
      this.currentCredentials = trtcCredentials;
      await this.connectionController.connect(trtcCredentials);

      // Create local participant
      const localParticipant = this.participantController.createLocalParticipant(trtcCredentials.trtc_user_id, {
        isConnected: true,
      });

      this.updateState({
        isJoined: true,
        isConnecting: false,
        localParticipant,
      });

      // Start stats collection
      await this.statsController.startCollecting();

      // Mark message adapter as ready
      const messageAdapter = this.messageController.getAdapter() as TRTCMessageAdapter;
      messageAdapter.setReady(true);

      // Enable AI denoiser if configured in audio settings
      // Note: This requires the audio controller to be configured with AI denoiser settings
      // The actual AI denoiser will be enabled when audio is enabled with proper credentials

      logger.info('TRTC connection successful');
    } catch (error) {
      logger.error('TRTC connection failed', { error });
      this.updateState({
        isConnecting: false,
        error:
          error instanceof StreamingError
            ? error
            : new StreamingError(ErrorCode.CONNECTION_FAILED, 'Failed to connect to TRTC', { originalError: error }),
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting TRTC streaming provider');

      // Stop stats collection
      await this.statsController.stopCollecting();

      // Disconnect from room
      await this.connectionController.disconnect();

      this.updateState({
        isJoined: false,
        isConnecting: false,
        participants: [],
        localParticipant: null,
        error: null,
      });

      // Clear participant controller
      this.participantController.clearAllParticipants();

      // Clear credentials
      this.currentCredentials = null;

      logger.info('TRTC disconnection successful');
    } catch (error) {
      logger.error('TRTC disconnection failed', { error });
      throw error instanceof StreamingError
        ? error
        : new StreamingError(ErrorCode.DISCONNECT_FAILED, 'Failed to disconnect from TRTC', { originalError: error });
    }
  }

  // Audio methods
  async enableAudio(config?: AudioConfig): Promise<AudioTrack> {
    const track = await this.audioController.enableAudio(config);

    // If AI denoiser is configured and we have credentials, enable it
    if (config?.aiDenoiser?.enabled && this._state.localParticipant) {
      const credentials = this.getCurrentCredentials();
      if (credentials && 'trtc_app_id' in credentials) {
        try {
          const aiDenoiserConfig = {
            ...config.aiDenoiser,
            credentials: {
              sdkAppId: credentials.trtc_app_id,
              userId: credentials.trtc_user_id,
              userSig: credentials.trtc_user_sig,
            },
          };
          await this.audioController.enableAIDenoiser(aiDenoiserConfig);
        } catch (error) {
          logger.warn('Failed to enable AI denoiser during audio enable', { error });
        }
      }
    }

    return track;
  }

  async disableAudio(): Promise<void> {
    return this.audioController.disableAudio();
  }

  async publishAudio(_track: AudioTrack): Promise<void> {
    return this.audioController.publishAudio();
  }

  async unpublishAudio(): Promise<void> {
    return this.audioController.unpublishAudio();
  }

  // Video methods
  async enableVideo(config?: VideoConfig): Promise<VideoTrack> {
    return this.videoController.enableVideo(config);
  }

  async disableVideo(): Promise<void> {
    return this.videoController.disableVideo();
  }

  async playVideo(elementId: string): Promise<void> {
    return this.videoController.playVideo(elementId);
  }

  async stopVideo(): Promise<void> {
    return this.videoController.stopVideo();
  }

  async publishVideo(_track: VideoTrack): Promise<void> {
    return this.videoController.publishVideo();
  }

  async unpublishVideo(): Promise<void> {
    return this.videoController.unpublishVideo();
  }

  // Messaging methods
  async sendMessage(content: string): Promise<void> {
    const messageId = `msg-${Date.now()}`;
    return this.messageController.sendMessage(messageId, content);
  }

  async sendInterrupt(): Promise<void> {
    const messageId = `interrupt-${Date.now()}`;
    return this.messageController.sendMessage(messageId, 'interrupt');
  }

  // Avatar methods
  async setAvatarParameters(metadata: Record<string, unknown>): Promise<void> {
    return this.messageController.setAvatarParameters(metadata);
  }

  // Noise reduction methods
  async enableNoiseReduction(): Promise<void> {
    return this.audioController.enableNoiseReduction();
  }

  async disableNoiseReduction(): Promise<void> {
    return this.audioController.disableNoiseReduction();
  }

  // AI Denoiser methods
  async enableAIDenoiser(config?: AIDenoiserConfig): Promise<void> {
    return this.audioController.enableAIDenoiser(config);
  }

  async updateAIDenoiserMode(mode: AIDenoiserMode): Promise<void> {
    return this.audioController.updateAIDenoiserMode(mode);
  }

  async disableAIDenoiser(): Promise<void> {
    return this.audioController.disableAIDenoiser();
  }

  async dumpAudio(): Promise<void> {
    return this.audioController.dumpAudio();
  }

  // State management methods
  subscribe(callback: (state: StreamingState) => void): () => void {
    this.stateSubscribers.add(callback);
    return () => this.stateSubscribers.delete(callback);
  }

  updateState(newState: Partial<StreamingState>): void {
    this._state = { ...this._state, ...newState };
    this.stateSubscribers.forEach((callback) => callback(this._state));
  }

  private getCurrentCredentials(): TRTCCredentials | null {
    return this.currentCredentials;
  }

  private setupControllerCallbacks(): void {
    // Connection callbacks
    this.connectionController.setCallbacks({
      onConnected: () => {
        this.updateState({ isJoined: true, isConnecting: false });
        this.eventHandlers.onConnected?.();
      },
      onDisconnected: () => {
        this.updateState({ isJoined: false });
        this.eventHandlers.onDisconnected?.();
      },
      onReconnecting: () => {
        this.updateState({ isConnecting: true });
        this.eventHandlers.onReconnecting?.();
      },
      onReconnected: () => {
        this.updateState({ isJoined: true, isConnecting: false });
        this.eventHandlers.onReconnected?.();
      },
      onError: (error) => {
        this.updateState({ error });
        this.eventHandlers.onError?.(error);
      },
    });

    // Stats callbacks
    this.statsController.setCallbacks({
      onNetworkStatsUpdate: (stats: NetworkStats) => {
        // Convert NetworkStats to ConnectionQuality for state
        const connectionQuality: ConnectionQuality = {
          score: 80, // Default score
          uplink: 'good',
          downlink: 'good',
          rtt: stats.connection?.roundTripTime || 0,
          packetLoss: stats.connection?.packetLossRate || 0,
        };

        // Store both connection quality and detailed stats
        this.updateState({
          networkQuality: connectionQuality,
          detailedNetworkStats: stats.detailedStats,
        });
        this.eventHandlers.onNetworkQualityChanged?.(connectionQuality);
      },
      onError: (error) => {
        logger.error('Stats controller error', { error });
      },
    });

    // Event callbacks
    this.eventController.setCallbacks({
      onParticipantJoined: (participant: Participant) => {
        const participants = [...this._state.participants, participant];
        this.updateState({ participants });
        this.eventHandlers.onParticipantJoined?.(participant);
      },
      onParticipantLeft: (participantId: string) => {
        const participants = this._state.participants.filter((p) => p.id !== participantId);
        this.updateState({ participants });
        this.eventHandlers.onParticipantLeft?.(participantId);
      },
      onParticipantAudioEnabled: (participantId: string, enabled: boolean) => {
        const participants = this._state.participants.map((p) =>
          p.id === participantId ? { ...p, hasAudio: enabled } : p,
        );
        this.updateState({ participants });
        this.eventHandlers.onParticipantAudioEnabled?.(participantId, enabled);
      },
      onParticipantVideoEnabled: (participantId: string, enabled: boolean) => {
        const participants = this._state.participants.map((p) =>
          p.id === participantId ? { ...p, hasVideo: enabled } : p,
        );
        this.updateState({ participants });
        this.eventHandlers.onParticipantVideoEnabled?.(participantId, enabled);
      },
      onError: (error) => {
        this.updateState({ error });
        this.eventHandlers.onError?.(error);
      },
    });

    // Participant callbacks
    this.participantController.setCallbacks({
      onParticipantAdded: (participant: Participant) => {
        if (participant.isLocal) {
          this.updateState({ localParticipant: participant });
        } else {
          const participants = [...this._state.participants, participant];
          this.updateState({ participants });
        }
      },
      onParticipantRemoved: (participantId: string) => {
        const participants = this._state.participants.filter((p) => p.id !== participantId);
        this.updateState({ participants });
      },
      onParticipantUpdated: (participant: Participant) => {
        if (participant.isLocal) {
          this.updateState({ localParticipant: participant });
        } else {
          const participants = this._state.participants.map((p) => (p.id === participant.id ? participant : p));
          this.updateState({ participants });
        }
      },
      onError: (error) => {
        logger.error('Participant controller error', { error });
      },
    });

    // Message callbacks
    this.messageController.setCallbacks({
      onMessageReceived: (message: unknown) => {
        this.eventHandlers.onMessageReceived?.(message as ChatMessage);
      },
      onSystemMessage: (event: unknown) => {
        this.eventHandlers.onSystemMessage?.(event as SystemMessageEvent);
      },
      onChatMessage: (event: unknown) => {
        this.eventHandlers.onChatMessage?.(event as ChatMessageEvent);
      },
      onCommand: (event: unknown) => {
        this.eventHandlers.onCommand?.(event as CommandEvent);
      },
      onError: (error: Error) => {
        const streamingError =
          error instanceof StreamingError
            ? error
            : new StreamingError(ErrorCode.UNKNOWN_ERROR, error.message, { provider: 'trtc' });
        this.updateState({ error: streamingError });
        this.eventHandlers.onError?.(streamingError);
      },
    });

    // Audio callbacks
    this.audioController.setCallbacks({
      onAudioTrackPublished: () => {
        const localParticipant = this.participantController.updateLocalParticipant({
          hasAudio: true,
        });
        if (localParticipant) {
          this.updateState({ localParticipant });
        }
      },
      onAudioTrackUnpublished: () => {
        const localParticipant = this.participantController.updateLocalParticipant({
          hasAudio: false,
        });
        if (localParticipant) {
          this.updateState({ localParticipant });
        }
      },
      onVolumeChange: (volume: number) => {
        const localParticipant = this.participantController.updateLocalParticipant({
          audioLevel: volume,
        });
        if (localParticipant) {
          this.updateState({ localParticipant });
        }
      },
      onAudioError: (error: StreamingError) => {
        this.updateState({ error });
        this.eventHandlers.onError?.(error);
      },
    });

    // Video callbacks
    this.videoController.setCallbacks({
      onVideoTrackPublished: () => {
        const localParticipant = this.participantController.updateLocalParticipant({
          hasVideo: true,
        });
        if (localParticipant) {
          this.updateState({ localParticipant });
        }
      },
      onVideoTrackUnpublished: () => {
        const localParticipant = this.participantController.updateLocalParticipant({
          hasVideo: false,
        });
        if (localParticipant) {
          this.updateState({ localParticipant });
        }
      },
      onVideoResize: (width: number, height: number) => {
        logger.debug('TRTC video resized', { width, height });
      },
      onVideoError: (error: StreamingError) => {
        this.updateState({ error });
        this.eventHandlers.onError?.(error);
      },
    });
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up TRTC provider');

      // Stop stats collection first
      await this.statsController.stopCollecting();

      // Disconnect if still connected
      if (this._state.isJoined || this._state.isConnecting) {
        await this.disconnect();
      }

      // Cleanup all controllers
      await Promise.all([
        this.audioController.cleanup(),
        this.videoController.cleanup(),
        this.statsController.cleanup(),
        this.messageController.cleanup(),
        this.eventController.cleanup(),
        this.participantController.cleanup(),
        this.connectionController.cleanup(),
      ]);

      // Clear state and subscribers
      this.stateSubscribers.clear();
      this.eventHandlers = {};

      logger.info('TRTC provider cleanup completed');
    } catch (error) {
      logger.error('Error during TRTC provider cleanup', { error });
    }
  }
}
