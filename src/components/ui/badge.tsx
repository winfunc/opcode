import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge variants configuration using class-variance-authority
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Props interface for the Badge component
 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Badge component for displaying status, labels, or categories
 *
 * A small component used to display status information, labels, or categories.
 * Supports multiple visual variants and can be used inline with text or standalone.
 *
 * @param variant - Visual style variant (default, secondary, destructive, outline)
 * @param className - Additional CSS classes
 * @param children - Badge content
 *
 * @example
 * ```tsx
 * <Badge variant="default">New</Badge>
 * <Badge variant="destructive">Error</Badge>
 * <Badge variant="outline">Draft</Badge>
 * ```
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
// eslint-disable-next-line react-refresh/only-export-components
export { badgeVariants };
