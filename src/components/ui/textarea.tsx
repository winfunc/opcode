import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Props interface for the Textarea component
 *
 * Extends standard HTML textarea attributes for multi-line text input.
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * Textarea component for multi-line text input
 *
 * A styled textarea component that provides consistent appearance across
 * the application with support for focus states, disabled states, and
 * placeholder text. Automatically resizes based on content.
 *
 * @param className - Additional CSS classes to apply
 * @param placeholder - Placeholder text
 * @param disabled - Whether the textarea is disabled
 * @param value - Controlled value
 * @param onChange - Change event handler
 * @param rows - Number of visible text lines
 *
 * @example
 * ```tsx
 * <Textarea
 *   placeholder="Enter your message..."
 *   value={message}
 *   onChange={(e) => setMessage(e.target.value)}
 *   rows={4}
 * />
 *
 * <Textarea
 *   placeholder="Comments (optional)"
 *   disabled={isSubmitting}
 * />
 * ```
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
