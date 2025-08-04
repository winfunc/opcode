import { useEffect, useRef } from 'react';
import { eventBuilders, analytics } from '@/lib/analytics';

interface PerformanceThresholds {
  renderTime?: number;  // ms
  memoryUsage?: number; // MB
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  renderTime: 16, // 60fps threshold
  memoryUsage: 50, // 50MB
};

/**
 * Hook to monitor component performance and track bottlenecks
 */
export function usePerformanceMonitor(
  componentName: string,
  thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS
) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());
  const mountTime = useRef(performance.now());
  
  useEffect(() => {
    renderCount.current += 1;
    const currentTime = performance.now();
    const renderTime = currentTime - lastRenderTime.current;
    lastRenderTime.current = currentTime;
    
    // Skip first render (mount)
    if (renderCount.current === 1) return;
    
    // Check render performance
    if (thresholds.renderTime && renderTime > thresholds.renderTime) {
      const event = eventBuilders.performanceBottleneck({
        operation_type: `render.${componentName}`,
        duration_ms: renderTime,
        data_size: renderCount.current,
        threshold_exceeded: true,
      });
      analytics.track(event.event, event.properties);
    }
    
    // Check memory usage if available
    if ('memory' in performance && (performance as any).memory && thresholds.memoryUsage) {
      const memoryMB = (performance as any).memory.usedJSHeapSize / (1024 * 1024);
      if (memoryMB > thresholds.memoryUsage) {
        const event = eventBuilders.memoryWarning({
          component: componentName,
          memory_mb: memoryMB,
          threshold_exceeded: true,
          gc_count: undefined,
        });
        analytics.track(event.event, event.properties);
      }
    }
  });
  
  // Track component unmount metrics
  useEffect(() => {
    return () => {
      const lifetime = performance.now() - mountTime.current;
      
      // Only track if component lived for more than 5 seconds and had many renders
      if (lifetime > 5000 && renderCount.current > 100) {
        const avgRenderTime = lifetime / renderCount.current;
        
        // Track if average render time is high
        if (avgRenderTime > 10) {
          const event = eventBuilders.performanceBottleneck({
            operation_type: `lifecycle.${componentName}`,
            duration_ms: avgRenderTime,
            data_size: renderCount.current,
            threshold_exceeded: true,
          });
          analytics.track(event.event, event.properties);
        }
      }
    };
  }, [componentName]);
}

/**
 * Hook to track async operation performance
 */
export function useAsyncPerformanceTracker(operationName: string) {
  const operationStart = useRef<number | null>(null);
  
  const startTracking = () => {
    operationStart.current = performance.now();
  };
  
  const endTracking = (success: boolean = true, dataSize?: number) => {
    if (!operationStart.current) return;
    
    const duration = performance.now() - operationStart.current;
    operationStart.current = null;
    
    // Track if operation took too long
    if (duration > 3000) {
      const event = eventBuilders.performanceBottleneck({
        operation_type: `async.${operationName}`,
        duration_ms: duration,
        data_size: dataSize,
        threshold_exceeded: true,
      });
      analytics.track(event.event, event.properties);
    }
    
    // Track errors
    if (!success) {
      const event = eventBuilders.apiError({
        endpoint: operationName,
        error_code: 'async_operation_failed',
        retry_count: 0,
        response_time_ms: duration,
      });
      analytics.track(event.event, event.properties);
    }
  };
  
  return { startTracking, endTracking };
}