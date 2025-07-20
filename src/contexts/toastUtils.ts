/**
 * Utility functions for toast management
 * Separated to avoid fast refresh warnings
 */

/**
 * Generate a unique identifier for toast notifications
 *
 * Creates a unique toast ID using timestamp and random characters
 * to ensure uniqueness across toast creation sessions.
 *
 * @returns Unique toast identifier string
 *
 * @example
 * ```typescript
 * const toastId = generateToastId();
 * // Returns: 'toast_1703123456789_abc123def'
 * ```
 */
export const generateToastId = (): string => {
  return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
