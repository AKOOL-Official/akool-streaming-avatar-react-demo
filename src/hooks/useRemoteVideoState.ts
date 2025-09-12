import { useState, useEffect, useCallback } from 'react';
import { logger } from '../core/Logger';

interface UseRemoteVideoStateOptions {
  isJoined: boolean;
  videoElementId: string;
}

export const useRemoteVideoState = ({ isJoined, videoElementId }: UseRemoteVideoStateOptions) => {
  const [isRemoteVideoPlaying, setIsRemoteVideoPlaying] = useState(false);

  const updateVideoState = useCallback((videoElement: HTMLVideoElement) => {
    const isPlaying = !videoElement.paused && videoElement.readyState >= 2;
    const hasContent = videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
    const shouldShow = isPlaying && hasContent;

    setIsRemoteVideoPlaying(shouldShow);

    if (shouldShow) {
      logger.info('Remote video is ready and displaying');
    }
  }, []);

  const handleVideoStop = useCallback(() => {
    setIsRemoteVideoPlaying(false);
  }, []);

  // Monitor remote video playing state
  useEffect(() => {
    const remoteVideo = document.getElementById(videoElementId) as HTMLVideoElement;
    if (!remoteVideo) return;

    const handleVideoEvents = () => {
      updateVideoState(remoteVideo);
    };

    // Listen to video events
    remoteVideo.addEventListener('canplay', handleVideoEvents);
    remoteVideo.addEventListener('playing', handleVideoEvents);
    remoteVideo.addEventListener('pause', handleVideoStop);
    remoteVideo.addEventListener('ended', handleVideoStop);
    remoteVideo.addEventListener('loadstart', handleVideoStop);

    // Initial state check
    updateVideoState(remoteVideo);

    return () => {
      remoteVideo.removeEventListener('canplay', handleVideoEvents);
      remoteVideo.removeEventListener('playing', handleVideoEvents);
      remoteVideo.removeEventListener('pause', handleVideoStop);
      remoteVideo.removeEventListener('ended', handleVideoStop);
      remoteVideo.removeEventListener('loadstart', handleVideoStop);
    };
  }, [isJoined, videoElementId, updateVideoState, handleVideoStop]);

  // Reset state when stream disconnects
  useEffect(() => {
    if (!isJoined) {
      setIsRemoteVideoPlaying(false);
      logger.info('Stream disconnected, switching back to local video');
    }
  }, [isJoined]);

  return {
    isRemoteVideoPlaying,
    setIsRemoteVideoPlaying,
  };
};
