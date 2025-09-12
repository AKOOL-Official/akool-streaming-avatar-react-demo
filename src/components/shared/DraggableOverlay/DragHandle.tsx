import React from 'react';
import './styles.css';

export interface DragHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  title?: string;
}

export const DragHandle: React.FC<DragHandleProps> = ({
  onMouseDown,
  onClick,
  className = '',
  title = 'Drag to move',
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e);
  };

  return <div className={`drag-handle ${className}`} onMouseDown={onMouseDown} onClick={handleClick} title={title} />;
};

export default DragHandle;
