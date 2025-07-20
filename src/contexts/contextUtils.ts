/**
 * Utility functions for context management
 * Separated to avoid fast refresh warnings
 */

/**
 * Create a standardized error for tab context usage outside provider
 *
 * @param hookName - Name of the hook that was called outside the provider
 * @returns Error object with descriptive message
 *
 * @example
 * ```typescript
 * if (!context) {
 *   throw createTabContextError('useTabState');
 * }
 * ```
 */
export const createTabContextError = (hookName: string): Error => {
  return new Error(`${hookName} must be used within a TabProvider`);
};

/**
 * Create a standardized error for toast context usage outside provider
 *
 * @param hookName - Name of the hook that was called outside the provider
 * @returns Error object with descriptive message
 *
 * @example
 * ```typescript
 * if (!context) {
 *   throw createToastContextError('useToast');
 * }
 * ```
 */
export const createToastContextError = (hookName: string): Error => {
  return new Error(`${hookName} must be used within a ToastProvider`);
};
