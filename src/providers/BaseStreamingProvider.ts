import { StreamingProvider, StreamingEventHandlers, StreamingCredentials } from '../types/provider.interfaces';
import {
  StreamingState,
  StreamProviderType,
  VideoTrack,
  AudioTrack,
  VideoConfig,
  AudioConfig,
} from '../types/streaming.types';
import { EventBus } from '../core/EventBus';
import { logger } from '../core/Logger';
import { globalResourceManager } from '../core/ResourceManager';

export abstract class BaseStreamingProvider implements StreamingProvider {
  public abstract readonly providerType: StreamProviderType;

  protected _state: StreamingState;
  protected eventBus = new EventBus();
  protected eventHandlers: StreamingEventHandlers = {};

  constructor() {
    this._state = this.getInitialState();
    this.setupResourceCleanup();
  }

  get state(): StreamingState {
    return this._state;
  }

  // Abstract methods that must be implemented by concrete providers
  abstract connect(credentials: StreamingCredentials, handlers?: StreamingEventHandlers): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract enableVideo(config?: VideoConfig): Promise<VideoTrack>;
  abstract disableVideo(): Promise<void>;
  abstract playVideo(elementId: string): Promise<void>;
  abstract stopVideo(): Promise<void>;
  abstract publishVideo(track: VideoTrack): Promise<void>;
  abstract unpublishVideo(): Promise<void>;
  abstract enableAudio(config?: AudioConfig): Promise<AudioTrack>;
  abstract disableAudio(): Promise<void>;
  abstract publishAudio(track: AudioTrack): Promise<void>;
  abstract unpublishAudio(): Promise<void>;
  abstract sendMessage(content: string): Promise<void>;
  abstract sendInterrupt(): Promise<void>;
  abstract setAvatarParameters(metadata: Record<string, unknown>): Promise<void>;
  abstract enableNoiseReduction(): Promise<void>;
  abstract disableNoiseReduction(): Promise<void>;
  abstract dumpAudio(): Promise<void>;

  // Common implementation for all providers
  updateState(partialState: Partial<StreamingState>): void {
    const previousState = this._state;
    this._state = { ...this._state, ...partialState };

    logger.debug('Provider state updated', {
      provider: this.providerType,
      changes: this.getStateChanges(previousState, this._state),
    });

    this.eventBus.publish('system:info', {
      message: 'Provider state updated',
      context: { provider: this.providerType, changes: this.getStateChanges(previousState, this._state) },
    });
    this.notifyEventHandlers(previousState, this._state);
  }

  subscribe(callback: (state: StreamingState) => void): () => void {
    return this.eventBus.subscribe('system:info', (data) => {
      if (data.message === 'Provider state updated') {
        callback(this._state);
      }
    });
  }

  protected registerEventHandlers(handlers: StreamingEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };

    // Set up internal event forwarding
    this.eventBus.subscribe('participant:joined', (data) => this.eventHandlers.onParticipantJoined?.(data.participant));
    this.eventBus.subscribe('participant:left', (data) => this.eventHandlers.onParticipantLeft?.(data.participantId));
    this.eventBus.subscribe('system:error', (data) => this.eventHandlers.onError?.(data.error));
    this.eventBus.subscribe('message:received', (data) => this.eventHandlers.onMessageReceived?.(data.message));
    this.eventBus.subscribe('participant:speaking-changed', (data) =>
      this.eventHandlers.onSpeakingStateChanged?.(data.isSpeaking),
    );
    this.eventBus.subscribe('connection:quality-changed', (data) =>
      this.eventHandlers.onConnectionQualityChanged?.(data.quality),
    );
  }

  protected notifyEventHandlers(previousState: StreamingState, currentState: StreamingState): void {
    // Notify about connection state changes
    if (previousState.isJoined !== currentState.isJoined) {
      if (currentState.isJoined) {
        logger.info('Provider connected', { provider: this.providerType });
      } else {
        logger.info('Provider disconnected', { provider: this.providerType });
      }
    }

    // Notify about error changes
    if (previousState.error !== currentState.error && currentState.error) {
      this.eventHandlers.onError?.(currentState.error);
    }

    // Notify about speaking state changes
    if (previousState.isSpeaking !== currentState.isSpeaking) {
      this.eventHandlers.onSpeakingStateChanged?.(currentState.isSpeaking);
    }

    // Notify about network quality changes
    if (previousState.networkQuality !== currentState.networkQuality && currentState.networkQuality) {
      this.eventHandlers.onConnectionQualityChanged?.(currentState.networkQuality);
    }
  }

  protected getInitialState(): StreamingState {
    return {
      isJoined: false,
      isConnecting: false,
      isSpeaking: false,
      participants: [],
      localParticipant: null,
      networkQuality: null,
      error: null,
    };
  }

  protected setupResourceCleanup(): void {
    globalResourceManager.register(this, {
      cleanup: async () => {
        if (this._state.isJoined) {
          await this.disconnect();
        }
        this.eventBus.clear();
      },
    });
  }

  private getStateChanges(prev: StreamingState, current: StreamingState): Record<string, unknown> {
    const changes: Record<string, unknown> = {};

    Object.keys(current).forEach((key) => {
      if (prev[key as keyof StreamingState] !== current[key as keyof StreamingState]) {
        changes[key] = {
          from: prev[key as keyof StreamingState],
          to: current[key as keyof StreamingState],
        };
      }
    });

    return changes;
  }
}
