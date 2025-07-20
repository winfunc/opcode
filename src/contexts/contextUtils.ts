/**
 * Utility functions for context management
 * Separated to avoid fast refresh warnings
 */

export const createTabContextError = (hookName: string): Error => {
  return new Error(`${hookName} must be used within a TabProvider`);
};

export const createToastContextError = (hookName: string): Error => {
  return new Error(`${hookName} must be used within a ToastProvider`);
};
