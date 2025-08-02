import { api as originalApi } from './api';
import { analytics, eventBuilders } from './analytics';

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  fast: 100,
  normal: 500,
  slow: 2000,
  bottleneck: 5000,
};

// Memory threshold (in MB)
const MEMORY_WARNING_THRESHOLD = 100;

/**
 * Wraps an API method with error and performance tracking
 */
function wrapApiMethod<T extends (...args: any[]) => Promise<any>>(
  methodName: string,
  method: T
): T {
  return (async (...args: any[]) => {
    const startTime = performance.now();
    const startMemory = ('memory' in performance ? (performance as any).memory?.usedJSHeapSize : 0) || 0;
    let retryCount = 0;
    
    const trackPerformance = (success: boolean, error?: any) => {
      const duration = performance.now() - startTime;
      const memoryUsed = ((('memory' in performance ? (performance as any).memory?.usedJSHeapSize : 0) || 0) - startMemory) / (1024 * 1024); // Convert to MB
      
      // Track API errors
      if (!success && error) {
        const event = eventBuilders.apiError({
          endpoint: methodName,
          error_code: error.code || error.status || 'unknown',
          retry_count: retryCount,
          response_time_ms: duration,
        });
        analytics.track(event.event, event.properties);
      }
      
      // Track performance bottlenecks
      if (duration > PERFORMANCE_THRESHOLDS.bottleneck) {
        const event = eventBuilders.performanceBottleneck({
          operation_type: `api.${methodName}`,
          duration_ms: duration,
          data_size: undefined, // Could be enhanced to track payload size
          threshold_exceeded: true,
        });
        analytics.track(event.event, event.properties);
      }
      
      // Track network performance
      const connectionQuality = 
        duration < PERFORMANCE_THRESHOLDS.fast ? 'excellent' :
        duration < PERFORMANCE_THRESHOLDS.normal ? 'good' : 'poor';
      
      if (success) {
        const networkEvent = eventBuilders.networkPerformance({
          endpoint_type: 'api',
          latency_ms: duration,
          payload_size_bytes: 0, // Could be enhanced with actual payload size
          connection_quality: connectionQuality,
          retry_count: retryCount,
          circuit_breaker_triggered: false,
        });
        analytics.track(networkEvent.event, networkEvent.properties);
      }
      
      // Track memory warnings
      if (memoryUsed > MEMORY_WARNING_THRESHOLD) {
        const event = eventBuilders.memoryWarning({
          component: `api.${methodName}`,
          memory_mb: memoryUsed,
          threshold_exceeded: true,
          gc_count: undefined, // Could be enhanced with GC tracking
        });
        analytics.track(event.event, event.properties);
      }
    };
    
    try {
      const result = await method(...args);
      trackPerformance(true);
      return result;
    } catch (error) {
      trackPerformance(false, error);
      throw error;
    }
  }) as T;
}

/**
 * Creates a tracked version of the API object
 */
function createTrackedApi() {
  const trackedApi: any = {};
  
  // Wrap each method in the original API
  for (const [key, value] of Object.entries(originalApi)) {
    if (typeof value === 'function') {
      trackedApi[key] = wrapApiMethod(key, value);
    } else {
      trackedApi[key] = value;
    }
  }
  
  return trackedApi as typeof originalApi;
}

// Export the tracked API
export const api = createTrackedApi();

// Re-export types from the original API module
export * from './api';
