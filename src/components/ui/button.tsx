import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button variants configuration using class-variance-authority
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
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
        gradient:
          "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        "gradient-primary":
          "relative overflow-hidden text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] before:absolute before:inset-0 before:bg-gradient-to-r before:from-purple-500 before:to-blue-500 before:transition-all before:duration-300 hover:before:scale-105 [&>*]:relative [&>*]:z-10",
        "gradient-accent":
          "bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        "gradient-success":
          "bg-gradient-to-r from-green-400 to-green-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        "gradient-warning":
          "bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        "gradient-error":
          "bg-gradient-to-r from-red-400 to-red-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        "gradient-subtle":
          "relative overflow-hidden text-foreground shadow-xs hover:shadow-md hover:scale-[1.01] active:scale-[0.99] before:absolute before:inset-0 before:bg-gradient-to-r before:from-slate-700 before:to-slate-800 dark:before:from-slate-700 dark:before:to-slate-800 before:transition-all before:duration-300 hover:before:scale-105 [&>*]:relative [&>*]:z-10",
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
}

/**
 * Button component with multiple variants and sizes
 * 
 * @example
 * <Button variant="outline" size="lg" onClick={() => console.log('clicked')}>
 *   Click me
 * </Button>
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants }; 