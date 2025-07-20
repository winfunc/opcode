/**
 * Utility functions for tab management
 * Separated to avoid fast refresh warnings
 */

/**
 * Generate a unique identifier for tabs
 *
 * Creates a unique tab ID using timestamp and random characters
 * to ensure uniqueness across tab creation sessions.
 *
 * @returns Unique tab identifier string
 *
 * @example
 * ```typescript
 * const tabId = generateTabId();
 * // Returns: 'tab-1703123456789-abc123def'
 * ```
 */
export const generateTabId = (): string => {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Maximum number of tabs allowed to be open simultaneously
 *
 * Prevents excessive memory usage and maintains UI performance
 * by limiting the number of concurrent tabs.
 */
export const MAX_TABS = 20;
