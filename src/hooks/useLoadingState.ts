import { useState, useCallback } from "react";

/**
 * State interface for the useLoadingState hook
 *
 * @template T - The type of data being managed
 */
interface LoadingState<T> {
  /** The data returned from the async operation, null if not yet loaded */
  data: T | null;
  /** Whether an async operation is currently in progress */
  isLoading: boolean;
  /** Any error that occurred during the async operation */
  error: Error | null;
  /** Function to execute the async operation with given arguments */
  execute: (...args: unknown[]) => Promise<T>;
  /** Function to reset the state to initial values */
  reset: () => void;
}

/**
 * Custom hook for managing loading states with error handling
 *
 * This hook provides a consistent pattern for handling async operations
 * with loading states, error handling, and data management. It reduces
 * boilerplate code and provides a clean API for async operations.
 *
 * @template T - The type of data returned by the async function
 * @param asyncFunction - The async function to execute
 * @returns Object containing data, loading state, error, execute function, and reset function
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, execute, reset } = useLoadingState(
 *   async (userId: string) => fetchUser(userId)
 * );
 *
 * // Execute the function
 * const handleFetch = () => execute('123');
 *
 * // Reset state
 * const handleReset = () => reset();
 * ```
 */
export function useLoadingState<T>(
  asyncFunction: (...args: unknown[]) => Promise<T>
): LoadingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T> => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await asyncFunction(...args);
        setData(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("An error occurred");
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [asyncFunction]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, error, execute, reset };
}
