import React from 'react';
import './styles.css';

export type PlaceholderType = 'empty' | 'loading' | 'error';

export interface PlaceholderDisplayProps {
  type: PlaceholderType;
  message?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const PlaceholderDisplay: React.FC<PlaceholderDisplayProps> = ({
  type,
  message,
  className = '',
  style = {},
}) => {
  const getPlaceholderContent = () => {
    switch (type) {
      case 'empty':
        return {
          icon: '🤖',
          defaultMessage: 'No image or video for avatar',
          iconSize: '48px',
        };
      case 'loading':
        return {
          icon: '⏳',
          defaultMessage: 'Loading avatar...',
          iconSize: '32px',
        };
      case 'error':
        return {
          icon: '⚠️',
          defaultMessage: 'Failed to load avatar',
          iconSize: '48px',
        };
      default:
        return {
          icon: '🤖',
          defaultMessage: 'No content available',
          iconSize: '48px',
        };
    }
  };

  const { icon, defaultMessage, iconSize } = getPlaceholderContent();
  const displayMessage = message || defaultMessage;

  const containerClasses = ['placeholder-display', `placeholder-${type}`, className].filter(Boolean).join(' ');

  return (
    <div className={containerClasses} style={style}>
      <div className="placeholder-icon" style={{ fontSize: iconSize }}>
        {icon}
      </div>
      {type === 'loading' && <div className="loading-spinner" />}
      <div className="placeholder-message">{displayMessage}</div>
    </div>
  );
};

export default PlaceholderDisplay;
