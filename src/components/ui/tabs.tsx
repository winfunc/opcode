import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Context for managing tabs state
 */
const TabsContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
}>({
  value: "",
  onValueChange: () => {},
});

/**
 * Props interface for the Tabs component
 */
export interface TabsProps {
  /**
   * The controlled value of the tab to activate
   */
  value: string;
  /**
   * Event handler called when the value changes
   */
  onValueChange: (value: string) => void;
  /**
   * The tabs and their content
   */
  children: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Root tabs component
 *
 * @example
 * <Tabs value={activeTab} onValueChange={setActiveTab}>
 *   <TabsList>
 *     <TabsTrigger value="general">General</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="general">Content</TabsContent>
 * </Tabs>
 */
const Tabs: React.FC<TabsProps> = ({ value, onValueChange, children, className }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
};

/**
 * Props interface for the TabsList component
 */
export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container for tab triggers
 *
 * Provides a styled container for tab trigger buttons with proper spacing and background.
 *
 * @param className - Additional CSS classes
 * @param children - TabsTrigger components
 */
const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex h-9 items-center justify-start rounded-lg p-1 border", className)}
    style={{
      backgroundColor: "var(--color-card)",
      color: "var(--color-foreground)",
      borderColor: "var(--color-border)",
    }}
    {...props}
  />
));

TabsList.displayName = "TabsList";

/**
 * Props interface for the TabsTrigger component
 */
export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

/**
 * Individual tab trigger button
 *
 * Clickable button that activates a specific tab when clicked.
 * Automatically manages active state and accessibility attributes.
 *
 * @param value - Unique identifier for this tab
 * @param className - Additional CSS classes
 * @param disabled - Whether the tab is disabled
 * @param children - Button content (usually text)
 */
const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, disabled, ...props }, ref) => {
    const { value: selectedValue, onValueChange } = React.useContext(TabsContext);
    const isSelected = selectedValue === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isSelected}
        disabled={disabled}
        onClick={() => onValueChange(value)}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        style={{
          backgroundColor: isSelected ? "var(--color-primary)" : "transparent",
          color: isSelected ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)",
          boxShadow: isSelected ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
          border: isSelected ? "1px solid var(--color-primary)" : "1px solid transparent",
        }}
        {...props}
      />
    );
  }
);

TabsTrigger.displayName = "TabsTrigger";

/**
 * Props interface for the TabsContent component
 */
export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Tab content panel
 *
 * Container for tab content that is only visible when its corresponding tab is active.
 * Automatically handles visibility based on the current tab value.
 *
 * @param value - Unique identifier that matches the corresponding TabsTrigger
 * @param className - Additional CSS classes
 * @param children - Content to display when this tab is active
 */
const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { value: selectedValue } = React.useContext(TabsContext);
    const isSelected = selectedValue === value;

    if (!isSelected) return null;

    return <div ref={ref} role="tabpanel" className={cn("mt-2", className)} {...props} />;
  }
);

TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
