import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  memoize,
  LRUCache,
  BatchProcessor,
  calculateVirtualScrollItems,
  LazyImageLoader,
  PerformanceMonitor,
  performanceMonitor,
  throttle,
} from "../performance";

/**
 * Test suite for performance utilities
 *
 * Tests all performance optimization utilities including memoization,
 * caching, batch processing, virtual scrolling, lazy loading, monitoring,
 * and throttling functionality.
 */
describe("Performance Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("memoize", () => {
    it("should cache function results", () => {
      const mockFn = vi.fn((a: number, b: number) => a + b);
      const memoizedFn = memoize(mockFn);

      // First call
      expect(memoizedFn(1, 2)).toBe(3);
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Second call with same arguments - should use cache
      expect(memoizedFn(1, 2)).toBe(3);
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Third call with different arguments
      expect(memoizedFn(2, 3)).toBe(5);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should use custom key generator when provided", () => {
      const mockFn = vi.fn((obj: { id: number; name: string }) => obj.id);
      const keyGenerator = (obj: { id: number; name: string }) => obj.id.toString();
      const memoizedFn = memoize(mockFn, keyGenerator);

      const obj1 = { id: 1, name: "first" };
      const obj2 = { id: 1, name: "second" }; // Same ID, different name

      expect(memoizedFn(obj1)).toBe(1);
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Should use cache because ID is the same
      expect(memoizedFn(obj2)).toBe(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should handle functions with no arguments", () => {
      const mockFn = vi.fn(() => Math.random());
      const memoizedFn = memoize(mockFn);

      const result1 = memoizedFn();
      const result2 = memoizedFn();

      expect(result1).toBe(result2);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("LRUCache", () => {
    it("should store and retrieve values", () => {
      const cache = new LRUCache<string, number>(3);

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      expect(cache.get("a")).toBe(1);
      expect(cache.get("b")).toBe(2);
      expect(cache.get("c")).toBe(3);
      expect(cache.size()).toBe(3);
    });

    it("should evict least recently used items when capacity is exceeded", () => {
      const cache = new LRUCache<string, number>(2);

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3); // Should evict 'a'

      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBe(2);
      expect(cache.get("c")).toBe(3);
      expect(cache.size()).toBe(2);
    });

    it("should update access order when getting items", () => {
      const cache = new LRUCache<string, number>(2);

      cache.set("a", 1);
      cache.set("b", 2);

      // Access 'a' to make it most recently used
      cache.get("a");

      cache.set("c", 3); // Should evict 'b', not 'a'

      expect(cache.get("a")).toBe(1);
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("c")).toBe(3);
    });

    it("should update existing keys without changing size", () => {
      const cache = new LRUCache<string, number>(2);

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("a", 10); // Update existing key

      expect(cache.get("a")).toBe(10);
      expect(cache.get("b")).toBe(2);
      expect(cache.size()).toBe(2);
    });

    it("should check if keys exist", () => {
      const cache = new LRUCache<string, number>(2);

      cache.set("a", 1);

      expect(cache.has("a")).toBe(true);
      expect(cache.has("b")).toBe(false);
    });

    it("should clear all items", () => {
      const cache = new LRUCache<string, number>(2);

      cache.set("a", 1);
      cache.set("b", 2);
      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(false);
    });
  });

  describe("BatchProcessor", () => {
    it("should process items in batches when size limit is reached", async () => {
      const mockProcessor = vi.fn().mockResolvedValue(undefined);
      const batchProcessor = new BatchProcessor(mockProcessor, 3, 1000);

      batchProcessor.add("item1");
      batchProcessor.add("item2");
      batchProcessor.add("item3"); // Should trigger processing

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(mockProcessor).toHaveBeenCalledWith(["item1", "item2", "item3"]);
    });

    it("should process items after delay when size limit is not reached", async () => {
      vi.useFakeTimers();

      const mockProcessor = vi.fn().mockResolvedValue(undefined);
      const batchProcessor = new BatchProcessor(mockProcessor, 5, 100);

      batchProcessor.add("item1");
      batchProcessor.add("item2");

      // Advance time to trigger delay-based processing
      vi.advanceTimersByTime(150);

      await vi.runAllTimersAsync();

      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(mockProcessor).toHaveBeenCalledWith(["item1", "item2"]);

      vi.useRealTimers();
    });

    it("should handle processor errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockProcessor = vi.fn().mockRejectedValue(new Error("Processing failed"));
      const batchProcessor = new BatchProcessor(mockProcessor, 2, 1000);

      batchProcessor.add("item1");
      batchProcessor.add("item2");

      await new Promise((resolve) => setTimeout(resolve, 10));

      // The error is logged through the logger system, so check for any error call
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should flush immediately when requested", async () => {
      const mockProcessor = vi.fn().mockResolvedValue(undefined);
      const batchProcessor = new BatchProcessor(mockProcessor, 10, 1000);

      batchProcessor.add("item1");
      batchProcessor.add("item2");

      await batchProcessor.flush();

      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(mockProcessor).toHaveBeenCalledWith(["item1", "item2"]);
    });
  });

  describe("calculateVirtualScrollItems", () => {
    it("should calculate visible items correctly", () => {
      const result = calculateVirtualScrollItems(
        100, // scrollTop
        200, // containerHeight
        50, // itemHeight
        100 // totalItems
      );

      expect(result.startIndex).toBe(0); // Math.max(0, Math.floor(100/50) - 5)
      expect(result.endIndex).toBe(14); // Math.min(99, 0 + Math.ceil(200/50) + 10)
      expect(result.offsetY).toBe(0); // startIndex * itemHeight
    });

    it("should handle scrolling to middle of list", () => {
      const result = calculateVirtualScrollItems(
        1000, // scrollTop
        200, // containerHeight
        50, // itemHeight
        100 // totalItems
      );

      expect(result.startIndex).toBe(15); // Math.max(0, Math.floor(1000/50) - 5)
      expect(result.endIndex).toBe(29); // Math.min(99, 15 + Math.ceil(200/50) + 10)
      expect(result.offsetY).toBe(750); // 15 * 50
    });

    it("should handle end of list", () => {
      const result = calculateVirtualScrollItems(
        4500, // scrollTop (near end)
        200, // containerHeight
        50, // itemHeight
        100 // totalItems
      );

      expect(result.startIndex).toBe(85); // Math.max(0, Math.floor(4500/50) - 5)
      expect(result.endIndex).toBe(99); // Math.min(99, ...)
      expect(result.offsetY).toBe(4250); // 85 * 50
    });

    it("should use custom overscan value", () => {
      const result = calculateVirtualScrollItems(
        100, // scrollTop
        200, // containerHeight
        50, // itemHeight
        100, // totalItems
        10 // overscan
      );

      expect(result.startIndex).toBe(0); // Math.max(0, Math.floor(100/50) - 10)
      expect(result.endIndex).toBe(24); // More items due to larger overscan
    });
  });

  describe("LazyImageLoader", () => {
    let mockIntersectionObserver: any;
    let mockObserve: any;
    let mockUnobserve: any;
    let mockDisconnect: any;

    beforeEach(() => {
      mockObserve = vi.fn();
      mockUnobserve = vi.fn();
      mockDisconnect = vi.fn();

      mockIntersectionObserver = vi.fn().mockImplementation((callback) => ({
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: mockDisconnect,
        callback,
      }));

      global.IntersectionObserver = mockIntersectionObserver;
    });

    it("should create intersection observer with default options", () => {
      new LazyImageLoader();

      expect(mockIntersectionObserver).toHaveBeenCalledWith(expect.any(Function), {
        rootMargin: "50px",
      });
    });

    it("should observe images", () => {
      const loader = new LazyImageLoader();
      const mockImg = document.createElement("img");

      loader.observe(mockImg);

      expect(mockObserve).toHaveBeenCalledWith(mockImg);
    });

    it("should unobserve images", () => {
      const loader = new LazyImageLoader();
      const mockImg = document.createElement("img");

      loader.observe(mockImg);
      loader.unobserve(mockImg);

      expect(mockUnobserve).toHaveBeenCalledWith(mockImg);
    });

    it("should load image when intersecting", () => {
      let observerCallback: any;
      mockIntersectionObserver.mockImplementation((callback: any) => {
        observerCallback = callback;
        return {
          observe: mockObserve,
          unobserve: mockUnobserve,
          disconnect: mockDisconnect,
        };
      });

      const loader = new LazyImageLoader();
      const mockImg = document.createElement("img");
      mockImg.dataset.src = "test-image.jpg";

      loader.observe(mockImg);

      // Simulate intersection
      observerCallback([
        {
          target: mockImg,
          isIntersecting: true,
        },
      ]);

      expect(mockImg.src).toBe("http://localhost:3000/test-image.jpg");
      expect(mockImg.dataset.src).toBeUndefined();
    });

    it("should disconnect observer", () => {
      const loader = new LazyImageLoader();
      loader.disconnect();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe("PerformanceMonitor", () => {
    it("should record timing metrics", () => {
      const monitor = new PerformanceMonitor();

      const endTiming = monitor.startTiming("test-operation");
      endTiming();

      const stats = monitor.getStats("test-operation");
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.avg).toBeGreaterThan(0);
    });

    it("should record manual metrics", () => {
      const monitor = new PerformanceMonitor();

      monitor.recordMetric("custom-metric", 100);
      monitor.recordMetric("custom-metric", 200);
      monitor.recordMetric("custom-metric", 300);

      const stats = monitor.getStats("custom-metric");
      expect(stats).toEqual({
        avg: 200,
        min: 100,
        max: 300,
        count: 3,
      });
    });

    it("should limit stored measurements", () => {
      const monitor = new PerformanceMonitor();

      // Record more than 100 measurements
      for (let i = 0; i < 150; i++) {
        monitor.recordMetric("test", i);
      }

      const stats = monitor.getStats("test");
      expect(stats?.count).toBe(100); // Should be limited to 100
      expect(stats?.min).toBe(50); // Should have dropped first 50 values
    });

    it("should return null for non-existent metrics", () => {
      const monitor = new PerformanceMonitor();
      expect(monitor.getStats("non-existent")).toBeNull();
    });

    it("should get all stats", () => {
      const monitor = new PerformanceMonitor();

      monitor.recordMetric("metric1", 100);
      monitor.recordMetric("metric2", 200);

      const allStats = monitor.getAllStats();
      expect(Object.keys(allStats)).toEqual(["metric1", "metric2"]);
    });

    it("should clear all metrics", () => {
      const monitor = new PerformanceMonitor();

      monitor.recordMetric("test", 100);
      monitor.clear();

      expect(monitor.getStats("test")).toBeNull();
      expect(Object.keys(monitor.getAllStats())).toHaveLength(0);
    });
  });

  describe("throttle", () => {
    it("should throttle function calls", () => {
      vi.useFakeTimers();

      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 1000);

      throttledFn("arg1");
      throttledFn("arg2");
      throttledFn("arg3");

      // Only first call should execute immediately
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith("arg1");

      // Advance time past throttle limit
      vi.advanceTimersByTime(1100);

      throttledFn("arg4");

      // Should execute again
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith("arg4");

      vi.useRealTimers();
    });

    it("should preserve function context", () => {
      vi.useFakeTimers();

      const obj = {
        value: "test",
        method: vi.fn(function (this: any) {
          return this.value;
        }),
      };

      const throttledMethod = throttle(obj.method, 1000);
      throttledMethod.call(obj);

      expect(obj.method).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("Global performance monitor", () => {
    it("should be available as singleton", () => {
      expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
    });
  });
});
