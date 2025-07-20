/**
 * Context hooks separated to avoid fast refresh warnings
 */
import { useContext } from "react";
import { TabContext, ToastContext } from "./contexts";
import { createTabContextError, createToastContextError } from "./contextUtils";

/**
 * Hook for accessing tab context
 *
 * Provides access to tab management functionality from the TabContext.
 * Must be used within a TabProvider component.
 *
 * @returns Tab context with state and management functions
 * @throws Error if used outside TabProvider
 *
 * @example
 * ```tsx
 * function TabComponent() {
 *   const { tabs, activeTabId, addTab, removeTab } = useTabContext();
 *
 *   return (
 *     <div>
 *       <span>Active tab: {activeTabId}</span>
 *       <span>Total tabs: {tabs.length}</span>
 *     </div>
 *   );
 * }
 * ```
 */
export const useTabContext = () => {
  const context = useContext(TabContext);
  if (!context) {
    throw createTabContextError("useTabContext");
  }
  return context;
};

/**
 * Hook for accessing toast notification functionality
 *
 * Provides access to toast notification functions from the ToastContext.
 * Must be used within a ToastProvider component.
 *
 * @returns Toast context with notification functions
 * @throws Error if used outside ToastProvider
 *
 * @example
 * ```tsx
 * function NotificationComponent() {
 *   const { showSuccess, showError, showInfo } = useToast();
 *
 *   const handleSuccess = () => {
 *     showSuccess('Operation completed successfully!');
 *   };
 *
 *   const handleError = () => {
 *     showError('Something went wrong!');
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleSuccess}>Show Success</button>
 *       <button onClick={handleError}>Show Error</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw createToastContextError("useToast");
  }
  return context;
};
