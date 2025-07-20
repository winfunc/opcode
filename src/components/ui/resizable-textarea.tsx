import * as React from "react";
import { cn } from "@/lib/utils";
import { GripHorizontal } from "lucide-react";

export interface ResizableTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Minimum height in pixels
   */
  minHeight?: number;
  /**
   * Maximum height in pixels
   */
  maxHeight?: number;
  /**
   * Whether to enable auto-resize based on content
   */
  autoResize?: boolean;
  /**
   * Whether to show the resize handle
   */
  showResizeHandle?: boolean;
}

const ResizableTextarea = React.forwardRef<HTMLTextAreaElement, ResizableTextareaProps>(
  (
    {
      className,
      minHeight = 44,
      maxHeight = 300,
      autoResize = true,
      showResizeHandle = true,
      style,
      onChange,
      ...props
    },
    ref
  ) => {
    const [height, setHeight] = React.useState(minHeight);
    const [isDragging, setIsDragging] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Combine refs
    React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

    // Auto-resize based on content
    const adjustHeight = React.useCallback(() => {
      if (!autoResize || !textareaRef.current) return;

      const textarea = textareaRef.current;
      // Reset height to get accurate scrollHeight
      textarea.style.height = `${minHeight}px`;

      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);

      setHeight(newHeight);
      textarea.style.height = `${newHeight}px`;
    }, [autoResize, minHeight, maxHeight]);

    // Handle content change
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(e);
        // Delay height adjustment to next frame to ensure content is rendered
        requestAnimationFrame(adjustHeight);
      },
      [onChange, adjustHeight]
    );

    // Handle mouse down on resize handle
    const handleMouseDown = React.useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const startY = e.clientY;
        const startHeight = height;

        setIsDragging(true);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "ns-resize";

        const handleMouseMove = (e: MouseEvent) => {
          const deltaY = e.clientY - startY;
          // 手柄在顶部：向上拖拽(deltaY < 0)应该增加高度，向下拖拽(deltaY > 0)应该减少高度
          // 所以我们需要反转 deltaY
          const newHeight = Math.min(Math.max(startHeight - deltaY, minHeight), maxHeight);

          setHeight(newHeight);
          if (textareaRef.current) {
            textareaRef.current.style.height = `${newHeight}px`;
          }
        };

        const handleMouseUp = () => {
          setIsDragging(false);
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          document.body.style.userSelect = "";
          document.body.style.cursor = "";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      },
      [height, minHeight, maxHeight]
    );

    // Initial height adjustment
    React.useEffect(() => {
      adjustHeight();
    }, [adjustHeight]);

    // Cleanup on unmount
    React.useEffect(() => {
      return () => {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
    }, []);

    return (
      <div className="relative">
        <textarea
          className={cn(
            "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            "resize-none overflow-y-auto transition-none",
            className
          )}
          ref={textareaRef}
          style={{
            height: `${height}px`,
            ...style,
          }}
          onChange={handleChange}
          {...props}
        />

        {showResizeHandle && (
          <div
            className={cn(
              "absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-1/2",
              "w-10 h-4 flex items-center justify-center",
              "cursor-ns-resize hover:bg-accent rounded-md transition-colors",
              "bg-background border border-border shadow-sm",
              "group z-10",
              isDragging && "bg-accent"
            )}
            onMouseDown={handleMouseDown}
          >
            <GripHorizontal
              className={cn(
                "h-3 w-3 text-muted-foreground/70",
                "group-hover:text-muted-foreground transition-colors",
                isDragging && "text-muted-foreground"
              )}
            />
          </div>
        )}
      </div>
    );
  }
);

ResizableTextarea.displayName = "ResizableTextarea";

export { ResizableTextarea };
