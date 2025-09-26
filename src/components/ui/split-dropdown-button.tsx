import React, { useState } from "react";
import { Button } from "./button";
import { ChevronDown } from "lucide-react";
import { Popover } from "./popover";
import { motion } from "framer-motion";

interface SplitDropdownButtonProps {
  /** Main button text */
  children: React.ReactNode;
  /** Main button click handler */
  onClick: () => void;
  /** Dropdown items */
  dropdownItems: Array<{
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    description?: string;
  }>;
  /** Button variant */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Disabled state */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

export function SplitDropdownButton({
  children,
  onClick,
  dropdownItems,
  variant = "default",
  size = "default",
  disabled = false,
  className = "",
}: SplitDropdownButtonProps) {
  const [open, setOpen] = useState(false);

  const dropdownContent = (
    <div className="space-y-1">
      {dropdownItems.map((item, index) => (
        <motion.button
          key={index}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            item.onClick();
            setOpen(false);
          }}
          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none transition-colors"
        >
          <div className="flex items-start gap-3">
            {item.icon && (
              <div className="flex-shrink-0 mt-0.5">
                {item.icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium">{item.label}</div>
              {item.description && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.description}
                </div>
              )}
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );

  return (
    <div className={`flex ${className}`}>
      {/* Main Button */}
      <Button
        onClick={onClick}
        variant={variant}
        size={size}
        disabled={disabled}
        className="rounded-r-none border-r-0 flex-1"
      >
        {children}
      </Button>

      {/* Dropdown Button */}
      <Popover
        trigger={
          <Button
            variant={variant}
            size={size}
            disabled={disabled}
            className="rounded-l-none px-2 border-l border-l-background/10"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        }
        content={dropdownContent}
        open={open}
        onOpenChange={setOpen}
        align="end"
        className="w-56 p-2"
      />
    </div>
  );
}