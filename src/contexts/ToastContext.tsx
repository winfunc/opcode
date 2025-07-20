/**
 * Toast通知上下文和Provider
 * 提供全局Toast通知管理
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast, ToastContainer, type ToastType } from '@/components/ui/toast';
import { AnimatePresence } from 'framer-motion';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ 
  children, 
  maxToasts = 3 
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const generateId = useCallback(() => {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const showToast = useCallback((
    message: string, 
    type: ToastType = 'info', 
    duration = 3000
  ) => {
    const id = generateId();
    const newToast: ToastItem = { id, message, type, duration };

    setToasts(prev => {
      const updated = [newToast, ...prev];
      // 限制最大Toast数量
      return updated.slice(0, maxToasts);
    });
  }, [generateId, maxToasts]);

  const showSuccess = useCallback((message: string, duration?: number) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration?: number) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
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
    clearAllToasts
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer>
        <AnimatePresence mode="sync">
          {toasts.map(toast => (
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

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastProvider;