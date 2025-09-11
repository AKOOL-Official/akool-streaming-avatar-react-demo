import {
  StreamingState,
  VideoTrack,
  AudioTrack,
  ChatMessage,
  Participant,
  ConnectionQuality,
  StreamProviderType,
} from './streaming.types';
import { StreamingError } from './error.types';

export interface StreamingCredentials {
  channelName: string;
  userId: string;
  [key: string]: unknown; // Provider-specific credentials
}

export interface StreamingEventHandlers {
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onConnectionQualityChanged?: (quality: ConnectionQuality) => void;
  onError?: (error: StreamingError) => void;
  onMessageReceived?: (message: ChatMessage) => void;
  onSpeakingStateChanged?: (isSpeaking: boolean) => void;
}

export interface StreamingProvider {
  readonly providerType: StreamProviderType;
  readonly state: StreamingState;

  // Connection management
  connect(credentials: StreamingCredentials, handlers?: StreamingEventHandlers): Promise<void>;
  disconnect(): Promise<void>;

  // Media management
  publishVideo(track: VideoTrack): Promise<void>;
  unpublishVideo(): Promise<void>;
  publishAudio(track: AudioTrack): Promise<void>;
  unpublishAudio(): Promise<void>;

  // Communication
  sendMessage(content: string): Promise<void>;
  sendInterrupt(): Promise<void>;

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
