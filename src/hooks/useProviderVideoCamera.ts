import { useState, useCallback, useRef } from 'react';
import { VideoTrack } from '../types/streaming.types';
import { useStreamingContext } from './useStreamingContext';
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
  const { provider } = useStreamingContext();

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

      // Check if we already have a track and it's enabled
      if (videoTrackRef.current && localVideoTrack && cameraEnabled) {
        logger.debug('Camera already enabled');
        return;
      }

      // Create new video track through provider's video controller
      const track = await provider.enableVideo();

      setLocalVideoTrack(track);
      setCameraEnabled(true);
      videoTrackRef.current = track;

      logger.info('Camera enabled successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown camera error';
      logger.error('Failed to enable camera', { error });
      setCameraError(errorMessage);
      throw error;
    }
  }, [provider, localVideoTrack, cameraEnabled]);

  const disableCamera = useCallback(async () => {
    try {
      logger.info('Disabling camera through provider');

      if (provider && cameraEnabled) {
        await provider.disableVideo();
      }

      setCameraEnabled(false);
      setLocalVideoTrack(null);
      videoTrackRef.current = null;

      logger.info('Camera disabled successfully');
    } catch (error) {
      logger.error('Failed to disable camera', { error });
      throw error;
    }
  }, [provider, cameraEnabled]);

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

      if (provider && cameraEnabled) {
        await provider.disableVideo();
      }

      setCameraEnabled(false);
      setLocalVideoTrack(null);
      setCameraError(null);
      videoTrackRef.current = null;

      logger.info('Video camera cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup video camera', { error });
    }
  }, [provider, cameraEnabled]);

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
