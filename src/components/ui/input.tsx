import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Props interface for the Input component
 * Extends all standard HTML input attributes
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Input component for form inputs with consistent styling
 *
 * A styled input component that provides consistent appearance across
 * the application with support for focus states, disabled states, and
 * file inputs. Uses CSS custom properties for theming.
 *
 * @param type - Input type (text, number, email, password, etc.)
 * @param className - Additional CSS classes to apply
 * @param placeholder - Placeholder text
 * @param disabled - Whether the input is disabled
 * @param value - Controlled value
 * @param onChange - Change event handler
 *
 * @example
 * ```tsx
 * <Input
 *   type="text"
 *   placeholder="Enter your name..."
 *   value={name}
 *   onChange={(e) => setName(e.target.value)}
 * />
 *
 * <Input
 *   type="file"
 *   accept=".json,.txt"
 *   onChange={handleFileSelect}
 * />
 * ```
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "focus-visible:outline-none focus-visible:ring-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        style={{
          borderColor: "var(--color-input)",
          backgroundColor: "transparent",
          color: "var(--color-foreground)",
        }}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
