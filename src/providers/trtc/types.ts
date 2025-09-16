import { StreamingCredentials } from '../../types/provider.interfaces';
import { StreamingError } from '../../types/error.types';
import { AudioTrack, VideoTrack } from '../../types/streaming.types';

export interface TRTCCredentials extends StreamingCredentials {
  trtc_app_id: number;
  trtc_room_id: string;
  trtc_user_id: string;
  trtc_user_sig: string;
}

export function isTRTCCredentials(credentials: unknown): credentials is TRTCCredentials {
  const creds = credentials as TRTCCredentials;
  return !!(creds?.trtc_app_id && creds?.trtc_room_id && creds?.trtc_user_id && creds?.trtc_user_sig);
}

export interface TRTCConfig {
  enableAutoSubscribe?: boolean;
  enableAutoPublish?: boolean;
  enableSmallVideoStream?: boolean;
  videoProfile?: string;
  audioProfile?: string;
}

// Controller callback interfaces
export interface TRTCAudioControllerCallbacks {
  onAudioTrackPublished?: (track: AudioTrack) => void;
  onAudioTrackUnpublished?: (trackId: string) => void;
  onAudioError?: (error: StreamingError) => void;
  onVolumeChange?: (volume: number) => void;
}

export interface TRTCVideoControllerCallbacks {
  onVideoTrackPublished?: (track: VideoTrack) => void;
  onVideoTrackUnpublished?: (trackId: string) => void;
  onVideoError?: (error: StreamingError) => void;
  onVideoResize?: (width: number, height: number) => void;
}

export interface TRTCConnectionControllerCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
  onError?: (error: StreamingError) => void;
}

export interface TRTCEventControllerCallbacks {
  onParticipantJoined?: (participant: import('../../types/streaming.types').Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onParticipantVideoEnabled?: (participantId: string, enabled: boolean) => void;
  onParticipantAudioEnabled?: (participantId: string, enabled: boolean) => void;
  onError?: (error: StreamingError) => void;
}

export interface TRTCParticipantControllerCallbacks {
  onParticipantAdded?: (participant: import('../../types/streaming.types').Participant) => void;
  onParticipantRemoved?: (participantId: string) => void;
  onParticipantUpdated?: (participant: import('../../types/streaming.types').Participant) => void;
  onError?: (error: StreamingError) => void;
}

export interface TRTCStatsControllerCallbacks {
  onNetworkStatsUpdate?: (stats: import('../../components/NetworkQuality').NetworkStats) => void;
  onLocalStatsUpdate?: (stats: any) => void;
  onRemoteStatsUpdate?: (userId: string, stats: any) => void;
  onError?: (error: StreamingError) => void;
}

// TRTC SDK v5 interfaces (simplified for implementation)
export interface TRTCParams {
  sdkAppId: number;
  roomId?: number;
  strRoomId?: string;
  userId: string;
  userSig: string;
  role?: number;
  privateMapKey?: string;
}

export interface TRTCVideoStreamType {
  Main: number;
  Sub: number;
}

export interface TRTCNetworkQuality {
  userId: string;
  txQuality: number;
  rxQuality: number;
  delay: number;
  lossRate: number;
}

export interface TRTCLocalStatistics {
  width: number;
  height: number;
  frameRate: number;
  videoBitrate: number;
  audioSampleRate: number;
  audioBitrate: number;
  streamType: number;
}

export interface TRTCRemoteStatistics {
  userId: string;
  finalLoss: number;
  width: number;
  height: number;
  frameRate: number;
  videoBitrate: number;
  audioSampleRate: number;
  audioBitrate: number;
  streamType: number;
  jitterBufferDelay: number;
  audioTotalBlockTime: number;
  videoTotalBlockTime: number;
  audioBlockRate: number;
  videoBlockRate: number;
}

export interface TRTCSpeedTestResult {
  success: boolean;
  errMsg: string;
  ip: string;
  quality: number;
  upLostRate: number;
  downLostRate: number;
  rtt: number;
  availableUpBandwidth: number;
  availableDownBandwidth: number;
}

// TRTC Event types
export interface TRTCEvent {
  TRTCVideoStreamTypeBig: number;
  TRTCVideoStreamTypeSmall: number;
  TRTCVideoStreamTypeSub: number;
}

export interface TRTCQualityInfo {
  userId: string;
  quality: number;
}

export interface TRTCVolumeInfo {
  userId: string;
  volume: number;
}
