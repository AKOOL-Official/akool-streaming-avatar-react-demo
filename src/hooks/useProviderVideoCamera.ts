import { useState, useCallback, useRef } from 'react';
import { VideoTrack } from '../types/streaming.types';
import { useStreamingContext } from '../contexts/StreamingContext';
import { logger } from '../core/Logger';

export interface UseProviderVideoCameraReturn {
  cameraEnabled: boolean;
  localVideoTrack: VideoTrack | null;
  cameraError: string | null;
  enableCamera: () => Promise<void>;
  disableCamera: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export const useProviderVideoCamera = (): UseProviderVideoCameraReturn => {
  const { provider, publishVideo, unpublishVideo } = useStreamingContext();

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState<VideoTrack | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoTrackRef = useRef<unknown | null>(null); // Provider-specific track object

  const enableCamera = useCallback(async () => {
    if (!provider) {
      const error = 'No provider available for video controls';
      logger.error(error);
      setCameraError(error);
      return;
    }

    try {
      setCameraError(null);
      logger.info('Enabling camera through provider', { providerType: provider.providerType });

      // Check if we already have a track
      if (videoTrackRef.current && localVideoTrack) {
        // Re-enable existing track
        const updatedTrack: VideoTrack = {
          ...localVideoTrack,
          enabled: true,
        };

        setLocalVideoTrack(updatedTrack);
        await publishVideo(updatedTrack);
        setCameraEnabled(true);
        logger.info('Camera re-enabled successfully');
        return;
      }

      // Create new video track through provider
      // TODO: Implement provider-specific video track creation
      const track: VideoTrack = {
        id: `video-${Date.now()}`,
        kind: 'video',
        enabled: true,
        muted: false,
        source: 'camera',
      };

      setLocalVideoTrack(track);
      await publishVideo(track);
      setCameraEnabled(true);

      logger.info('Camera enabled successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown camera error';
      logger.error('Failed to enable camera', { error });
      setCameraError(errorMessage);
      throw error;
    }
  }, [provider, localVideoTrack, publishVideo]);

  const disableCamera = useCallback(async () => {
    try {
      logger.info('Disabling camera through provider');

      if (localVideoTrack) {
        await unpublishVideo();

        const updatedTrack: VideoTrack = {
          ...localVideoTrack,
          enabled: false,
        };
        setLocalVideoTrack(updatedTrack);
      }

      setCameraEnabled(false);
      logger.info('Camera disabled successfully');
    } catch (error) {
      logger.error('Failed to disable camera', { error });
      throw error;
    }
  }, [localVideoTrack, unpublishVideo]);

  const toggleCamera = useCallback(async () => {
    try {
      if (cameraEnabled) {
        await disableCamera();
      } else {
        await enableCamera();
      }
    } catch (error) {
      logger.error('Failed to toggle camera', { error });
      // Don't re-throw here to prevent UI from breaking
    }
  }, [cameraEnabled, enableCamera, disableCamera]);

  const cleanup = useCallback(async () => {
    try {
      logger.info('Cleaning up video camera');

      if (cameraEnabled && localVideoTrack) {
        await unpublishVideo();
      }

      // Stop and close the video track
      // TODO: Implement provider-specific track cleanup

      setCameraEnabled(false);
      setLocalVideoTrack(null);
      setCameraError(null);
      videoTrackRef.current = null;

      logger.info('Video camera cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup video camera', { error });
    }
  }, [cameraEnabled, localVideoTrack, unpublishVideo]);

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
