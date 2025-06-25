import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Whether the switch is checked
   */
  checked?: boolean;
  /**
   * Callback when the switch state changes
   */
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Switch component for toggling boolean values
 * 
 * @example
 * <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        style={{
          backgroundColor: checked ? "var(--color-primary)" : "var(--color-muted)"
        }}
      >
        <span
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full shadow-lg ring-0 transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
          style={{
            backgroundColor: "var(--color-background)"
          }}
        />
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";

export { Switch }; 