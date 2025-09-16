import { useState, useEffect } from 'react';
import { logger } from '../core/Logger';
import { useStreamingContext } from './useStreamingContext';
import { RemoteVideoStrategyFactory } from '../providers/common/strategies';

interface UseProviderAwareRemoteVideoStateOptions {
  isJoined: boolean;
  videoElementId: string;
}

export const useProviderAwareRemoteVideoState = ({
  isJoined,
  videoElementId,
}: UseProviderAwareRemoteVideoStateOptions) => {
  const [isRemoteVideoPlaying, setIsRemoteVideoPlaying] = useState(false);
  const { providerType } = useStreamingContext();

  // Monitor remote video playing state using strategy pattern
  useEffect(() => {
    const strategy = RemoteVideoStrategyFactory.getStrategy(providerType);

    const handleStateChange = (isPlaying: boolean) => {
      setIsRemoteVideoPlaying(isPlaying);

      if (isPlaying) {
        logger.info('Remote video is ready and displaying', { providerType });
      } else {
        logger.info('Remote video stopped, showing placeholder', { providerType });
      }
    };

    const cleanup = strategy.monitorVideoState(videoElementId, handleStateChange);

    return cleanup;
  }, [isJoined, videoElementId, providerType]);

  // Reset state when stream disconnects
  useEffect(() => {
    if (!isJoined) {
      setIsRemoteVideoPlaying(false);
      logger.info('Stream disconnected, switching back to placeholder');
    }
  }, [isJoined]);

  return {
    isRemoteVideoPlaying,
    setIsRemoteVideoPlaying,
  };
};
