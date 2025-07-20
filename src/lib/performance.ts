/**
 * @fileoverview Performance optimization utilities
 * Provides functions and utilities to improve application performance
 */

import { logger } from '@/lib/logger';

/**
 * Memoization utility for expensive function calls
 * Caches function results based on arguments to avoid repeated calculations
 * 
 * @param fn - The function to memoize
 * @param keyGenerator - Optional custom key generator for cache keys
 * @returns Memoized version of the function
 * 
 * @example
 * ```typescript
 * const expensiveCalculation = memoize((a: number, b: number) => {
 *   logger.debug('Calculating...');
 *   return a * b * Math.random();
 * });
 * 
 * expensiveCalculation(5, 10); // Logs "Calculating..." and returns result
 * expensiveCalculation(5, 10); // Returns cached result, no log
 * ```
 */
export function memoize<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  keyGenerator?: (...args: TArgs) => string
): (...args: TArgs) => TReturn {
  const cache = new Map<string, TReturn>();
  
  return (...args: TArgs): TReturn => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * LRU (Least Recently Used) Cache implementation
 * Automatically evicts least recently used items when capacity is exceeded
 */
export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache
   * Moves the item to the end (most recently used)
   */
  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      const value = this.cache.get(key)!;
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  /**
   * Set a value in the cache
   * Evicts least recently used item if capacity is exceeded
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing key
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, value);
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Batch processor for handling multiple operations efficiently
 * Collects operations and processes them in batches to reduce overhead
 */
export class BatchProcessor<T> {
  private batch: T[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private processor: (items: T[]) => Promise<void>;
  private batchSize: number;
  private delay: number;

  constructor(
    processor: (items: T[]) => Promise<void>,
    batchSize: number = 10,
    delay: number = 100
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.delay = delay;
  }

  /**
   * Add an item to the batch
   * Automatically processes the batch when size limit is reached or delay expires
   */
  add(item: T): void {
    this.batch.push(item);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Immediately process all items in the batch
   */
  async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.batch.length === 0) {
      return;
    }

    const items = [...this.batch];
    this.batch = [];

    try {
      await this.processor(items);
    } catch (error) {
      logger.error('Batch processing error:', error);
    }
  }

  private scheduleFlush(): void {
    if (this.timeoutId) {
      return;
    }

    this.timeoutId = setTimeout(() => {
      this.flush();
    }, this.delay);
  }
}

/**
 * Virtual scrolling utility for large lists
 * Calculates which items should be rendered based on scroll position
 */
export function calculateVirtualScrollItems(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan: number = 5
): { startIndex: number; endIndex: number; offsetY: number } {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + overscan * 2);
  const offsetY = startIndex * itemHeight;

  return { startIndex, endIndex, offsetY };
}

/**
 * Image lazy loading utility
 * Provides intersection observer for lazy loading images
 */
export class LazyImageLoader {
  private observer: IntersectionObserver;
  private images: Set<HTMLImageElement> = new Set();

  constructor(options: IntersectionObserverInit = {}) {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          this.loadImage(img);
        }
      });
    }, {
      rootMargin: '50px',
      ...options
    });
  }

  /**
   * Observe an image element for lazy loading
   */
  observe(img: HTMLImageElement): void {
    this.images.add(img);
    this.observer.observe(img);
  }

  /**
   * Stop observing an image element
   */
  unobserve(img: HTMLImageElement): void {
    this.images.delete(img);
    this.observer.unobserve(img);
  }

  /**
   * Load an image and stop observing it
   */
  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
      this.unobserve(img);
    }
  }

  /**
   * Disconnect the observer and clean up
   */
  disconnect(): void {
    this.observer.disconnect();
    this.images.clear();
  }
}

/**
 * Performance monitoring utility
 * Tracks and reports performance metrics
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  /**
   * Start timing an operation
   */
  startTiming(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.recordMetric(name, duration);
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }

  /**
   * Get performance statistics for a metric
   */
  getStats(name: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { avg, min, max, count: values.length };
  }

  /**
   * Get all recorded metrics
   */
  getAllStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, any> = {};
    
    for (const [name] of this.metrics) {
      const stats = this.getStats(name);
      if (stats) {
        result[name] = stats;
      }
    }
    
    return result;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Throttle function execution
 * Ensures a function is called at most once per specified interval
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}