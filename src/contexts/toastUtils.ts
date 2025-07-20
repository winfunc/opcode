/**
 * Utility functions for toast management
 * Separated to avoid fast refresh warnings
 */

export const generateToastId = (): string => {
  return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
