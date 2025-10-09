import { ILocalVideoTrack } from 'agora-rtc-sdk-ng';
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
} from '../../types/streaming.types';
import { Session, SessionCredentials } from '../../types/api.schemas';
import { StreamingError, ErrorCode } from '../../types/error.types';
import { SystemMessageEvent, ChatMessageEvent, CommandEvent } from '../../types/provider.interfaces';
import { ChatMessage, Participant } from '../../types/streaming.types';
import { NetworkStats } from '../../components/NetworkQuality';

// Import controllers
import {
  AgoraConnectionController,
  AgoraConnectionConfig,
  ConnectionEventCallbacks,
} from './controllers/AgoraConnectionController';
import { AgoraEventController, AgoraEventControllerCallbacks } from './controllers/AgoraEventController';
import { AgoraStatsController, StatsControllerCallbacks } from './controllers/AgoraStatsController';
import { AgoraParticipantController, ParticipantControllerCallbacks } from './controllers/AgoraParticipantController';
import { AgoraAudioController } from './controllers/AgoraAudioController';
import { AudioControllerCallbacks } from '../../types/streaming.types';
import { AgoraVideoController, VideoControllerCallbacks } from './controllers/AgoraVideoController';
import { CommonMessageController } from '../common/CommonMessageController';
import { AgoraMessageAdapter } from './adapters/AgoraMessageAdapter';
import { RTCClient } from './types';

// Agora-specific credential types
export interface AgoraCredentials {
  agora_uid: number;
  agora_app_id: string;
  agora_channel: string;
  agora_token: string;
}

// Type guard for Agora credentials
export function isAgoraCredentials(credentials: unknown): credentials is AgoraCredentials {
  const creds = credentials as AgoraCredentials;
  return !!(creds?.agora_app_id && creds?.agora_token && creds?.agora_channel && creds?.agora_uid !== undefined);
}

export interface AgoraProviderConfig {
  client: RTCClient;
  session?: Session;
}

export class AgoraStreamingProvider implements StreamingProvider {
  public readonly providerType: StreamProviderType = 'agora';

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

  // Controllers
  private connectionController: AgoraConnectionController;
  private eventController: AgoraEventController;
  private statsController: AgoraStatsController;
  private participantController: AgoraParticipantController;
  private messageController: CommonMessageController;
  private audioController: AgoraAudioController;
  private videoController: AgoraVideoController;

  private client: RTCClient;

  constructor(config: AgoraProviderConfig) {
    this.client = config.client;

    // Initialize controllers
    this.connectionController = new AgoraConnectionController(this.client);
    this.participantController = new AgoraParticipantController(this.client);
    this.eventController = new AgoraEventController(this.client, this.participantController);
    this.statsController = new AgoraStatsController(this.client);
    this.messageController = new CommonMessageController(new AgoraMessageAdapter(this.client), {
      maxEncodedSize: 960, // 1KB
      bytesPerSecond: 960 * 6, // 6KB/s
    });
    this.audioController = new AgoraAudioController(this.client);
    this.videoController = new AgoraVideoController(this.client);

    this.setupControllerCallbacks();

    // Register with resource manager for cleanup
    globalResourceManager.registerGlobal({
      cleanup: () => this.cleanup(),
      id: `agora-provider-${Date.now()}`,
      type: 'AgoraStreamingProvider',
    });
  }

  get state(): StreamingState {
    return { ...this._state };
  }

  async connect(credentials: StreamingCredentials, handlers?: StreamingEventHandlers): Promise<void> {
    try {
      this.initializeConnection(credentials, handlers);
      const connectionConfig = this.createConnectionConfig(credentials);
      const connectionCallbacks = this.createConnectionCallbacks();

      await this.connectionController.connect(connectionConfig, connectionCallbacks);
      logger.info('Agora streaming provider connected successfully');
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  private initializeConnection(credentials: StreamingCredentials, handlers?: StreamingEventHandlers): void {
    logger.info('Connecting Agora streaming provider', {
      channelName: credentials.channelName,
      userId: credentials.userId,
    });

    this.updateState({ isConnecting: true, error: null });
    this.eventHandlers = handlers || {};
  }

  private createConnectionConfig(credentials: StreamingCredentials): AgoraConnectionConfig {
    const agoraCredentials = this.mapCredentials(credentials);
    return {
      credentials: agoraCredentials,
    };
  }

  private createConnectionCallbacks(): ConnectionEventCallbacks {
    return {
      onConnected: () => this.handleConnected(),
      onDisconnected: (reason?: string) => this.handleDisconnected(reason || 'Unknown reason'),
      onConnectionFailed: (error) => this.handleConnectionFailed(error),
      onTokenWillExpire: () => this.handleTokenWillExpire(),
      onTokenDidExpire: () => this.handleTokenDidExpire(),
    };
  }

  private handleConnected(): void {
    this.updateState({
      isJoined: true,
      isConnecting: false,
      error: null,
    });
    this.startEventListening();
  }

  private handleDisconnected(reason: string): void {
    this.updateState({
      isJoined: false,
      isConnecting: false,
      participants: [],
      localParticipant: null,
    });
    this.stopEventListening();
    logger.info('Agora provider disconnected', { reason });
  }

  private handleConnectionFailed(error: StreamingError): void {
    this.updateState({
      isConnecting: false,
      isJoined: false,
      error,
    });
    this.eventHandlers.onError?.(error);
  }

  private handleTokenWillExpire(): void {
    logger.warn('Agora token will expire soon');
    // Could implement token refresh logic here
  }

  private handleTokenDidExpire(): void {
    const error = new StreamingError(ErrorCode.INVALID_CREDENTIALS, 'Agora token has expired');
    this.updateState({ error });
    this.eventHandlers.onError?.(error);
  }

  private handleConnectionError(error: unknown): never {
    const streamingError =
      error instanceof StreamingError ? error : new StreamingError(ErrorCode.CONNECTION_FAILED, 'Failed to connect');

    this.updateState({
      isConnecting: false,
      isJoined: false,
      error: streamingError,
    });

    logger.error('Failed to connect Agora streaming provider', {
      error: streamingError.message,
      code: streamingError.code,
    });

    throw streamingError;
  }

  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting Agora streaming provider');

      this.stopEventListening();
      await this.connectionController.disconnect();

      // Clear speaking state when disconnecting
      this.eventHandlers.onSpeakingStateChanged?.(false);

      this.updateState({
        isJoined: false,
        isConnecting: false,
        participants: [],
        localParticipant: null,
        networkQuality: null,
        error: null,
      });

      logger.info('Agora streaming provider disconnected successfully');
    } catch (error) {
      logger.error('Error during Agora provider disconnect', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Clear speaking state even on error
      this.eventHandlers.onSpeakingStateChanged?.(false);

      // Still update state to reflect disconnection
      this.updateState({
        isJoined: false,
        isConnecting: false,
        participants: [],
        localParticipant: null,
      });
    }
  }

  async enableVideo(config?: VideoConfig): Promise<VideoTrack> {
    try {
      logger.info('Enabling video through Agora provider');
      return await this.videoController.enableVideo(config);
    } catch (error) {
      logger.error('Failed to enable video', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async disableVideo(): Promise<void> {
    try {
      logger.info('Disabling video through Agora provider');
      await this.videoController.disableVideo();
    } catch (error) {
      logger.error('Failed to disable video', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async playVideo(elementId: string): Promise<void> {
    try {
      logger.info('Playing video through Agora provider', { elementId });
      await this.videoController.playVideo(elementId);
    } catch (error) {
      logger.error('Failed to play video', {
        error: error instanceof Error ? error.message : String(error),
        elementId,
      });
      throw error;
    }
  }

  async stopVideo(): Promise<void> {
    try {
      logger.info('Stopping video through Agora provider');
      await this.videoController.stopVideo();
    } catch (error) {
      logger.error('Failed to stop video', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async enableAudio(config?: AudioConfig): Promise<AudioTrack> {
    try {
      logger.info('Enabling audio through Agora provider');
      return await this.audioController.enableAudio(config);
    } catch (error) {
      logger.error('Failed to enable audio', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async disableAudio(): Promise<void> {
    try {
      logger.info('Disabling audio through Agora provider');
      await this.audioController.disableAudio();
    } catch (error) {
      logger.error('Failed to disable audio', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async publishVideo(track: VideoTrack): Promise<void> {
    try {
      logger.info('Publishing video track', { trackId: track.id });

      // If this is an external ILocalVideoTrack, pass it to the controller
      if (track && typeof (track as unknown as { play?: unknown }).play === 'function') {
        await this.videoController.publishVideo(track as unknown as ILocalVideoTrack);
      } else {
        // Enable video with default configuration
        await this.videoController.enableVideo();
        await this.videoController.publishVideo();
      }
    } catch (error) {
      logger.error('Failed to publish video track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async unpublishVideo(): Promise<void> {
    try {
      logger.info('Unpublishing video track');
      await this.videoController.unpublishVideo();
    } catch (error) {
      logger.error('Failed to unpublish video track', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async publishAudio(track: AudioTrack): Promise<void> {
    try {
      logger.info('Publishing audio track', { trackId: track.id });

      // If this is an external track, we need to enable audio first
      // For now, we'll enable audio with default configuration
      await this.audioController.enableAudio();
      await this.audioController.publishAudio();
    } catch (error) {
      logger.error('Failed to publish audio track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async unpublishAudio(): Promise<void> {
    try {
      logger.info('Unpublishing audio track');
      await this.audioController.unpublishAudio();
    } catch (error) {
      logger.error('Failed to unpublish audio track', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async sendMessage(content: string): Promise<void> {
    try {
      const messageId = `msg-${Date.now()}`;

      await this.messageController.sendMessage(messageId, content);
    } catch (error) {
      logger.error('Failed to send message', {
        error: error instanceof Error ? error.message : String(error),
        contentLength: content.length,
      });
      throw error;
    }
  }

  async sendInterrupt(): Promise<void> {
    try {
      logger.info('Sending interrupt command');
      await this.messageController.interruptResponse();
    } catch (error) {
      logger.error('Failed to send interrupt', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Set avatar parameters (voice, background, etc.)
  async setAvatarParameters(metadata: Record<string, unknown>): Promise<void> {
    try {
      logger.info('Setting avatar parameters', { metadata });
      await this.messageController.setAvatarParameters(metadata);
    } catch (error) {
      logger.error('Failed to set avatar parameters', {
        error: error instanceof Error ? error.message : String(error),
        metadata,
      });
      throw error;
    }
  }

  // Audio processing methods
  async enableNoiseReduction(): Promise<void> {
    try {
      logger.info('Enabling noise reduction through Agora provider');
      await this.audioController.enableNoiseReduction();
    } catch (error) {
      logger.error('Failed to enable noise reduction', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async disableNoiseReduction(): Promise<void> {
    try {
      logger.info('Disabling noise reduction through Agora provider');
      await this.audioController.disableNoiseReduction();
      logger.info('Noise reduction disabled');
    } catch (error) {
      logger.error('Failed to disable noise reduction', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async dumpAudio(): Promise<void> {
    try {
      logger.info('Starting audio dump through Agora provider');

      // For now, we'll simulate the audio dump process
      // In a real implementation, this would capture and save audio data
      await new Promise((resolve) => setTimeout(resolve, 2000));

      logger.info('Audio dump completed');
    } catch (error) {
      logger.error('Failed to dump audio', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  updateState(partialState: Partial<StreamingState>): void {
    this._state = { ...this._state, ...partialState };

    logger.debug('Provider state updated', {
      changes: partialState,
      newState: this._state,
    });

    // Notify all subscribers
    this.stateSubscribers.forEach((callback) => {
      try {
        callback(this._state);
      } catch (error) {
        logger.error('Error in state subscriber callback', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  subscribe(callback: (state: StreamingState) => void): () => void {
    this.stateSubscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.stateSubscribers.delete(callback);
    };
  }

  private setupControllerCallbacks(): void {
    // Audio controller callbacks
    const audioCallbacks: AudioControllerCallbacks = {
      onAudioTrackPublished: (track) => {
        logger.debug('Audio track published', { trackId: track.id });
        // Update local participant audio tracks
        this.updateLocalParticipantAudioTracks([track]);
      },
      onAudioTrackUnpublished: (trackId) => {
        logger.debug('Audio track unpublished', { trackId });
        this.updateLocalParticipantAudioTracks([]);
      },
      onAudioError: (error) => {
        this.updateState({ error });
        this.eventHandlers.onError?.(error);
      },
    };

    // Video controller callbacks
    const videoCallbacks: VideoControllerCallbacks = {
      onVideoTrackPublished: (track) => {
        logger.debug('Video track published', { trackId: track.id });
        this.updateLocalParticipantVideoTracks([track]);
      },
      onVideoTrackUnpublished: (trackId) => {
        logger.debug('Video track unpublished', { trackId });
        this.updateLocalParticipantVideoTracks([]);
      },
      onVideoError: (error) => {
        this.updateState({ error });
        this.eventHandlers.onError?.(error);
      },
    };

    this.audioController.setCallbacks(audioCallbacks);
    this.videoController.setCallbacks(videoCallbacks);
    // Event, stats, participant, and message controller callbacks are set in startEventListening()
  }

  private startEventListening(): void {
    // Event controller callbacks
    const eventCallbacks: AgoraEventControllerCallbacks = {
      onParticipantJoined: (participant) => {
        const participants = [...this._state.participants];
        const existingIndex = participants.findIndex((p) => p.id === participant.id);

        if (existingIndex >= 0) {
          participants[existingIndex] = participant;
        } else {
          participants.push(participant);
        }

        this.updateState({ participants });
        this.eventHandlers.onParticipantJoined?.(participant);
      },
      onParticipantLeft: (participantId) => {
        const participants = this._state.participants.filter((p) => p.id !== participantId);
        this.updateState({ participants });
        this.eventHandlers.onParticipantLeft?.(participantId);
      },
      onConnectionQualityChanged: (quality) => {
        this.updateState({ networkQuality: quality });
        this.eventHandlers.onConnectionQualityChanged?.(quality);
      },
      onError: (error) => {
        const streamingError =
          error instanceof StreamingError ? error : new StreamingError(ErrorCode.UNKNOWN_ERROR, error.message);
        this.updateState({ error: streamingError });
        this.eventHandlers.onError?.(streamingError);
      },
      onSpeakingStateChanged: (isSpeaking) => {
        this.eventHandlers.onSpeakingStateChanged?.(isSpeaking);
      },
    };

    // Stats controller callbacks
    const statsCallbacks: StatsControllerCallbacks = {
      onNetworkStatsUpdate: (stats: NetworkStats) => {
        this.updateState({
          networkQuality: stats.connectionQuality,
          detailedNetworkStats: stats.detailedStats,
        });
      },
      onError: (error: Error) => {
        const streamingError =
          error instanceof StreamingError ? error : new StreamingError(ErrorCode.UNKNOWN_ERROR, error.message);
        this.updateState({ error: streamingError });
        this.eventHandlers.onError?.(streamingError);
      },
    };

    // Participant controller callbacks
    const participantCallbacks: ParticipantControllerCallbacks = {
      onParticipantJoined: (participant: Participant) => {
        const participants = [...this._state.participants];
        const existingIndex = participants.findIndex((p) => p.id === participant.id);

        if (existingIndex >= 0) {
          participants[existingIndex] = participant;
        } else {
          participants.push(participant);
        }

        this.updateState({ participants });
        this.eventHandlers.onParticipantJoined?.(participant);
      },
      onParticipantLeft: (participantId: string) => {
        const participants = this._state.participants.filter((p) => p.id !== participantId);
        this.updateState({ participants });
        this.eventHandlers.onParticipantLeft?.(participantId);
      },
      onError: (error: Error) => {
        const streamingError =
          error instanceof StreamingError ? error : new StreamingError(ErrorCode.UNKNOWN_ERROR, error.message);
        this.updateState({ error: streamingError });
        this.eventHandlers.onError?.(streamingError);
      },
    };

    // Message controller callbacks
    const messageCallbacks = {
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
          error instanceof StreamingError ? error : new StreamingError(ErrorCode.UNKNOWN_ERROR, error.message);
        this.updateState({ error: streamingError });
        this.eventHandlers.onError?.(streamingError);
      },
    };

    // Set up all controllers
    this.eventController.setCallbacks(eventCallbacks);
    this.statsController.setCallbacks(statsCallbacks);
    this.participantController.setCallbacks(participantCallbacks);
    this.messageController.setCallbacks(messageCallbacks);

    // Start event listening and stats collection
    this.eventController.setupEventListeners();
    this.statsController.startStatsCollection();
  }

  private stopEventListening(): void {
    this.eventController.removeEventListeners();
    this.statsController.stopStatsCollection();
    this.messageController.cleanup();
  }

  private mapCredentials(credentials: StreamingCredentials): SessionCredentials {
    // Type-safe extraction with defaults
    const agoraAppId = credentials.agora_app_id as string;
    const agoraChannel = credentials.agora_channel as string;
    const agoraToken = credentials.agora_token as string;
    const agoraUid = credentials.agora_uid as number;

    return {
      // Agora-specific credentials
      agora_app_id: agoraAppId,
      agora_channel: agoraChannel,
      agora_token: agoraToken,
      agora_uid: agoraUid,
    };
  }

  private updateLocalParticipantAudioTracks(audioTracks: AudioTrack[]): void {
    if (this._state.localParticipant) {
      const updatedParticipant = {
        ...this._state.localParticipant,
        audioTracks,
      };
      this.updateState({ localParticipant: updatedParticipant });
    }
  }

  private updateLocalParticipantVideoTracks(videoTracks: VideoTrack[]): void {
    if (this._state.localParticipant) {
      const updatedParticipant = {
        ...this._state.localParticipant,
        videoTracks,
      };
      this.updateState({ localParticipant: updatedParticipant });
    }
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Agora streaming provider');

      // Clear speaking state during cleanup
      this.eventHandlers.onSpeakingStateChanged?.(false);

      // Stop event listening
      this.stopEventListening();

      // Cleanup all controllers
      await Promise.all([
        this.connectionController.cleanup(),
        this.eventController.cleanup(),
        this.statsController.cleanup(),
        this.participantController.cleanup(),
        this.messageController.cleanup(),
        this.audioController.cleanup(),
        this.videoController.cleanup(),
      ]);

      // Clear subscribers
      this.stateSubscribers.clear();
      this.eventHandlers = {};

      logger.info('Agora streaming provider cleanup completed');
    } catch (error) {
      logger.error('Error during Agora provider cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
