import { IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { LocalAudioTrack } from 'livekit-client';
import { VideoTrack } from '../types/streamingProvider';

// Audio track union type
export type AudioTrack = IMicrophoneAudioTrack | LocalAudioTrack;

// Audio strategy interface
export interface AudioStrategy {
  isConnected(): boolean;
  createAudioTrack(): Promise<AudioTrack>;
  publishAudioTrack(track: AudioTrack): Promise<void>;
  unpublishAudioTrack(track: AudioTrack): Promise<void>;
  stopAudioTrack(track: AudioTrack): void;
  closeAudioTrack(track: AudioTrack): void;
}

// Video strategy interface
export interface VideoStrategy {
  isConnected(): boolean;
  createVideoTrack(): Promise<VideoTrack>;
  enableVideoTrack(track: VideoTrack): Promise<void>;
  disableVideoTrack(track: VideoTrack): Promise<void>;
  stopVideoTrack(track: VideoTrack): void;
  closeVideoTrack(track: VideoTrack): void;
  playVideoTrack(track: VideoTrack, element: HTMLElement): void;
  stopVideoPlayback(track: VideoTrack): void;
}

// Combined strategy interface
export interface MediaStrategy {
  audio: AudioStrategy;
  video: VideoStrategy;
}
