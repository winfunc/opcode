/**
 * Toast通知上下文和Provider
 * 提供全局Toast通知管理
 */

import React, { useState, useCallback, ReactNode } from "react";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { AnimatePresence } from "framer-motion";
import { generateToastId } from "./toastUtils";
import { ToastContext, type ToastType, type ToastItem } from "./contexts";

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children, maxToasts = 3 }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration = 3000) => {
      const id = generateToastId();
      const newToast: ToastItem = { id, message, type, duration };

      setToasts((prev) => {
        const updated = [newToast, ...prev];
        // 限制最大Toast数量
        return updated.slice(0, maxToasts);
      });
    },
    [maxToasts]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      showToast(message, "success", duration);
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string, duration?: number) => {
      showToast(message, "error", duration);
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      showToast(message, "info", duration);
    },
    [showToast]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const contextValue: ToastContextValue = {
    showToast,
    showSuccess,
    showError,
    showInfo,
    dismissToast,
    clearAllToasts,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer>
        <AnimatePresence mode="sync">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onDismiss={() => dismissToast(toast.id)}
              className="mb-2"
            />
          ))}
        </AnimatePresence>
      </ToastContainer>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
