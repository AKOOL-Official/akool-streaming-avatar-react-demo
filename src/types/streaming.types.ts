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
}

export interface Participant {
  id: string;
  displayName?: string;
  isLocal: boolean;
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  connectionQuality: ConnectionQuality;
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
