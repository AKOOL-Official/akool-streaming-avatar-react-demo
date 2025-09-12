import React from 'react';

export interface RemoteVideoProps {
  isVisible: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const RemoteVideo: React.FC<RemoteVideoProps> = ({ isVisible, className = '', style = {} }) => {
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
};

export default RemoteVideo;
