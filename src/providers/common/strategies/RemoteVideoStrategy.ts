import React from 'react';

export interface RemoteVideoElement {
  id: string;
  element: HTMLElement;
  isVisible: boolean;
  hasVideoContent: boolean;
}

export interface RemoteVideoStrategy {
  createElement(props: { isVisible: boolean; className?: string; style?: React.CSSProperties }): React.ReactElement;

  monitorVideoState(elementId: string, onStateChange: (isPlaying: boolean) => void): () => void;

  getElementInfo(elementId: string): RemoteVideoElement | null;
}
