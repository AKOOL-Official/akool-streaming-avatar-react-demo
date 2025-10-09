import React from 'react';
import './styles.css';

export interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  title?: string;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  onMouseDown,
  onClick,
  className = '',
  title = 'Drag to resize',
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e);
  };

  return <div className={`resize-handle ${className}`} onMouseDown={onMouseDown} onClick={handleClick} title={title} />;
};

export default ResizeHandle;
