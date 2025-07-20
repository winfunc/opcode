import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Available toast notification types
 */
export type ToastType = "success" | "error" | "info" | "warning";

/**
 * Props interface for the Toast component
 */
interface ToastProps {
  /**
   * The message to display
   */
  message: string;
  /**
   * The type of toast
   */
  type?: ToastType;
  /**
   * Duration in milliseconds before auto-dismiss
   */
  duration?: number;
  /**
   * Callback when the toast is dismissed
   */
  onDismiss?: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Toast component for showing temporary notifications
 *
 * @example
 * <Toast
 *   message="File saved successfully"
 *   type="success"
 *   duration={3000}
 *   onDismiss={() => setShowToast(false)}
 * />
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  type = "info",
  duration = 3000,
  onDismiss,
  className,
}) => {
  React.useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  const icons = {
    success: <CheckCircle className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
    info: <Info className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
  };

  const colors = {
    success: "text-green-500",
    error: "text-red-500",
    info: "text-primary",
    warning: "text-yellow-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center space-x-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg",
        className
      )}
    >
      <span className={colors[type]}>{icons[type]}</span>
      <span className="flex-1 text-sm">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
};

/**
 * Props interface for the ToastContainer component
 */
interface ToastContainerProps {
  children: React.ReactNode;
}

/**
 * Container component for positioning toast notifications
 *
 * Provides a fixed position container at the bottom of the screen
 * for displaying toast notifications with proper z-index and animations.
 *
 * @param children - Toast components to display
 *
 * @example
 * ```tsx
 * <ToastContainer>
 *   <Toast message="Success!" type="success" />
 *   <Toast message="Error occurred" type="error" />
 * </ToastContainer>
 * ```
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({ children }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
      <div className="pointer-events-auto">
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </div>
    </div>
  );
};
