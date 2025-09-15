import { Room } from 'livekit-client';
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
import { StreamingError, ErrorCode } from '../../types/error.types';
import { SystemMessageEvent, ChatMessageEvent, CommandEvent } from '../../types/provider.interfaces';
import { ChatMessage } from '../../types/streaming.types';

// Import controllers
import { LiveKitConnectionController } from './controllers/LiveKitConnectionController';
import { LiveKitAudioController } from './controllers/LiveKitAudioController';
import { LiveKitVideoController } from './controllers/LiveKitVideoController';
import { LiveKitController, LiveKitControllerCallbacks } from './controllers/LiveKitController';
import { isLiveKitCredentials, LiveKitCredentials } from './types';

export interface LiveKitProviderConfig {
  room: Room;
}

export class LiveKitStreamingProvider implements StreamingProvider {
  public readonly providerType: StreamProviderType = 'livekit';

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
  private connectionController: LiveKitConnectionController;
  private liveKitController: LiveKitController;
  private audioController: LiveKitAudioController;
  private videoController: LiveKitVideoController;

  private room: Room;

  constructor(config: LiveKitProviderConfig) {
    this.room = config.room;

    // Initialize controllers
    this.connectionController = new LiveKitConnectionController(this.room);
    this.liveKitController = new LiveKitController(this.room);
    this.audioController = new LiveKitAudioController(this.room);
    this.videoController = new LiveKitVideoController(this.room);

    this.setupControllerCallbacks();

    // Register with resource manager for cleanup
    globalResourceManager.registerGlobal({
      cleanup: () => this.cleanup(),
      id: `livekit-provider-${Date.now()}`,
      type: 'LiveKitStreamingProvider',
    });
  }

  get state(): StreamingState {
    return { ...this._state };
  }

  async connect(credentials: StreamingCredentials, handlers?: StreamingEventHandlers): Promise<void> {
    try {
      logger.info('Connecting LiveKit streaming provider', {
        serverUrl: credentials.livekit_url,
        roomName: credentials.livekit_room_name,
      });

      this.updateState({ isConnecting: true, error: null });
      this.eventHandlers = handlers || {};

      // Map credentials to LiveKit format
      const liveKitCredentials = this.mapCredentials(credentials);

      await this.connectionController.connect(liveKitCredentials);

      // Start event listening
      this.startEventListening();

      this.updateState({
        isJoined: true,
        isConnecting: false,
        error: null,
      });

      logger.info('LiveKit streaming provider connected successfully');
    } catch (error) {
      const streamingError =
        error instanceof StreamingError ? error : new StreamingError(ErrorCode.CONNECTION_FAILED, 'Failed to connect');

      this.updateState({
        isConnecting: false,
        isJoined: false,
        error: streamingError,
      });

      logger.error('Failed to connect LiveKit streaming provider', {
        error: streamingError.message,
        code: streamingError.code,
      });

      throw streamingError;
    }
  }

  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting LiveKit streaming provider');

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

      logger.info('LiveKit streaming provider disconnected successfully');
    } catch (error) {
      logger.error('Error during LiveKit provider disconnect', {
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
      logger.info('Enabling video through LiveKit provider');
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
      logger.info('Disabling video through LiveKit provider');
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
      logger.info('Playing video through LiveKit provider', { elementId });
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
      logger.info('Stopping video through LiveKit provider');
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
      logger.info('Enabling audio through LiveKit provider');
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
      logger.info('Disabling audio through LiveKit provider');
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
      await this.videoController.publishVideo(track);
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
      await this.audioController.publishAudio(track);
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
      logger.debug('LiveKit provider sending message', { messageId, contentLength: content.length });
      await this.liveKitController.sendMessage(messageId, content);
      logger.info('Message sent successfully via LiveKit provider', { messageId });
    } catch (error) {
      logger.error('Failed to send message via LiveKit provider', {
        error: error instanceof Error ? error.message : String(error),
        contentLength: content.length,
        content: content.substring(0, 100), // Log first 100 chars for debugging
      });
      throw error;
    }
  }

  async sendInterrupt(): Promise<void> {
    try {
      logger.info('Sending interrupt command');
      await this.liveKitController.interruptResponse();
    } catch (error) {
      logger.error('Failed to send interrupt', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async setAvatarParameters(metadata: Record<string, unknown>): Promise<void> {
    try {
      logger.info('Setting avatar parameters', { metadata });
      await this.liveKitController.setAvatarParameters(metadata);
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
      logger.info('Enabling noise reduction through LiveKit provider');
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
      logger.info('Disabling noise reduction through LiveKit provider');
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
      logger.info('Starting audio dump through LiveKit provider');
      await this.audioController.dumpAudio();
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
    // Audio controller callbacks will be set here
    // Video controller callbacks will be set here
    // Main controller callbacks are set in startEventListening()
  }

  private startEventListening(): void {
    const eventCallbacks: LiveKitControllerCallbacks = {
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
      onNetworkStatsUpdate: (stats) => {
        // Store both connection quality and detailed stats
        this.updateState({
          networkQuality: stats.connectionQuality,
          detailedNetworkStats: stats.detailedStats,
        });
      },
      onMessageReceived: (message) => {
        this.eventHandlers.onMessageReceived?.(message as ChatMessage);
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
      // Command and messaging callbacks
      onSystemMessage: (event) => {
        this.eventHandlers.onSystemMessage?.(event as SystemMessageEvent);
      },
      onChatMessage: (event) => {
        this.eventHandlers.onChatMessage?.(event as ChatMessageEvent);
      },
      onCommand: (event) => {
        this.eventHandlers.onCommand?.(event as CommandEvent);
      },
    };

    this.liveKitController.setCallbacks(eventCallbacks);
  }

  private stopEventListening(): void {
    this.liveKitController.cleanup();
  }

  private mapCredentials(credentials: StreamingCredentials): LiveKitCredentials {
    if (!isLiveKitCredentials(credentials)) {
      throw new StreamingError(ErrorCode.INVALID_CREDENTIALS, 'Invalid LiveKit credentials format');
    }

    return credentials;
  }

  // Participant management methods would be used by controller callbacks
  // Currently commented out until callback system is fully implemented

  async cleanup(): Promise<void> {
    logger.info('Cleaning up LiveKit provider');

    try {
      // Stop event listening
      this.stopEventListening();

      // Cleanup controllers
      await Promise.all([
        this.audioController.cleanup(),
        this.videoController.cleanup(),
        this.connectionController.cleanup(),
        this.liveKitController.cleanup(),
      ]);

      // Clear state
      this.stateSubscribers.clear();
      this.eventHandlers = {};

      logger.info('LiveKit provider cleanup completed');
    } catch (error) {
      logger.error('Error during LiveKit provider cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
