import React from 'react';
import { RemoteVideo } from './RemoteVideo';
import { AvatarContent } from './AvatarContent';
import { SpeakingIndicator } from '../../shared';
import './styles.css';

export interface MainVideoAreaProps {
  isViewSwitched: boolean;
  isRemoteVideoPlaying: boolean;
  isAvatarSpeaking: boolean;
  avatarVideoUrl: string;
  isPlaceholderVideoLoading: boolean;
  placeholderVideoError: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const MainVideoArea: React.FC<MainVideoAreaProps> = ({
  isViewSwitched,
  isRemoteVideoPlaying,
  isAvatarSpeaking,
  avatarVideoUrl,
  isPlaceholderVideoLoading,
  placeholderVideoError,
  className = '',
  style = {},
}) => {
  if (isViewSwitched) {
    // When switched, show local camera in main area
    return (
      <div className={`main-video-area switched ${className}`} style={style}>
        <RemoteVideo isVisible={false} />
        <div
          id="main-local-video"
          style={{ width: '100%', height: '100%', background: '#000', position: 'relative', zIndex: 1 }}
        >
          {/* Local video will be played here via effect */}
        </div>
      </div>
    );
  }

  // Normal mode - show avatar content
  return (
    <div className={`main-video-area normal ${className}`} style={style}>
      <RemoteVideo isVisible={isRemoteVideoPlaying} />

      <AvatarContent
        avatarVideoUrl={avatarVideoUrl}
        isRemoteVideoPlaying={isRemoteVideoPlaying}
        isPlaceholderVideoLoading={isPlaceholderVideoLoading}
        placeholderVideoError={placeholderVideoError}
      />

      <SpeakingIndicator isVisible={isAvatarSpeaking} />
    </div>
  );
};

export default MainVideoArea;
