import { analytics, eventBuilders } from '@/lib/analytics';
import type { ResourceUsageProperties } from './types';

/**
 * Resource monitoring utility for tracking system resource usage and performance
 * Helps identify performance bottlenecks and resource-intensive operations
 */
export class ResourceMonitor {
  private static instance: ResourceMonitor;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private sampleCount = 0;
  private highUsageThresholds = {
    memory: 500, // MB
    cpu: 80, // percent
    networkRequests: 50, // per interval
  };
  
  private constructor() {}
  
  static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor();
    }
    return ResourceMonitor.instance;
  }
  
  /**
   * Start monitoring resource usage with periodic sampling
   * @param intervalMs - Sampling interval in milliseconds (default: 60000ms = 1 minute)
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      console.warn('Resource monitoring is already active');
      return;
    }
    
    this.isMonitoring = true;
    this.sampleCount = 0;
    
    // Initial sample
    this.collectAndReportMetrics();
    
    // Set up periodic sampling
    this.monitoringInterval = setInterval(() => {
      this.collectAndReportMetrics();
    }, intervalMs);
    
    console.log(`Resource monitoring started with ${intervalMs}ms interval`);
  }
  
  /**
   * Stop resource monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Resource monitoring stopped');
  }
  
  /**
   * Collect current resource metrics
   */
  private collectResourceMetrics(): ResourceUsageProperties {
    const metrics: ResourceUsageProperties = {
      memory_usage_mb: this.getMemoryUsage(),
      network_requests_count: this.getNetworkRequestsCount(),
      active_connections: this.getActiveConnections(),
    };
    
    // Add CPU usage if available
    const cpuUsage = this.getCPUUsage();
    if (cpuUsage !== null) {
      metrics.cpu_usage_percent = cpuUsage;
    }
    
    // Add cache hit rate if available
    const cacheHitRate = this.getCacheHitRate();
    if (cacheHitRate !== null) {
      metrics.cache_hit_rate = cacheHitRate;
    }
    
    return metrics;
  }
  
  /**
   * Collect metrics and report to analytics
   */
  private collectAndReportMetrics(): void {
    try {
      const metrics = this.collectResourceMetrics();
      this.sampleCount++;
      
      // Always send sampled data every 10th sample for baseline tracking
      if (this.sampleCount % 10 === 0) {
        const event = eventBuilders.resourceUsageSampled(metrics);
        analytics.track(event.event, event.properties);
      }
      
      // Check for high usage conditions
      const isHighUsage = 
        metrics.memory_usage_mb > this.highUsageThresholds.memory ||
        (metrics.cpu_usage_percent && metrics.cpu_usage_percent > this.highUsageThresholds.cpu) ||
        metrics.network_requests_count > this.highUsageThresholds.networkRequests;
      
      if (isHighUsage) {
        const event = eventBuilders.resourceUsageHigh(metrics);
        analytics.track(event.event, event.properties);
      }
    } catch (error) {
      console.error('Failed to collect resource metrics:', error);
    }
  }
  
  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    if ('memory' in performance && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024);
    }
    
    // Fallback: estimate based on performance timing
    return 0;
  }
  
  /**
   * Get CPU usage percentage (if available)
   */
  private getCPUUsage(): number | null {
    // This is a placeholder - actual CPU usage would require native APIs
    // In a Tauri app, you could call a Rust function to get real CPU usage
    return null;
  }
  
  /**
   * Get count of active network requests
   */
  private getNetworkRequestsCount(): number {
    // Count active fetch requests if performance observer is available
    if ('PerformanceObserver' in window) {
      const entries = performance.getEntriesByType('resource');
      const recentEntries = entries.filter(entry => 
        entry.startTime > performance.now() - 60000 // Last minute
      );
      return recentEntries.length;
    }
    return 0;
  }
  
  /**
   * Get number of active connections (WebSocket, SSE, etc.)
   */
  private getActiveConnections(): number {
    // This would need to be tracked by your connection management code
    // For now, return a placeholder
    return 0;
  }
  
  /**
   * Get cache hit rate if available
   */
  private getCacheHitRate(): number | null {
    // This would need to be calculated based on your caching implementation
    return null;
  }
  
  /**
   * Set custom thresholds for high usage detection
   */
  setThresholds(thresholds: Partial<typeof ResourceMonitor.prototype.highUsageThresholds>): void {
    this.highUsageThresholds = {
      ...this.highUsageThresholds,
      ...thresholds,
    };
  }
  
  /**
   * Get current thresholds
   */
  getThresholds(): typeof ResourceMonitor.prototype.highUsageThresholds {
    return { ...this.highUsageThresholds };
  }
  
  /**
   * Force a single metric collection and report
   */
  collectOnce(): ResourceUsageProperties {
    const metrics = this.collectResourceMetrics();
    
    // Check for high usage
    const isHighUsage = 
      metrics.memory_usage_mb > this.highUsageThresholds.memory ||
      (metrics.cpu_usage_percent && metrics.cpu_usage_percent > this.highUsageThresholds.cpu) ||
      metrics.network_requests_count > this.highUsageThresholds.networkRequests;
    
    if (isHighUsage) {
      const event = eventBuilders.resourceUsageHigh(metrics);
      analytics.track(event.event, event.properties);
    }
    
    return metrics;
  }
}

// Export singleton instance
export const resourceMonitor = ResourceMonitor.getInstance();
