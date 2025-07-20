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
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
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

/**
 * Props interface for the Button component
 *
 * Extends standard HTML button attributes with additional variant and styling options.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as child element instead of button */
  asChild?: boolean;
}

/**
 * Button component with multiple variants and sizes
 *
 * @example
 * <Button variant="outline" size="lg" onClick={() => logger.debug('clicked')}>
 *   Click me
 * </Button>
 */
/**
 * Button component with multiple variants and sizes
 *
 * A versatile button component that supports different visual styles,
 * sizes, and can render as different elements using the asChild prop.
 *
 * @param variant - Visual style variant
 * @param size - Size variant
 * @param asChild - Render as child element instead of button
 * @param className - Additional CSS classes
 * @param children - Button content
 *
 * @example
 * ```tsx
 * <Button variant="default" size="md">
 *   Click me
 * </Button>
 *
 * <Button variant="destructive" size="sm" asChild>
 *   <a href="/delete">Delete</a>
 * </Button>
 * ```
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button };
// eslint-disable-next-line react-refresh/only-export-components
export { buttonVariants };
