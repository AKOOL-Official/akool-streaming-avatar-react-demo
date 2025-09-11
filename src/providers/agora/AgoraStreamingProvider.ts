import { ILocalVideoTrack } from 'agora-rtc-sdk-ng';
import { RTCClient } from '../../agoraHelper';
import { logger } from '../../core/Logger';
import { globalResourceManager } from '../../core/ResourceManager';
import { StreamingProvider, StreamingCredentials, StreamingEventHandlers } from '../../types/provider.interfaces';
import { StreamingState, VideoTrack, AudioTrack, StreamProviderType } from '../../types/streaming.types';
import { AvatarMetadata, Session, SessionCredentials } from '../../types/api.schemas';
import { StreamingError, ErrorCode } from '../../types/error.types';

// Import controllers
import {
  AgoraConnectionController,
  AgoraConnectionConfig,
  ConnectionEventCallbacks,
} from './controllers/AgoraConnectionController';
import { AgoraEventController, AgoraEventCallbacks } from './controllers/AgoraEventController';
import { AgoraMessagingController, MessagingEventCallbacks } from './controllers/AgoraMessagingController';
import { AgoraAudioController, AudioControllerCallbacks } from './controllers/AgoraAudioController';
import { AgoraVideoController, VideoControllerCallbacks } from './controllers/AgoraVideoController';

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
  private messagingController: AgoraMessagingController;
  private audioController: AgoraAudioController;
  private videoController: AgoraVideoController;

  private client: RTCClient;
  private currentSession: Session | null = null;

  constructor(config: AgoraProviderConfig) {
    this.client = config.client;
    this.currentSession = config.session || null;

    // Initialize controllers
    this.connectionController = new AgoraConnectionController(this.client);
    this.eventController = new AgoraEventController(this.client);
    this.messagingController = new AgoraMessagingController(this.client);
    this.audioController = new AgoraAudioController(this.client);
    this.videoController = new AgoraVideoController(this.client);

    this.setupControllerCallbacks();

    // Register with resource manager for cleanup
    globalResourceManager.registerGlobal({
      cleanup: () => this.cleanup(),
      id: `agora-provider-${Date.now()}`,
      type: 'AgoraStreamingProvider',
    });

    logger.info('AgoraStreamingProvider initialized', {
      providerType: this.providerType,
      hasSession: !!this.currentSession,
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

      // Create session if not provided
      const session = this.currentSession || this.createTemporarySession(agoraCredentials);

      const connectionConfig: AgoraConnectionConfig = {
        credentials: agoraCredentials,
        session,
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

      // Still update state to reflect disconnection
      this.updateState({
        isJoined: false,
        isConnecting: false,
        participants: [],
        localParticipant: null,
      });
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
      logger.info('Sending message to avatar', { messageId, contentLength: content.length });

      await this.messagingController.sendMessage(messageId, content);
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
      await this.messagingController.interruptResponse();
    } catch (error) {
      logger.error('Failed to send interrupt', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Set avatar parameters (voice, background, etc.)
  async setAvatarParameters(metadata: AvatarMetadata): Promise<void> {
    try {
      logger.info('Setting avatar parameters', { metadata });
      await this.messagingController.setAvatarParameters(metadata);
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

    // Messaging controller callbacks
    const messagingCallbacks: MessagingEventCallbacks = {
      onCommandSent: (cmd, data) => {
        logger.debug('Command sent to avatar', { command: cmd, data });
      },
      onCommandResponse: (cmd, code, message) => {
        logger.debug('Command response received', { command: cmd, code, message });
      },
    };

    this.audioController.setCallbacks(audioCallbacks);
    this.videoController.setCallbacks(videoCallbacks);
    this.messagingController.setCallbacks(messagingCallbacks);
  }

  private startEventListening(): void {
    const eventCallbacks: AgoraEventCallbacks = {
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
    };

    this.eventController.startListening(eventCallbacks);
  }

  private stopEventListening(): void {
    this.eventController.stopListening();
  }

  private mapCredentials(credentials: StreamingCredentials): SessionCredentials {
    return {
      // Common credentials
      channel: credentials.channelName,
      userId: credentials.userId,

      // Agora-specific credentials
      agora_app_id: credentials.agora_app_id as string,
      agora_channel: (credentials.agora_channel as string) || credentials.channelName,
      agora_token: credentials.agora_token as string,
      agora_uid: (credentials.agora_uid as number) || parseInt(credentials.userId),
    };
  }

  private createTemporarySession(credentials: SessionCredentials): Session {
    return {
      _id: `temp-session-${Date.now()}`,
      credentials,
      provider: 'agora',
      status: 'active',
      created_at: Date.now(),
      expires_at: Date.now() + 60 * 60 * 1000, // 1 hour
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

      // Stop event listening
      this.stopEventListening();

      // Cleanup all controllers
      await Promise.all([
        this.connectionController.cleanup(),
        this.eventController.cleanup(),
        this.messagingController.cleanup(),
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
