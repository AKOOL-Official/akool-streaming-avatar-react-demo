import React from 'react';
import './styles.css';

export interface TooltipProps {
  content: string | React.ReactNode;
  position: { x: number; y: number };
  visible: boolean;
  maxWidth?: number;
  variant?: 'default' | 'code' | 'help';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position,
  visible,
  maxWidth = 400,
  variant = 'default',
}) => {
  if (!visible || !content) return null;

  const tooltipClasses = ['tooltip', variant !== 'default' && `tooltip-${variant}`].filter(Boolean).join(' ');

  return (
    <div
      className={tooltipClasses}
      style={{
        position: 'fixed',
        left: position.x + 10,
        top: position.y - 10,
        zIndex: 9999,
        maxWidth: `${maxWidth}px`,
      }}
    >
      <div className="tooltip-content">
        {typeof content === 'string' ? variant === 'code' ? <pre>{content}</pre> : content : content}
      </div>
    </div>
  );
};

export default Tooltip;
