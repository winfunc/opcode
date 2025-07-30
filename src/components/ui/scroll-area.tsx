import * as React from "react";
import { cn } from "@/lib/utils";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Children to render inside the scroll area
   */
  children: React.ReactNode;
}

/**
 * ScrollArea component for scrollable content with custom scrollbar styling
 * 
 * @example
 * <ScrollArea className="h-[200px]">
 *   <div>Scrollable content here</div>
 * </ScrollArea>
 */
export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative overflow-auto", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ScrollArea.displayName = "ScrollArea"; 