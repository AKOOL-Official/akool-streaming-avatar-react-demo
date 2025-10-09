import React, { useRef } from 'react';
import { DraggableOverlay } from '../../shared';
import { AvatarContent } from '../MainVideoArea/AvatarContent';
import './styles.css';

export interface VideoOverlayProps {
  isViewSwitched: boolean;
  isRemoteVideoPlaying: boolean;
  avatarVideoUrl: string;
  isPlaceholderVideoLoading: boolean;
  placeholderVideoError: boolean;
  onViewSwitch: (e: React.MouseEvent) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  className?: string;
  style?: React.CSSProperties;
}

export const VideoOverlay: React.FC<VideoOverlayProps> = ({
  isViewSwitched,
  isRemoteVideoPlaying,
  avatarVideoUrl,
  isPlaceholderVideoLoading,
  placeholderVideoError,
  onViewSwitch,
  containerRef,
  className = '',
  style = {},
}) => {
  const localVideoRef = useRef<HTMLDivElement>(null);

  const handlePositionChange = () => {
    // Position change handled by DraggableOverlay
  };

  const handleSizeChange = () => {
    // Size change handled by DraggableOverlay
  };

  // Calculate initial position for bottom-right corner
  const getInitialPosition = () => {
    if (!containerRef.current) {
      return { x: 0, y: 0 };
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const overlayWidth = 200; // initialSize.width
    const overlayHeight = 150; // initialSize.height

    // Position in bottom-right corner with some margin
    const margin = 20;
    const x = containerRect.width - overlayWidth - margin;
    const y = containerRect.height - overlayHeight - margin;

    return { x: Math.max(0, x), y: Math.max(0, y) };
  };

  const overlayClasses = ['video-overlay', isViewSwitched && 'switching', className].filter(Boolean).join(' ');

  return (
    <DraggableOverlay
      containerRef={containerRef}
      initialPosition={getInitialPosition()}
      initialSize={{ width: 200, height: 150 }}
      minSize={{ width: 160, height: 120 }}
      maxSize={{ width: 500, height: 400 }}
      onPositionChange={handlePositionChange}
      onSizeChange={handleSizeChange}
      onClick={onViewSwitch}
      className={overlayClasses}
      style={style}
      enableDrag={true}
      enableResize={true}
      showHandles={true}
      tooltipText="Click to switch views"
    >
      <div ref={localVideoRef} id="local-video-overlay" className="local-video-container">
        {isViewSwitched && (
          // When switched, show avatar in the overlay
          <>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <AvatarContent
                avatarVideoUrl={avatarVideoUrl}
                isRemoteVideoPlaying={isRemoteVideoPlaying}
                isPlaceholderVideoLoading={isPlaceholderVideoLoading}
                placeholderVideoError={placeholderVideoError}
              />
            </div>
            <div
              id="remote-video-overlay"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: isRemoteVideoPlaying ? 'block' : 'none',
              }}
            />
          </>
        )}
      </div>
    </DraggableOverlay>
  );
};

export default VideoOverlay;
