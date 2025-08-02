import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Props interface for the ScrollArea component
 */
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
 * Provides a scrollable container with custom-styled scrollbars that match
 * the application theme. Automatically handles overflow and provides smooth
 * scrolling experience across different browsers.
 *
 * @param className - Additional CSS classes for styling
 * @param children - Content to be made scrollable
 *
 * @example
 * ```tsx
 * <ScrollArea className="h-[200px] w-full">
 *   <div className="p-4">
 *     <p>Long content that needs scrolling...</p>
 *     <p>More content...</p>
 *   </div>
 * </ScrollArea>
 *
 * <ScrollArea className="max-h-96">
 *   <ul>
 *     {items.map(item => <li key={item.id}>{item.name}</li>)}
 *   </ul>
 * </ScrollArea>
 * ```
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
