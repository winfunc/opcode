import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Props interface for the Switch component
 */
export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Whether the switch is checked
   */
  checked?: boolean;
  /**
   * Callback when the switch state changes
   */
  onCheckedChange?: (checked: boolean) => void;
  /**
   * Visual variant of the switch
   */
  variant?: "default" | "high-contrast";
}

/**
 * Switch component for toggling boolean values
 *
 * A toggle switch component that provides an alternative to checkboxes
 * for boolean values. Features smooth animations and accessibility support.
 *
 * @param checked - Whether the switch is in the on position
 * @param onCheckedChange - Callback when the switch state changes
 * @param disabled - Whether the switch is disabled
 * @param variant - Visual variant for different use cases
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * const [isEnabled, setIsEnabled] = useState(false);
 *
 * <Switch
 *   checked={isEnabled}
 *   onCheckedChange={setIsEnabled}
 * />
 *
 * <Switch
 *   checked={notifications}
 *   onCheckedChange={setNotifications}
 *   disabled={isLoading}
 *   variant="high-contrast"
 * />
 * ```
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, variant = "default", ...props }, ref) => {
    // High contrast variant colors
    const getVariantStyles = () => {
      if (variant === "high-contrast") {
        return {
          backgroundColor: checked ? "#000000" : "#ffffff",
          border: checked ? "2px solid #ffffff" : "2px solid #666666",
        };
      }
      
      // Default variant uses CSS variables
      return {
        backgroundColor: checked ? "var(--color-primary)" : "var(--color-muted)",
        border: "2px solid transparent",
      };
    };

    const getThumbStyles = () => {
      if (variant === "high-contrast") {
        return {
          backgroundColor: checked ? "#ffffff" : "#000000",
        };
      }
      
      // Default variant uses CSS variables
      return {
        backgroundColor: "var(--color-background)",
      };
    };

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full shadow-sm transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        style={getVariantStyles()}
      >
        <span
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full shadow-lg ring-0 transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
          style={getThumbStyles()}
        />
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className="sr-only"
          onChange={() => {}}
          {...props}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";

export { Switch };
