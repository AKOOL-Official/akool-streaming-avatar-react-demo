import {
  StreamingState,
  VideoTrack,
  AudioTrack,
  VideoConfig,
  AudioConfig,
  ChatMessage,
  Participant,
  ConnectionQuality,
  StreamProviderType,
} from './streaming.types';
import { StreamingError } from './error.types';

// Generic streaming credentials interface
export interface StreamingCredentials {
  [key: string]: unknown;
}

// Message event types for provider-agnostic messaging
export interface SystemMessageEvent {
  messageId: string;
  text: string;
  eventType:
    | 'avatar_audio_start'
    | 'avatar_audio_end'
    | 'set_params'
    | 'set_params_ack'
    | 'interrupt'
    | 'interrupt_ack';
  metadata?: Record<string, unknown>;
}

export interface ChatMessageEvent {
  messageId: string;
  text: string;
  from: 'user' | 'avatar';
}

export interface CommandEvent {
  command: string;
  data?: Record<string, unknown>;
  success?: boolean;
  message?: string;
}

export interface StreamingEventHandlers {
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onConnectionQualityChanged?: (quality: ConnectionQuality) => void;
  onError?: (error: StreamingError) => void;
  onMessageReceived?: (message: ChatMessage) => void;
  onSpeakingStateChanged?: (isSpeaking: boolean) => void;
  onSystemMessage?: (event: SystemMessageEvent) => void;
  onChatMessage?: (event: ChatMessageEvent) => void;
  onCommand?: (event: CommandEvent) => void;
}

export interface StreamingProvider {
  readonly providerType: StreamProviderType;
  readonly state: StreamingState;

  // Connection management
  connect(credentials: StreamingCredentials, handlers?: StreamingEventHandlers): Promise<void>;
  disconnect(): Promise<void>;

  // Media management
  enableVideo(config?: VideoConfig): Promise<VideoTrack>;
  disableVideo(): Promise<void>;
  playVideo(elementId: string): Promise<void>;
  stopVideo(): Promise<void>;
  publishVideo(track: VideoTrack): Promise<void>;
  unpublishVideo(): Promise<void>;
  enableAudio(config?: AudioConfig): Promise<AudioTrack>;
  disableAudio(): Promise<void>;
  publishAudio(track: AudioTrack): Promise<void>;
  unpublishAudio(): Promise<void>;

  // Communication
  sendMessage(content: string): Promise<void>;
  sendInterrupt(): Promise<void>;
  setAvatarParameters(metadata: Record<string, unknown>): Promise<void>;

  // Audio processing
  enableNoiseReduction(): Promise<void>;
  disableNoiseReduction(): Promise<void>;
  dumpAudio(): Promise<void>;

  // State management
  updateState(partialState: Partial<StreamingState>): void;
  subscribe(callback: (state: StreamingState) => void): () => void;
}

export interface MediaStrategy {
  readonly audio: AudioStrategy;
  readonly video: VideoStrategy;
}

export interface AudioStrategy {
  createTrack(constraints?: MediaTrackConstraints): Promise<AudioTrack>;
  publishTrack(track: AudioTrack): Promise<void>;
  unpublishTrack(track: AudioTrack): Promise<void>;
  setVolume(track: AudioTrack, volume: number): Promise<void>;
  enableTrack(track: AudioTrack): Promise<void>;
  disableTrack(track: AudioTrack): Promise<void>;
}

export interface VideoStrategy {
  createTrack(constraints?: MediaTrackConstraints): Promise<VideoTrack>;
  publishTrack(track: VideoTrack): Promise<void>;
  unpublishTrack(track: VideoTrack): Promise<void>;
  playTrack(track: VideoTrack, element: HTMLElement): Promise<void>;
  stopTrack(track: VideoTrack): Promise<void>;
}
