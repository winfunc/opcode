import * as React from "react";
import { cn } from "@/lib/utils";

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
}>({
  value: "",
  onValueChange: () => {},
});

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
const Tabs: React.FC<TabsProps> = ({
  value,
  onValueChange,
  children,
  className,
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
};

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container for tab triggers
 */
const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-9 items-center justify-start rounded-lg p-1",
        className
      )}
      style={{
        backgroundColor: "var(--color-muted)",
        color: "var(--color-muted-foreground)"
      }}
      {...props}
    />
  )
);

TabsList.displayName = "TabsList";

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

/**
 * Individual tab trigger button
 */
const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(({ className, value, disabled, ...props }, ref) => {
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
        backgroundColor: isSelected ? "var(--color-background)" : "transparent",
        color: isSelected ? "var(--color-foreground)" : "inherit",
        boxShadow: isSelected ? "0 1px 2px rgba(0,0,0,0.1)" : "none"
      }}
      {...props}
    />
  );
});

TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Tab content panel
 */
const TabsContent = React.forwardRef<
  HTMLDivElement,
  TabsContentProps
>(({ className, value, ...props }, ref) => {
  const { value: selectedValue } = React.useContext(TabsContext);
  const isSelected = selectedValue === value;

  if (!isSelected) return null;

  return (
    <div
      ref={ref}
      role="tabpanel"
      className={cn(
        "mt-2",
        className
      )}
      {...props}
    />
  );
});

TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent }; 