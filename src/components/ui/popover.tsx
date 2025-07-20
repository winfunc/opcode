import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Props interface for the Popover component
 */
interface PopoverProps {
  /**
   * The trigger element
   */
  trigger: React.ReactNode;
  /**
   * The content to display in the popover
   */
  content: React.ReactNode;
  /**
   * Whether the popover is open
   */
  open?: boolean;
  /**
   * Callback when the open state changes
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Optional className for the content
   */
  className?: string;
  /**
   * Alignment of the popover relative to the trigger
   */
  align?: "start" | "center" | "end";
  /**
   * Side of the trigger to display the popover
   */
  side?: "top" | "bottom";
}

/**
 * Popover component for displaying floating content
 *
 * A floating content container that appears relative to a trigger element.
 * Supports controlled and uncontrolled modes, keyboard navigation, and
 * click-outside-to-close behavior. Includes smooth animations and flexible positioning.
 *
 * @param trigger - Element that triggers the popover when clicked
 * @param content - Content to display inside the popover
 * @param open - Controlled open state (optional)
 * @param onOpenChange - Callback when open state changes
 * @param className - Additional CSS classes for the content
 * @param align - Horizontal alignment relative to trigger
 * @param side - Vertical position relative to trigger
 *
 * @example
 * ```tsx
 * <Popover
 *   trigger={<Button>Show Menu</Button>}
 *   content={
 *     <div className="space-y-2">
 *       <button>Option 1</button>
 *       <button>Option 2</button>
 *     </div>
 *   }
 *   side="bottom"
 *   align="start"
 * />
 *
 * // Controlled popover
 * <Popover
 *   trigger={<Button>Settings</Button>}
 *   content={<SettingsPanel />}
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * />
 * ```
 */
export const Popover: React.FC<PopoverProps> = ({
  trigger,
  content,
  open: controlledOpen,
  onOpenChange,
  className,
  align = "center",
  side = "bottom",
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        contentRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, setOpen]);

  // Close on escape
  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, setOpen]);

  const alignClass = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }[align];

  const sideClass = side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  const animationY = side === "top" ? { initial: 10, exit: 10 } : { initial: -10, exit: -10 };

  return (
    <div className="relative inline-block">
      <div ref={triggerRef} onClick={() => setOpen(!open)}>
        {trigger}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, scale: 0.95, y: animationY.initial }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: animationY.exit }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-50 min-w-[200px] rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md",
              sideClass,
              alignClass,
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
