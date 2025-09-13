// LiveKit-specific credential types
export interface LiveKitCredentials {
  livekit_url: string;
  livekit_token: string;
  livekit_room_name: string;
  livekit_server_identity?: string;
  livekit_client_identity?: string;
}

// Type guard for LiveKit credentials
export function isLiveKitCredentials(credentials: unknown): credentials is LiveKitCredentials {
  const creds = credentials as LiveKitCredentials;
  return !!(creds?.livekit_url && creds?.livekit_token && creds?.livekit_room_name);
}

// LiveKit-specific configuration types
export interface LiveKitConfig {
  adaptiveStream?: boolean;
  dynacast?: boolean;
  videoCaptureDefaults?: {
    resolution: {
      width: number;
      height: number;
      frameRate: number;
    };
  };
}

// Controller callback interfaces
export interface LiveKitAudioControllerCallbacks {
  onAudioTrackPublished?: (track: AudioTrack) => void;
  onAudioTrackUnpublished?: (trackId: string) => void;
  onAudioError?: (error: Error) => void;
}

export interface LiveKitVideoControllerCallbacks {
  onVideoTrackPublished?: (track: VideoTrack) => void;
  onVideoTrackUnpublished?: (trackId: string) => void;
  onVideoError?: (error: Error) => void;
}

export interface LiveKitConnectionControllerCallbacks {
  onConnectionStateChanged?: (state: string) => void;
  onConnectionError?: (error: Error) => void;
}

// Import shared types
import { AudioTrack, VideoTrack } from '../../types/streaming.types';
import { Room } from 'livekit-client';

// LiveKit provider configuration
export interface LiveKitProviderConfig {
  room: Room;
}
