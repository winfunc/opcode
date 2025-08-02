/**
 * Custom hooks index
 *
 * Central export point for all custom React hooks used throughout the application.
 * These hooks provide reusable logic for common patterns like API calls,
 * state management, and UI interactions.
 *
 * @example
 * ```tsx
 * import { useLoadingState, useDebounce, useApiCall } from '@/hooks';
 *
 * function MyComponent() {
 *   const { data, isLoading, execute } = useLoadingState(fetchData);
 *   const debouncedValue = useDebounce(searchTerm, 300);
 *   const { call: apiCall } = useApiCall(api.getData);
 *
 *   // Use hooks in your component logic
 * }
 * ```
 */
export { useLoadingState } from "./useLoadingState";
export { useDebounce, useDebouncedCallback } from "./useDebounce";
export { useApiCall } from "./useApiCall";
export { usePagination } from "./usePagination";
export { useTheme } from './useTheme';
export {
  useAnalytics,
  useTrackEvent,
  usePageView,
  useAppLifecycle,
  useComponentMetrics,
  useInteractionTracking,
  useScreenTracking,
  useFeatureExperiment,
  usePathTracking,
  useFeatureAdoptionTracking,
  useWorkflowTracking,
  useAIInteractionTracking,
  useNetworkPerformanceTracking
} from './useAnalytics';
export {
  usePerformanceMonitor,
  useAsyncPerformanceTracker
} from './usePerformanceMonitor';
export { TAB_SCREEN_NAMES } from './useAnalytics';
export { useTabContext } from '../contexts/hooks';
