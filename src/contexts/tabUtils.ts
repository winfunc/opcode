/**
 * Utility functions for tab management
 * Separated to avoid fast refresh warnings
 */

export const generateTabId = (): string => {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const MAX_TABS = 20;
