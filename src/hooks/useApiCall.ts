import { useState, useCallback, useRef, useEffect } from 'react';

interface ApiCallOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  showErrorToast?: boolean;
  showSuccessToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
}

interface ApiCallState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  call: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

/**
 * Custom hook for making API calls with consistent error handling and loading states
 * Includes automatic toast notifications and cleanup on unmount
 */
export function useApiCall<T>(
  apiFunction: (...args: any[]) => Promise<T>,
  options: ApiCallOptions = {}
): ApiCallState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const {
    onSuccess,
    onError,
    showErrorToast = true,
    showSuccessToast = false,
    successMessage = 'Operation completed successfully',
    errorMessage
  } = options;

  const call = useCallback(
    async (...args: any[]): Promise<T | null> => {
      try {
        // Cancel any pending request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller
        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        setError(null);

        const result = await apiFunction(...args);

        // Only update state if component is still mounted
        if (!isMountedRef.current) return null;

        setData(result);
        
        if (showSuccessToast) {
          // TODO: Implement toast notification
          console.log('Success:', successMessage);
        }

        onSuccess?.(result);
        return result;
      } catch (err) {
        // Ignore aborted requests
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }

        // Only update state if component is still mounted
        if (!isMountedRef.current) return null;

        const error = err instanceof Error ? err : new Error('An error occurred');
        setError(error);

        if (showErrorToast) {
          // TODO: Implement toast notification
          console.error('Error:', errorMessage || error.message);
        }

        onError?.(error);
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [apiFunction, onSuccess, onError, showErrorToast, showSuccessToast, successMessage, errorMessage]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { data, isLoading, error, call, reset };
}