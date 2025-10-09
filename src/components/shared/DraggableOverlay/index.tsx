import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DragHandle } from './DragHandle';
import { ResizeHandle } from './ResizeHandle';
import './styles.css';

export interface DraggableOverlayProps {
  children: React.ReactNode;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
  containerRef?: React.RefObject<HTMLElement>;
  onPositionChange?: (position: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  enableDrag?: boolean;
  enableResize?: boolean;
  showHandles?: boolean;
  tooltipText?: string;
}

export const DraggableOverlay: React.FC<DraggableOverlayProps> = ({
  children,
  initialPosition = { x: 0, y: 0 },
  initialSize = { width: 200, height: 150 },
  minSize = { width: 160, height: 120 },
  maxSize = { width: 500, height: 400 },
  containerRef,
  onPositionChange,
  onSizeChange,
  onDragStart,
  onDragEnd,
  onResizeStart,
  onResizeEnd,
  onClick,
  className = '',
  style = {},
  enableDrag = true,
  enableResize = true,
  showHandles = true,
  tooltipText = 'Click to interact',
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [justFinishedOperation, setJustFinishedOperation] = useState(false);

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!overlayRef.current || !containerRef?.current) return;

      const overlay = overlayRef.current;
      const overlayRect = overlay.getBoundingClientRect();

      setIsDragging(true);
      setDragOffset({
        x: e.clientX - overlayRect.left,
        y: e.clientY - overlayRect.top,
      });

      onDragStart?.();
      e.preventDefault();
      e.stopPropagation();
    },
    [containerRef, onDragStart],
  );

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (!overlayRef.current || !containerRef?.current) return;

      const overlay = overlayRef.current;

      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: overlay.offsetWidth,
        height: overlay.offsetHeight,
      });

      onResizeStart?.();
      e.preventDefault();
      e.stopPropagation();
    },
    [containerRef, onResizeStart],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!overlayRef.current || !containerRef?.current) return;

      const container = containerRef.current;
      const overlay = overlayRef.current;
      const containerRect = container.getBoundingClientRect();

      if (isDragging) {
        const newX = e.clientX - containerRect.left - dragOffset.x;
        const newY = e.clientY - containerRect.top - dragOffset.y;

        // Constrain within container bounds
        const maxX = container.offsetWidth - overlay.offsetWidth;
        const maxY = container.offsetHeight - overlay.offsetHeight;

        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));

        overlay.style.left = `${constrainedX}px`;
        overlay.style.top = `${constrainedY}px`;
        overlay.style.right = 'auto';
        overlay.style.bottom = 'auto';

        onPositionChange?.({ x: constrainedX, y: constrainedY });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        const newWidth = Math.max(minSize.width, Math.min(maxSize.width, resizeStart.width + deltaX));
        const newHeight = Math.max(minSize.height, Math.min(maxSize.height, resizeStart.height + deltaY));

        overlay.style.width = `${newWidth}px`;
        overlay.style.height = `${newHeight}px`;

        onSizeChange?.({ width: newWidth, height: newHeight });
      }
    },
    [isDragging, isResizing, dragOffset, resizeStart, containerRef, minSize, maxSize, onPositionChange, onSizeChange],
  );

  const handleMouseUp = useCallback(() => {
    const wasDraggingOrResizing = isDragging || isResizing;

    if (isDragging) {
      onDragEnd?.();
    }
    if (isResizing) {
      onResizeEnd?.();
    }

    setIsDragging(false);
    setIsResizing(false);

    // If we were dragging or resizing, prevent click events for a short time
    if (wasDraggingOrResizing) {
      setJustFinishedOperation(true);
      setTimeout(() => setJustFinishedOperation(false), 100);
    }
  }, [isDragging, isResizing, onDragEnd, onResizeEnd]);

  // Handle mouse events for dragging and resizing
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }

    // Return undefined when condition is false
    return undefined;
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Handle click with operation prevention
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (justFinishedOperation || isDragging || isResizing) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    },
    [justFinishedOperation, isDragging, isResizing, onClick],
  );

  const overlayClasses = ['draggable-overlay', isDragging && 'dragging', isResizing && 'resizing', className]
    .filter(Boolean)
    .join(' ');

  const overlayStyle = {
    left: `${initialPosition.x}px`,
    top: `${initialPosition.y}px`,
    width: `${initialSize.width}px`,
    height: `${initialSize.height}px`,
    ...style,
  };

  return (
    <div ref={overlayRef} className={overlayClasses} style={overlayStyle} onClick={handleClick}>
      {showHandles && enableDrag && <DragHandle onMouseDown={handleDragStart} />}
      {showHandles && enableResize && <ResizeHandle onMouseDown={handleResizeStart} />}
      {tooltipText && <div className="overlay-tooltip">{tooltipText}</div>}
      <div className="draggable-content">{children}</div>
    </div>
  );
};

export default DraggableOverlay;
