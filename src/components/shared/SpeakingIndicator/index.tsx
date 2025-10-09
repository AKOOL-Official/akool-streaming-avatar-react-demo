import React from 'react';
import './styles.css';

export interface SpeakingIndicatorProps {
  isVisible?: boolean;
  text?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const SpeakingIndicator: React.FC<SpeakingIndicatorProps> = ({
  isVisible = true,
  text = 'Speaking...',
  className = '',
  style = {},
}) => {
  if (!isVisible) return null;

  const containerClasses = ['speaking-indicator', className].filter(Boolean).join(' ');

  return (
    <div className={containerClasses} style={style}>
      <div className="speaking-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span className="speaking-text">{text}</span>
    </div>
  );
};

export default SpeakingIndicator;
