import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VideoTrack } from '../../types/streaming.types';
import { useStreamingContext } from '../../hooks/useStreamingContext';
import { useProviderAwareRemoteVideoState } from '../../hooks/useProviderAwareRemoteVideoState';
import { MainVideoArea } from './MainVideoArea';
import { VideoOverlay } from './VideoOverlay';
import './styles.css';
import { logger } from '../../core';

interface VideoDisplayProps {
  isJoined: boolean;
  avatarVideoUrl: string;
  localVideoTrack: VideoTrack | null;
  cameraEnabled: boolean;
}

const VideoDisplay: React.FC<VideoDisplayProps> = ({ isJoined, avatarVideoUrl, localVideoTrack, cameraEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isAvatarSpeaking, provider, providerType } = useStreamingContext();

  // State for view switching
  const [isViewSwitched, setIsViewSwitched] = useState(false);

  // Remote video state management
  const { isRemoteVideoPlaying } = useProviderAwareRemoteVideoState({
    isJoined,
    videoElementId: 'remote-video',
  });

  // State for placeholder video loading
  const [isPlaceholderVideoLoading, setIsPlaceholderVideoLoading] = useState(false);
  const [placeholderVideoError, setPlaceholderVideoError] = useState(false);

  const isImageUrl = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  // View switching handler
  const handleViewSwitch = useCallback(() => {
    setIsViewSwitched(!isViewSwitched);
  }, [isViewSwitched]);

  // Handle local video track playback based on view switching
  useEffect(() => {
    if (localVideoTrack && cameraEnabled && provider) {
      try {
        // Always stop the track first to avoid conflicts
        provider.stopVideo().catch((error: unknown) => {
          logger.error('Failed to stop video track:', { error });
        });

        // Add a small delay to ensure the stop operation completes
        setTimeout(() => {
          try {
            if (!isViewSwitched) {
              // Normal mode, local video in overlay
              const localVideoRef = document.getElementById('local-video-overlay');
              if (localVideoRef) {
                provider.playVideo(localVideoRef.id).catch((error: unknown) => {
                  logger.error('Failed to play local video track in overlay:', { error });
                });
              }
            } else {
              // When switched, local video goes to a main video element
              const mainLocalVideo = document.getElementById('main-local-video');
              if (mainLocalVideo) {
                provider.playVideo('main-local-video').catch((error: unknown) => {
                  logger.error('Failed to play local video track in main view:', { error });
                });
              }
            }
          } catch (error) {
            logger.error('Failed to play local video track after delay:', { error });
          }
        }, 50);
      } catch (error) {
        logger.error('Failed to stop local video track:', { error });
      }
    }

    // Cleanup when track is removed, camera is disabled, or component unmounts
    return () => {
      if (provider) {
        try {
          provider.stopVideo().catch((error: unknown) => {
            logger.error('Failed to stop local video track in cleanup:', { error });
          });
        } catch (error) {
          logger.error('Failed to stop local video track in cleanup:', { error });
        }
      }
    };
  }, [localVideoTrack, cameraEnabled, isViewSwitched, provider]);

  // Additional cleanup when camera is disabled
  useEffect(() => {
    if (!cameraEnabled && localVideoTrack && provider) {
      try {
        // Use provider-agnostic video track stop
        provider.stopVideo();
      } catch (error) {
        logger.error('Failed to stop video track when camera disabled:', { error });
      }
    }
  }, [cameraEnabled, localVideoTrack, provider]);

  // Monitor placeholder video loading state
  useEffect(() => {
    const placeholderVideo = document.getElementById('placeholder-video') as HTMLVideoElement;
    if (!placeholderVideo || !avatarVideoUrl || isImageUrl(avatarVideoUrl)) return;

    const handleLoadStart = () => {
      setIsPlaceholderVideoLoading(true);
      setPlaceholderVideoError(false);
    };

    const handleCanPlay = () => {
      setIsPlaceholderVideoLoading(false);
      setPlaceholderVideoError(false);
    };

    const handleError = () => {
      setIsPlaceholderVideoLoading(false);
      setPlaceholderVideoError(true);
    };

    placeholderVideo.addEventListener('loadstart', handleLoadStart);
    placeholderVideo.addEventListener('canplay', handleCanPlay);
    placeholderVideo.addEventListener('error', handleError);

    return () => {
      placeholderVideo.removeEventListener('loadstart', handleLoadStart);
      placeholderVideo.removeEventListener('canplay', handleCanPlay);
      placeholderVideo.removeEventListener('error', handleError);
    };
  }, [avatarVideoUrl]);

  // Reset placeholder video state when URL changes
  useEffect(() => {
    if (!avatarVideoUrl) {
      setIsPlaceholderVideoLoading(false);
      setPlaceholderVideoError(false);
    } else if (!isImageUrl(avatarVideoUrl)) {
      setIsPlaceholderVideoLoading(true);
      setPlaceholderVideoError(false);
    }
  }, [avatarVideoUrl]);

  return (
    <div ref={containerRef} className="video-container">
      <MainVideoArea
        isViewSwitched={isViewSwitched}
        isRemoteVideoPlaying={isRemoteVideoPlaying}
        isAvatarSpeaking={isAvatarSpeaking}
        avatarVideoUrl={avatarVideoUrl}
        isPlaceholderVideoLoading={isPlaceholderVideoLoading}
        placeholderVideoError={placeholderVideoError}
        providerType={providerType}
      />

      {cameraEnabled && localVideoTrack && (
        <VideoOverlay
          isViewSwitched={isViewSwitched}
          isRemoteVideoPlaying={isRemoteVideoPlaying}
          avatarVideoUrl={avatarVideoUrl}
          isPlaceholderVideoLoading={isPlaceholderVideoLoading}
          placeholderVideoError={placeholderVideoError}
          onViewSwitch={handleViewSwitch}
          containerRef={containerRef}
        />
      )}
    </div>
  );
};

export default VideoDisplay;
