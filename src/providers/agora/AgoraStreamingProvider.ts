import { ILocalVideoTrack } from 'agora-rtc-sdk-ng';
import { logger } from '../../core/Logger';
import { globalResourceManager } from '../../core/ResourceManager';
import { StreamingProvider, StreamingCredentials, StreamingEventHandlers } from '../../types/provider.interfaces';
import { StreamingState, VideoTrack, AudioTrack, VideoConfig, StreamProviderType } from '../../types/streaming.types';
import { AvatarMetadata, Session, SessionCredentials } from '../../types/api.schemas';
import { StreamingError, ErrorCode } from '../../types/error.types';

// Import controllers
import {
  AgoraConnectionController,
  AgoraConnectionConfig,
  ConnectionEventCallbacks,
} from './controllers/AgoraConnectionController';
import { AgoraController, AgoraControllerCallbacks } from './controllers/AgoraController';
import { AgoraAudioController, AudioControllerCallbacks } from './controllers/AgoraAudioController';
import { AgoraVideoController, VideoControllerCallbacks } from './controllers/AgoraVideoController';
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
  private agoraController: AgoraController;
  private audioController: AgoraAudioController;
  private videoController: AgoraVideoController;

  private client: RTCClient;

  constructor(config: AgoraProviderConfig) {
    this.client = config.client;

    // Initialize controllers
    this.connectionController = new AgoraConnectionController(this.client);
    this.agoraController = new AgoraController(this.client);
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
      logger.info('Connecting Agora streaming provider', {
        channelName: credentials.channelName,
        userId: credentials.userId,
      });

      this.updateState({ isConnecting: true, error: null });
      this.eventHandlers = handlers || {};

      // Map credentials to Agora format
      const agoraCredentials = this.mapCredentials(credentials);

      const connectionConfig: AgoraConnectionConfig = {
        credentials: agoraCredentials,
      };

      const connectionCallbacks: ConnectionEventCallbacks = {
        onConnected: () => {
          this.updateState({
            isJoined: true,
            isConnecting: false,
            error: null,
          });

          // Start event listening
          this.startEventListening();
        },
        onDisconnected: (reason) => {
          this.updateState({
            isJoined: false,
            isConnecting: false,
            participants: [],
            localParticipant: null,
          });

          this.stopEventListening();
          logger.info('Agora provider disconnected', { reason });
        },
        onConnectionFailed: (error) => {
          this.updateState({
            isConnecting: false,
            isJoined: false,
            error,
          });
          this.eventHandlers.onError?.(error);
        },
        onTokenWillExpire: () => {
          logger.warn('Agora token will expire soon');
          // Could implement token refresh logic here
        },
        onTokenDidExpire: () => {
          const error = new StreamingError(ErrorCode.INVALID_CREDENTIALS, 'Agora token has expired');
          this.updateState({ error });
          this.eventHandlers.onError?.(error);
        },
      };

      await this.connectionController.connect(connectionConfig, connectionCallbacks);

      logger.info('Agora streaming provider connected successfully');
    } catch (error) {
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
      await this.audioController.enableAudio();
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
      await this.audioController.disableAudio();
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

      await this.agoraController.sendMessage(messageId, content);
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
      await this.agoraController.interruptResponse();
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
      await this.agoraController.setAvatarParameters(metadata as unknown as AvatarMetadata);
    } catch (error) {
      logger.error('Failed to set avatar parameters', {
        error: error instanceof Error ? error.message : String(error),
        metadata,
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
    // AgoraController callbacks are set in startEventListening()
  }

  private startEventListening(): void {
    const eventCallbacks: AgoraControllerCallbacks = {
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
      onMessageReceived: (message) => {
        this.eventHandlers.onMessageReceived?.(message);
      },
      onError: (error) => {
        this.updateState({ error });
        this.eventHandlers.onError?.(error);
      },
      onSpeakingStateChanged: (isSpeaking) => {
        this.eventHandlers.onSpeakingStateChanged?.(isSpeaking);
      },
      // Command and messaging callbacks
      onSystemMessage: (event) => {
        this.eventHandlers.onSystemMessage?.(event);
      },
      onChatMessage: (event) => {
        this.eventHandlers.onChatMessage?.(event);
      },
      onCommand: (event) => {
        this.eventHandlers.onCommand?.(event);
      },
    };

    this.agoraController.setCallbacks(eventCallbacks);
  }

  private stopEventListening(): void {
    this.agoraController.cleanup();
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
        this.agoraController.cleanup(),
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
