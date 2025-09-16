import React from 'react';
import { RemoteVideoStrategy, RemoteVideoElement } from '../../common/strategies/RemoteVideoStrategy';

export class TRTCRemoteVideoStrategy implements RemoteVideoStrategy {
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
      <div
        id="remote-video"
        className={`${className} ${!isVisible ? 'hidden' : ''}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 10,
          backgroundColor: '#000',
          ...style,
        }}
      />
    );
  }

  monitorVideoState(elementId: string, onStateChange: (isPlaying: boolean) => void): () => void {
    const containerElement = document.getElementById(elementId) as HTMLElement;
    if (!containerElement) return () => {};

    const updateVideoState = () => {
      const isVisible = !containerElement.classList.contains('hidden');
      const hasVideoContent = containerElement.querySelector('video') !== null;
      onStateChange(isVisible && hasVideoContent);
    };

    // Use MutationObserver to watch for changes in the div content
    const observer = new MutationObserver(updateVideoState);

    // Observe changes to the div and its children
    observer.observe(containerElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    // Initial state check
    updateVideoState();

    return () => {
      observer.disconnect();
    };
  }

  getElementInfo(elementId: string): RemoteVideoElement | null {
    const element = document.getElementById(elementId) as HTMLElement;
    if (!element) return null;

    const isVisible = !element.classList.contains('hidden');
    const hasVideoContent = element.querySelector('video') !== null;

    return {
      id: elementId,
      element,
      isVisible,
      hasVideoContent,
    };
  }
}
