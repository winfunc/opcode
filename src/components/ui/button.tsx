import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button variants configuration using class-variance-authority
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Loading state - sets aria-busy and disables the button
   */
  isLoading?: boolean;
}

/**
 * Button component with multiple variants and sizes
 *
 * ACCESSIBILITY REQUIREMENTS:
 * - Icon-only buttons (size="icon") MUST have an aria-label prop
 * - Use isLoading prop to indicate loading state to screen readers
 *
 * @example
 * // Standard button
 * <Button variant="outline" size="lg" onClick={() => console.log('clicked')}>
 *   Click me
 * </Button>
 *
 * @example
 * // Icon-only button (requires aria-label)
 * <Button variant="ghost" size="icon" aria-label="Close dialog">
 *   <X className="h-4 w-4" />
 * </Button>
 *
 * @example
 * // Loading state
 * <Button isLoading={isSubmitting}>
 *   Submit
 * </Button>
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, disabled, children, ...props }, ref) => {
    // Warn in development if icon-only button lacks aria-label
    if (process.env.NODE_ENV === 'development' && size === 'icon') {
      if (!props['aria-label'] && !props['aria-labelledby']) {
        console.warn(
          'Button: Icon-only buttons (size="icon") should have an aria-label or aria-labelledby for accessibility'
        );
      }
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || disabled}
        aria-busy={isLoading ? "true" : undefined}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants }; 