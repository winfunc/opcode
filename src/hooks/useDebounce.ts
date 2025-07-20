import { useEffect, useState, useRef } from "react";

/**
 * Custom hook that debounces a value
 *
 * Delays updating the returned value until after the specified delay has passed
 * since the last time the input value changed. This is useful for search inputs,
 * API calls, and other scenarios where you want to reduce the frequency of updates.
 *
 * @template T - The type of the value being debounced
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   if (debouncedSearchTerm) {
 *     performSearch(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook that returns a debounced callback function
 *
 * The returned callback will only be invoked after the specified delay has passed
 * since the last call. This prevents rapid successive calls and is useful for
 * expensive operations like API calls or complex calculations.
 *
 * @template T - The type of the callback function
 * @param callback - The function to debounce
 * @param delay - The delay in milliseconds
 * @returns A debounced version of the callback
 *
 * @example
 * ```tsx
 * const debouncedSave = useDebouncedCallback((data: FormData) => {
 *   saveToServer(data);
 * }, 1000);
 *
 * // This will only call saveToServer once, 1 second after the last call
 * debouncedSave(formData);
 * debouncedSave(formData); // Cancels previous call
 * debouncedSave(formData); // Only this call will execute
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref on each render to avoid stale closures
  callbackRef.current = callback;

  return useRef(((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }) as T).current;
}
