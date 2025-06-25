import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SplitPaneProps {
  /**
   * Content for the left pane
   */
  left: React.ReactNode;
  /**
   * Content for the right pane
   */
  right: React.ReactNode;
  /**
   * Initial split position as percentage (0-100)
   * @default 50
   */
  initialSplit?: number;
  /**
   * Minimum width for left pane in pixels
   * @default 200
   */
  minLeftWidth?: number;
  /**
   * Minimum width for right pane in pixels
   * @default 200
   */
  minRightWidth?: number;
  /**
   * Callback when split position changes
   */
  onSplitChange?: (position: number) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Resizable split pane component for side-by-side layouts
 * 
 * @example
 * <SplitPane
 *   left={<div>Left content</div>}
 *   right={<div>Right content</div>}
 *   initialSplit={60}
 *   onSplitChange={(pos) => console.log('Split at', pos)}
 * />
 */
export const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  initialSplit = 50,
  minLeftWidth = 200,
  minRightWidth = 200,
  onSplitChange,
  className,
}) => {
  const [splitPosition, setSplitPosition] = useState(initialSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartSplit = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Handle mouse down on divider
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartSplit.current = splitPosition;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const containerWidth = containerRef.current!.offsetWidth;
      const deltaX = e.clientX - dragStartX.current;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newSplit = dragStartSplit.current + deltaPercent;

      // Calculate min/max based on pixel constraints
      const minSplit = (minLeftWidth / containerWidth) * 100;
      const maxSplit = 100 - (minRightWidth / containerWidth) * 100;

      const clampedSplit = Math.min(Math.max(newSplit, minSplit), maxSplit);
      setSplitPosition(clampedSplit);
      onSplitChange?.(clampedSplit);
    });
  }, [isDragging, minLeftWidth, minRightWidth, onSplitChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!containerRef.current) return;

    const step = e.shiftKey ? 10 : 2; // Larger steps with shift
    const containerWidth = containerRef.current.offsetWidth;
    const minSplit = (minLeftWidth / containerWidth) * 100;
    const maxSplit = 100 - (minRightWidth / containerWidth) * 100;

    let newSplit = splitPosition;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        newSplit = Math.max(splitPosition - step, minSplit);
        break;
      case 'ArrowRight':
        e.preventDefault();
        newSplit = Math.min(splitPosition + step, maxSplit);
        break;
      case 'Home':
        e.preventDefault();
        newSplit = minSplit;
        break;
      case 'End':
        e.preventDefault();
        newSplit = maxSplit;
        break;
      default:
        return;
    }

    setSplitPosition(newSplit);
    onSplitChange?.(newSplit);
  };

  return (
    <div 
      ref={containerRef}
      className={cn("flex h-full w-full relative", className)}
    >
      {/* Left pane */}
      <div 
        className="h-full overflow-hidden"
        style={{ width: `${splitPosition}%` }}
      >
        {left}
      </div>

      {/* Divider */}
      <div
        className={cn(
          "relative flex-shrink-0 group",
          "w-1 hover:w-2 transition-all duration-150",
          "bg-border hover:bg-primary/50",
          "cursor-col-resize",
          isDragging && "bg-primary w-2"
        )}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="separator"
        aria-label="Resize panes"
        aria-valuenow={Math.round(splitPosition)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Expand hit area for easier dragging */}
        <div className="absolute inset-y-0 -left-2 -right-2 z-10" />
        
        {/* Visual indicator dots */}
        <div className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "flex flex-col items-center justify-center gap-1",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          isDragging && "opacity-100"
        )}>
          <div className="w-1 h-1 bg-primary rounded-full" />
          <div className="w-1 h-1 bg-primary rounded-full" />
          <div className="w-1 h-1 bg-primary rounded-full" />
        </div>
      </div>

      {/* Right pane */}
      <div 
        className="h-full overflow-hidden flex-1"
        style={{ width: `${100 - splitPosition}%` }}
      >
        {right}
      </div>
    </div>
  );
}; 