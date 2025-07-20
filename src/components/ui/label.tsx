import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Props interface for the Label component
 *
 * Extends standard HTML label attributes for form field labeling.
 */
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

/**
 * Label component for form fields
 *
 * Provides consistent styling for form field labels with proper accessibility
 * support and disabled state handling.
 *
 * @param htmlFor - ID of the associated form control
 * @param className - Additional CSS classes
 * @param children - Label text content
 *
 * @example
 * ```tsx
 * <Label htmlFor="email">Email Address</Label>
 * <Input id="email" type="email" />
 *
 * <Label htmlFor="description">Description</Label>
 * <Textarea id="description" placeholder="Enter description..." />
 * ```
 */
const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
));

Label.displayName = "Label";

export { Label };
