import { StreamingError } from './error.types';

export type StreamProviderType = 'agora' | 'livekit' | 'trtc';

export interface VideoTrack {
  id: string;
  kind: 'video';
  enabled: boolean;
  muted: boolean;
  source?: 'camera' | 'screen';
}

export interface AudioTrack {
  id: string;
  kind: 'audio';
  enabled: boolean;
  muted: boolean;
  volume: number;
}

export interface VideoConfig {
  width?: number;
  height?: number;
  frameRate?: number;
  bitrate?: number;
  facingMode?: 'user' | 'environment';
  deviceId?: string;
}

export interface AudioConfig {
  encoderConfig?: string;
  enableAEC?: boolean;
  enableANS?: boolean;
  enableAGC?: boolean;
  quality?: string;
  volume?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  // Unified AI Denoiser configuration
  aiDenoiser?: AIDenoiserConfig;
}

// Unified callback interface for all audio controllers
export interface AudioControllerCallbacks {
  onAudioTrackPublished?: (track: AudioTrack) => void;
  onAudioTrackUnpublished?: (trackId: string) => void;
  onAudioError?: (error: StreamingError) => void;
  onVolumeChange?: (volume: number) => void;
}

// Unified AI Denoiser types
export type AIDenoiserMode = 'nsng' | 'stationary' | 'default' | 'far-field' | 'nc' | 'bvc' | 'bvc-telephony';

export interface AIDenoiserConfig {
  enabled: boolean;
  mode?: AIDenoiserMode;
  assetsPath?: string; // For TRTC CDN assets
  processingMode?: 'frontend' | 'backend'; // For LiveKit (frontend vs backend processing)
  // Provider-specific credentials (optional)
  credentials?: {
    sdkAppId?: number;
    userId?: string;
    userSig?: string;
  };
}

export interface AIDenoiserState {
  isEnabled: boolean;
  mode: AIDenoiserMode;
  isInitialized: boolean;
}

export interface Participant {
  id: string;
  name?: string;
  displayName?: string;
  isLocal: boolean;
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  connectionQuality: ConnectionQuality;
  isSpeaking: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
  hasScreenShare?: boolean;
  isConnected?: boolean;
  audioLevel?: number;
  networkQuality?: {
    uplink: number;
    downlink: number;
  };
  joinedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ConnectionQuality {
  score: number; // 0-100
  uplink: 'excellent' | 'good' | 'fair' | 'poor';
  downlink: 'excellent' | 'good' | 'fair' | 'poor';
  rtt: number; // round trip time in ms
  packetLoss: number; // percentage
}

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: number;
  fromParticipant: string;
  type: 'text' | 'system';
}

export interface StreamingState {
  isJoined: boolean;
  isConnecting: boolean;
  isSpeaking: boolean;
  participants: Participant[];
  localParticipant: Participant | null;
  networkQuality: ConnectionQuality | null;
  detailedNetworkStats?: {
    video?: {
      codec?: string;
      bitrate?: number;
      frameRate?: number;
      resolution?: { width: number; height: number };
      packetLoss?: number;
      rtt?: number;
    };
    audio?: {
      codec?: string;
      bitrate?: number;
      packetLoss?: number;
      volume?: number;
      rtt?: number;
    };
  };
  error: StreamingError | null;
}
