import { useState, useCallback, useRef, useEffect } from "react";
import { logger } from "@/lib/logger";
import {
  handleError,
  handleApiError,
  handleNetworkError,
  handleValidationError,
} from "@/lib/errorHandler";

/**
 * Toast notification function
 * This would typically be imported from a toast library or context
 */
function showToast(message: string, type: "success" | "error" | "info" | "warning") {
  // For now, use console logging with enhanced formatting
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";

  logger.debug(`${prefix} [${timestamp}] ${message}`);

  // In a real implementation, this would trigger a toast notification
  // Example: toast({ message, type, duration: 3000 });
}

interface ApiCallOptions<T = unknown> {
  onSuccess?: (data: T) => void;
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
  call: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

/**
 * Custom hook for making API calls with consistent error handling and loading states
 * Includes automatic toast notifications and cleanup on unmount
 */
export function useApiCall<T>(
  apiFunction: (...args: unknown[]) => Promise<T>,
  options: ApiCallOptions<T> = {}
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
    successMessage = "Operation completed successfully",
    errorMessage,
  } = options;

  const call = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      try {
        // Input validation
        if (!apiFunction) {
          const validationError = new Error("API function is required");
          await handleValidationError(validationError, { source: "useApiCall", operation: "call" });
          throw validationError;
        }

        // Cancel any pending request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller
        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        setError(null);

        // Add timeout protection
        const timeoutId = setTimeout(() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
        }, 30000); // 30 second timeout

        try {
          const result = await apiFunction(...args);
          clearTimeout(timeoutId);

          // Only update state if component is still mounted
          if (!isMountedRef.current) return null;

          // Validate result
          if (result === undefined) {
            logger.warn("API function returned undefined, this might indicate an error");
          }

          setData(result);

          if (showSuccessToast) {
            // Show success toast notification
            showToast(successMessage, "success");
          }

          onSuccess?.(result);
          return result;
        } catch (apiError) {
          clearTimeout(timeoutId);
          throw apiError;
        }
      } catch (err) {
        // Ignore aborted requests
        if (err instanceof Error && err.name === "AbortError") {
          return null;
        }

        // Only update state if component is still mounted
        if (!isMountedRef.current) return null;

        // Enhanced error handling with more specific error types
        let error: Error;
        if (err instanceof Error) {
          error = err;
        } else if (typeof err === "string") {
          error = new Error(err);
        } else {
          error = new Error("An unexpected error occurred");
        }

        // Use unified error handling based on error type
        if (
          error.message.includes("fetch") ||
          error.message.includes("network") ||
          error.message.includes("connection")
        ) {
          await handleNetworkError(error, { source: "useApiCall", operation: "apiCall" });
        } else if (error.message.includes("timeout") || error.name === "TimeoutError") {
          await handleError(error, { source: "useApiCall", operation: "apiCall", type: "timeout" });
        } else {
          await handleApiError(error, { source: "useApiCall", operation: "apiCall" });
        }

        setError(error);

        if (showErrorToast) {
          // Show error toast notification
          showToast(errorMessage || error.message, "error");
        }

        onError?.(error);
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      apiFunction,
      onSuccess,
      onError,
      showErrorToast,
      showSuccessToast,
      successMessage,
      errorMessage,
    ]
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
