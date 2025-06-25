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
        className={cn(
          "relative overflow-auto",
          // Custom scrollbar styling
          "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
          "[&::-webkit-scrollbar]:w-2",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full",
          "[&::-webkit-scrollbar-thumb:hover]:bg-border/80",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ScrollArea.displayName = "ScrollArea"; 