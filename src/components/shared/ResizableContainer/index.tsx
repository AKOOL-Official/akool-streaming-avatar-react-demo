import React, { useCallback, useEffect, useState } from 'react';
import './styles.css';

export interface ResizableContainerProps {
  children: React.ReactNode;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  onHeightChange?: (height: number) => void;
  className?: string;
  resizeDirection?: 'vertical' | 'horizontal' | 'both';
  showResizeText?: boolean;
}

export const ResizableContainer: React.FC<ResizableContainerProps> = ({
  children,
  initialHeight = 400,
  minHeight = 200,
  maxHeight,
  onHeightChange,
  className = '',
  resizeDirection: _resizeDirection = 'vertical', // Currently only vertical resize is supported
  showResizeText = true,
}) => {
  const [height, setHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);

  const effectiveMaxHeight = maxHeight || window.innerHeight - 40;

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      setStartY(e.clientY);
      setStartHeight(height);
    },
    [height],
  );

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaY = startY - e.clientY;
      const newHeight = Math.max(minHeight, Math.min(effectiveMaxHeight, startHeight + deltaY));
      setHeight(newHeight);
      onHeightChange?.(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, startY, startHeight, minHeight, effectiveMaxHeight, onHeightChange]);

  // Handle window resize to adjust max height
  useEffect(() => {
    const handleWindowResize = () => {
      const newMaxHeight = window.innerHeight - 40;
      if (height > newMaxHeight) {
        const newHeight = newMaxHeight;
        setHeight(newHeight);
        onHeightChange?.(newHeight);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [height, onHeightChange]);

  const containerClasses = ['resizable-container', isResizing && 'resizing', className].filter(Boolean).join(' ');

  return (
    <div className={containerClasses} style={{ height: `${height}px` }}>
      <div
        className="resize-handle"
        onMouseDown={handleMouseDown}
        title={`Drag to resize (current height: ${height}px)`}
      >
        <div className="resize-indicator"></div>
        <div className="resize-dots">
          <span>•</span>
          <span>•</span>
          <span>•</span>
        </div>
        {showResizeText && <div className="resize-text">↕ Drag to resize</div>}
      </div>
      <div className="resizable-content">{children}</div>
    </div>
  );
};

export default ResizableContainer;
