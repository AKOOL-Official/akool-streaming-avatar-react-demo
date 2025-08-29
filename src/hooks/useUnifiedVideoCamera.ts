import { useState, useCallback, useRef, useEffect } from 'react';
import { useAgora } from '../contexts/AgoraContext';
import { useLiveKit } from '../contexts/LiveKitContext';
import { StreamProviderType, VideoTrack } from '../types/streamingProvider';
import { useMediaStrategy } from '../strategies';

interface UseUnifiedVideoCameraReturn {
  cameraEnabled: boolean;
  localVideoTrack: VideoTrack | null;
  cameraError: string | null;
  enableCamera: () => Promise<void>;
  disableCamera: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export const useUnifiedVideoCamera = (streamType: StreamProviderType): UseUnifiedVideoCameraReturn => {
  const { client } = useAgora();
  const { room } = useLiveKit();
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState<VideoTrack | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoTrackRef = useRef<VideoTrack | null>(null);
  
  const mediaStrategy = useMediaStrategy(streamType, client, room);

  const enableCamera = useCallback(async () => {
    try {
      setCameraError(null);

      // Check if we already have a track
      if (videoTrackRef.current) {
        await mediaStrategy.video.enableVideoTrack(videoTrackRef.current);
        setLocalVideoTrack(videoTrackRef.current);
        setCameraEnabled(true);
        return;
      }

      // Create new camera video track - this should work even when not connected
      const videoTrack = await mediaStrategy.video.createVideoTrack();

      // Store the track and update state immediately for local preview
      videoTrackRef.current = videoTrack;
      setLocalVideoTrack(videoTrack);
      setCameraEnabled(true);
      
      // Try to enable the track (this might publish if connected)
      try {
        await mediaStrategy.video.enableVideoTrack(videoTrack);
      } catch (enableError) {
        // Non-critical error for local preview
      }
    } catch (error) {
      console.error('Failed to enable camera:', error);

      let errorMessage = 'Failed to access camera';
      if (error instanceof Error) {
        if (error.message.includes('Permission denied')) {
          errorMessage = 'Camera permission denied';
        } else if (error.message.includes('NotFoundError')) {
          errorMessage = 'No camera device found';
        } else if (error.message.includes('NotReadableError')) {
          errorMessage = 'Camera is being used by another application';
        }
      }

      setCameraError(errorMessage);
      setCameraEnabled(false);
      setLocalVideoTrack(null);
    }
  }, [mediaStrategy]);

  const disableCamera = useCallback(async () => {
    try {
      if (videoTrackRef.current) {
        await mediaStrategy.video.disableVideoTrack(videoTrackRef.current);
      }

      setCameraEnabled(false);
      setLocalVideoTrack(null);
      setCameraError(null);
    } catch (error) {
      console.error('Failed to disable camera:', error);
    }
  }, [mediaStrategy]);

  const toggleCamera = useCallback(async () => {
    if (cameraEnabled) {
      await disableCamera();
    } else {
      await enableCamera();
    }
  }, [cameraEnabled, enableCamera, disableCamera]);

  // Cleanup function to properly close the track
  const cleanup = useCallback(async () => {
    try {
      if (videoTrackRef.current) {
        mediaStrategy.video.stopVideoTrack(videoTrackRef.current);
        mediaStrategy.video.closeVideoTrack(videoTrackRef.current);
        videoTrackRef.current = null;
      }
      setLocalVideoTrack(null);
      setCameraEnabled(false);
      setCameraError(null);
    } catch (error) {
      console.error('Failed to cleanup camera track:', error);
    }
  }, [mediaStrategy]);

  // Note: We don't auto-cleanup camera when connection is lost
  // since camera can be used for local preview even without connection

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    cameraEnabled,
    localVideoTrack,
    cameraError,
    enableCamera,
    disableCamera,
    toggleCamera,
    cleanup,
  };
};
