import React from 'react';
import { RemoteVideoStrategy, RemoteVideoElement } from '../../common/strategies/RemoteVideoStrategy';

export class AgoraRemoteVideoStrategy implements RemoteVideoStrategy {
  createElement({
    isVisible,
    className = '',
    style = {},
  }: {
    isVisible: boolean;
    className?: string;
    style?: React.CSSProperties;
  }): React.ReactElement {
    return (
      <video
        id="remote-video"
        className={`${className} ${!isVisible ? 'hidden' : ''}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          zIndex: 10,
          backgroundColor: '#000',
          ...style,
        }}
        playsInline
        muted
      />
    );
  }

  monitorVideoState(elementId: string, onStateChange: (isPlaying: boolean) => void): () => void {
    const videoElement = document.getElementById(elementId) as HTMLVideoElement;
    if (!videoElement) return () => {};

    const updateVideoState = () => {
      const isPlaying = !videoElement.paused && videoElement.readyState >= 2;
      const hasContent = videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
      onStateChange(isPlaying && hasContent);
    };

    const handleVideoStop = () => onStateChange(false);

    // Listen to video events
    videoElement.addEventListener('canplay', updateVideoState);
    videoElement.addEventListener('playing', updateVideoState);
    videoElement.addEventListener('pause', handleVideoStop);
    videoElement.addEventListener('ended', handleVideoStop);
    videoElement.addEventListener('loadstart', handleVideoStop);

    // Initial state check
    updateVideoState();

    return () => {
      videoElement.removeEventListener('canplay', updateVideoState);
      videoElement.removeEventListener('playing', updateVideoState);
      videoElement.removeEventListener('pause', handleVideoStop);
      videoElement.removeEventListener('ended', handleVideoStop);
      videoElement.removeEventListener('loadstart', handleVideoStop);
    };
  }

  getElementInfo(elementId: string): RemoteVideoElement | null {
    const element = document.getElementById(elementId) as HTMLVideoElement;
    if (!element) return null;

    return {
      id: elementId,
      element,
      isVisible: !element.classList.contains('hidden'),
      hasVideoContent: element.videoWidth > 0 && element.videoHeight > 0,
    };
  }
}
