import React from 'react';
import { PlaceholderDisplay, PlaceholderType } from '../../shared';

export interface AvatarContentProps {
  avatarVideoUrl: string;
  isRemoteVideoPlaying: boolean;
  isPlaceholderVideoLoading: boolean;
  placeholderVideoError: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const AvatarContent: React.FC<AvatarContentProps> = ({
  avatarVideoUrl,
  isRemoteVideoPlaying,
  isPlaceholderVideoLoading,
  placeholderVideoError,
  className = '',
  style = {},
}) => {
  const isImageUrl = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  const getPlaceholderType = (): PlaceholderType | null => {
    if (!avatarVideoUrl) return 'empty';
    if (placeholderVideoError) return 'error';
    return null;
  };

  const placeholderType = getPlaceholderType();

  return (
    <div
      className={`avatar-content ${className}`}
      style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1, ...style }}
    >
      {placeholderType ? (
        <div hidden={isRemoteVideoPlaying}>
          <PlaceholderDisplay type={placeholderType} />
        </div>
      ) : isImageUrl(avatarVideoUrl) ? (
        <img
          id="placeholder-image"
          hidden={isRemoteVideoPlaying}
          src={avatarVideoUrl}
          alt="Avatar placeholder"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <>
          <video
            id="placeholder-video"
            hidden={isRemoteVideoPlaying}
            src={avatarVideoUrl}
            loop
            muted
            playsInline
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
          {isPlaceholderVideoLoading && !isRemoteVideoPlaying && <PlaceholderDisplay type="loading" />}
        </>
      )}
    </div>
  );
};

export default AvatarContent;
