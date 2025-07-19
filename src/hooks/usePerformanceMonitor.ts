import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 性能指标类型
 */
interface PerformanceMetrics {
  clickResponseTime: number;
  renderTime: number;
  memoryUsage?: number;
  componentMountTime: number;
  lastInteractionTime: number;
}

/**
 * 性能阈值配置
 */
interface PerformanceThresholds {
  clickResponseWarning: number; // 点击响应警告阈值（ms）
  clickResponseError: number; // 点击响应错误阈值（ms）
  renderWarning: number; // 渲染警告阈值（ms）
  renderError: number; // 渲染错误阈值（ms）
}

/**
 * 性能事件类型
 */
type PerformanceEventType = 'click' | 'render' | 'mount' | 'api' | 'scroll';

/**
 * 性能事件记录
 */
interface PerformanceEvent {
  type: PerformanceEventType;
  timestamp: number;
  duration: number;
  componentName?: string;
  details?: any;
}

/**
 * 性能监控 Hook
 * 监控应用性能并提供实时反馈
 */
export function usePerformanceMonitor(
  componentName?: string,
  thresholds: Partial<PerformanceThresholds> = {}
) {
  const defaultThresholds: PerformanceThresholds = {
    clickResponseWarning: 100,
    clickResponseError: 300,
    renderWarning: 16, // 60fps = 16.67ms per frame
    renderError: 50,
    ...thresholds
  };

  // 性能记录存储
  const eventsRef = useRef<PerformanceEvent[]>([]);
  const metricsRef = useRef<PerformanceMetrics>({
    clickResponseTime: 0,
    renderTime: 0,
    componentMountTime: 0,
    lastInteractionTime: 0
  });

  // 时间戳记录
  const timingRef = useRef<{ [key: string]: number }>({});
  
  // 状态管理
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics>(metricsRef.current);

  /**
   * 记录性能事件
   */
  const recordEvent = useCallback((
    type: PerformanceEventType,
    duration: number,
    details?: any
  ) => {
    const event: PerformanceEvent = {
      type,
      timestamp: Date.now(),
      duration,
      componentName,
      details
    };

    eventsRef.current.push(event);
    
    // 保持事件记录数量在合理范围内
    if (eventsRef.current.length > 1000) {
      eventsRef.current = eventsRef.current.slice(-500);
    }

    // 更新指标
    const metrics = metricsRef.current;
    switch (type) {
      case 'click':
        metrics.clickResponseTime = duration;
        metrics.lastInteractionTime = Date.now();
        break;
      case 'render':
        metrics.renderTime = duration;
        break;
      case 'mount':
        metrics.componentMountTime = duration;
        break;
    }

    setCurrentMetrics({ ...metrics });

    // 性能警告检查
    checkPerformanceThresholds(type, duration);
  }, [componentName, defaultThresholds]);

  /**
   * 检查性能阈值
   */
  const checkPerformanceThresholds = useCallback((
    type: PerformanceEventType,
    duration: number
  ) => {
    let warning = false;
    let error = false;

    switch (type) {
      case 'click':
        warning = duration > defaultThresholds.clickResponseWarning;
        error = duration > defaultThresholds.clickResponseError;
        break;
      case 'render':
        warning = duration > defaultThresholds.renderWarning;
        error = duration > defaultThresholds.renderError;
        break;
    }

    if (error) {
      console.error(`🔴 Performance Error: ${type} took ${duration}ms in ${componentName || 'unknown'}`);
    } else if (warning) {
      console.warn(`🟡 Performance Warning: ${type} took ${duration}ms in ${componentName || 'unknown'}`);
    }
  }, [defaultThresholds, componentName]);

  /**
   * 开始计时
   */
  const startTiming = useCallback((key: string) => {
    timingRef.current[key] = performance.now();
  }, []);

  /**
   * 结束计时并记录
   */
  const endTiming = useCallback((key: string, type: PerformanceEventType, details?: any) => {
    const startTime = timingRef.current[key];
    if (startTime) {
      const duration = performance.now() - startTime;
      recordEvent(type, duration, details);
      delete timingRef.current[key];
      return duration;
    }
    return 0;
  }, [recordEvent]);

  /**
   * 测量点击响应时间
   */
  const measureClickResponse = useCallback((callback: () => void | Promise<void>) => {
    return async (event: any) => {
      const startTime = performance.now();
      
      try {
        await callback();
      } finally {
        const duration = performance.now() - startTime;
        recordEvent('click', duration, { 
          target: event?.target?.tagName,
          id: event?.target?.id 
        });
      }
    };
  }, [recordEvent]);

  /**
   * 测量渲染时间
   */
  const measureRender = useCallback(() => {
    startTiming('render');
    
    // 使用 requestAnimationFrame 来测量实际渲染时间
    return () => {
      requestAnimationFrame(() => {
        endTiming('render', 'render');
      });
    };
  }, [startTiming, endTiming]);

  /**
   * 获取性能统计
   */
  const getPerformanceStats = useCallback(() => {
    const events = eventsRef.current;
    const now = Date.now();
    const last5Minutes = events.filter(e => now - e.timestamp < 300000);

    const clickEvents = last5Minutes.filter(e => e.type === 'click');
    const renderEvents = last5Minutes.filter(e => e.type === 'render');

    return {
      totalEvents: events.length,
      recentEvents: last5Minutes.length,
      averageClickTime: clickEvents.length > 0 
        ? clickEvents.reduce((sum, e) => sum + e.duration, 0) / clickEvents.length 
        : 0,
      averageRenderTime: renderEvents.length > 0
        ? renderEvents.reduce((sum, e) => sum + e.duration, 0) / renderEvents.length
        : 0,
      maxClickTime: clickEvents.length > 0 
        ? Math.max(...clickEvents.map(e => e.duration))
        : 0,
      maxRenderTime: renderEvents.length > 0
        ? Math.max(...renderEvents.map(e => e.duration))
        : 0,
      performanceScore: calculatePerformanceScore(last5Minutes),
      memoryUsage: getMemoryUsage()
    };
  }, []);

  /**
   * 计算性能分数 (0-100)
   */
  const calculatePerformanceScore = useCallback((events: PerformanceEvent[]) => {
    if (events.length === 0) return 100;

    const clickEvents = events.filter(e => e.type === 'click');
    const renderEvents = events.filter(e => e.type === 'render');

    let score = 100;

    // 点击响应时间评分
    const avgClickTime = clickEvents.length > 0
      ? clickEvents.reduce((sum, e) => sum + e.duration, 0) / clickEvents.length
      : 0;
    
    if (avgClickTime > defaultThresholds.clickResponseError) {
      score -= 30;
    } else if (avgClickTime > defaultThresholds.clickResponseWarning) {
      score -= 15;
    }

    // 渲染时间评分
    const avgRenderTime = renderEvents.length > 0
      ? renderEvents.reduce((sum, e) => sum + e.duration, 0) / renderEvents.length
      : 0;

    if (avgRenderTime > defaultThresholds.renderError) {
      score -= 20;
    } else if (avgRenderTime > defaultThresholds.renderWarning) {
      score -= 10;
    }

    return Math.max(0, score);
  }, [defaultThresholds]);

  /**
   * 获取内存使用情况
   */
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      return {
        used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
      };
    }
    return null;
  }, []);

  /**
   * 清除性能记录
   */
  const clearMetrics = useCallback(() => {
    eventsRef.current = [];
    timingRef.current = {};
    metricsRef.current = {
      clickResponseTime: 0,
      renderTime: 0,
      componentMountTime: 0,
      lastInteractionTime: 0
    };
    setCurrentMetrics({ ...metricsRef.current });
  }, []);

  /**
   * 导出性能数据
   */
  const exportMetrics = useCallback(() => {
    const stats = getPerformanceStats();
    return {
      componentName,
      timestamp: Date.now(),
      events: eventsRef.current,
      stats,
      thresholds: defaultThresholds
    };
  }, [componentName, getPerformanceStats, defaultThresholds]);

  // 组件挂载时间监控
  useEffect(() => {
    const mountStartTime = performance.now();
    setIsMonitoring(true);

    return () => {
      const mountDuration = performance.now() - mountStartTime;
      recordEvent('mount', mountDuration);
      setIsMonitoring(false);
    };
  }, [recordEvent]);

  // 内存使用监控（开发环境）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        const memory = getMemoryUsage();
        if (memory && memory.used > memory.limit * 0.9) {
          console.warn('🔴 High memory usage detected:', memory);
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [getMemoryUsage]);

  return {
    // 主要方法
    measureClickResponse,
    measureRender,
    startTiming,
    endTiming,
    recordEvent,
    
    // 状态和指标
    isMonitoring,
    currentMetrics,
    
    // 统计和分析
    getPerformanceStats,
    exportMetrics,
    clearMetrics,
    
    // 工具方法
    getMemoryUsage
  };
}

/**
 * 全局性能监控 Hook
 * 监控整个应用的性能
 */
export function useGlobalPerformanceMonitor() {
  const [performanceData, setPerformanceData] = useState<any>(null);

  // 监控 Web Vitals
  useEffect(() => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // 监控 LCP (Largest Contentful Paint)
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        setPerformanceData((prev: any) => ({
          ...prev,
          lcp: lastEntry.startTime
        }));
      });

      try {
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // 浏览器不支持
        console.warn('LCP monitoring not supported');
      }

      return () => observer.disconnect();
    }
  }, []);

  // 监控导航性能
  useEffect(() => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigation) {
        setPerformanceData((prev: any) => ({
          ...prev,
          navigationTiming: {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
            loadComplete: navigation.loadEventEnd - navigation.fetchStart,
            firstByte: navigation.responseStart - navigation.fetchStart
          }
        }));
      }
    }
  }, []);

  return {
    performanceData,
    isSupported: typeof window !== 'undefined' && 'performance' in window
  };
}