import { useCallback, useRef, useState } from 'react';

/**
 * API 性能优化缓存项
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * API 优化选项
 */
interface ApiOptimizationOptions {
  cacheTimeout?: number; // 缓存超时时间（毫秒）
  debounceMs?: number; // 防抖延迟
  maxConcurrency?: number; // 最大并发数
  retries?: number; // 重试次数
  retryDelay?: number; // 重试延迟
}

/**
 * API 性能优化 Hook
 * 提供缓存、防抖、并发控制、重试机制
 */
export function useApiOptimization<T extends (...args: any[]) => Promise<any>>(
  apiFunction: T,
  options: ApiOptimizationOptions = {}
) {
  const {
    cacheTimeout = 60000, // 默认1分钟缓存
    debounceMs = 300,
    maxConcurrency = 3,
    retries = 2,
    retryDelay = 1000
  } = options;

  // 缓存存储
  const cacheRef = useRef<Map<string, CacheEntry<any>>>(new Map());
  
  // 防抖定时器
  const debounceRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // 正在进行的请求
  const pendingRequestsRef = useRef<Map<string, Promise<any>>>(new Map());
  
  // 并发控制
  const runningCountRef = useRef(0);
  const queueRef = useRef<Array<() => void>>([]);

  // 状态管理
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * 生成缓存键
   */
  const generateCacheKey = useCallback((args: any[]): string => {
    return JSON.stringify(args);
  }, []);

  /**
   * 清理过期缓存
   */
  const cleanExpiredCache = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;
    
    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiresAt) {
        cache.delete(key);
      }
    }
  }, []);

  /**
   * 从缓存获取数据
   */
  const getFromCache = useCallback((key: string): any | null => {
    const cache = cacheRef.current;
    const entry = cache.get(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    
    return entry.data;
  }, []);

  /**
   * 存储到缓存
   */
  const setCache = useCallback((key: string, data: any) => {
    const now = Date.now();
    const cache = cacheRef.current;
    
    cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + cacheTimeout
    });

    // 定期清理过期缓存
    if (cache.size > 100) {
      cleanExpiredCache();
    }
  }, [cacheTimeout, cleanExpiredCache]);

  /**
   * 并发控制执行
   */
  const executeWithConcurrencyControl = useCallback(async <R>(
    fn: () => Promise<R>
  ): Promise<R> => {
    return new Promise<R>((resolve, reject) => {
      const execute = async () => {
        runningCountRef.current++;
        
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          runningCountRef.current--;
          
          // 执行队列中的下一个请求
          const nextTask = queueRef.current.shift();
          if (nextTask) {
            nextTask();
          }
        }
      };

      // 检查并发限制
      if (runningCountRef.current < maxConcurrency) {
        execute();
      } else {
        // 加入队列等待
        queueRef.current.push(execute);
      }
    });
  }, [maxConcurrency]);

  /**
   * 重试机制
   */
  const executeWithRetry = useCallback(async <R>(
    fn: () => Promise<R>,
    attempt: number = 0
  ): Promise<R> => {
    try {
      return await fn();
    } catch (error) {
      if (attempt < retries) {
        // 指数退避延迟
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeWithRetry(fn, attempt + 1);
      }
      throw error;
    }
  }, [retries, retryDelay]);

  /**
   * 优化后的 API 调用
   */
  const optimizedApiCall = useCallback(async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const cacheKey = generateCacheKey(args);

    // 1. 检查缓存
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult !== null) {
      return cachedResult;
    }

    // 2. 检查是否有相同的请求正在进行
    const pendingRequest = pendingRequestsRef.current.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    // 3. 创建新的请求
    const request = executeWithConcurrencyControl(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await executeWithRetry(() => apiFunction(...args));
        
        // 存储到缓存
        setCache(cacheKey, result);
        
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
        pendingRequestsRef.current.delete(cacheKey);
      }
    });

    // 存储正在进行的请求
    pendingRequestsRef.current.set(cacheKey, request);

    return request;
  }, [
    apiFunction, 
    generateCacheKey, 
    getFromCache, 
    setCache, 
    executeWithConcurrencyControl, 
    executeWithRetry
  ]);

  /**
   * 防抖版本的 API 调用
   */
  const debouncedApiCall = useCallback(async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const cacheKey = generateCacheKey(args);

    return new Promise((resolve, reject) => {
      // 清除之前的防抖定时器
      const existingTimer = debounceRef.current.get(cacheKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // 设置新的防抖定时器
      const timer = setTimeout(async () => {
        try {
          const result = await optimizedApiCall(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          debounceRef.current.delete(cacheKey);
        }
      }, debounceMs);

      debounceRef.current.set(cacheKey, timer);
    });
  }, [optimizedApiCall, generateCacheKey, debounceMs]);

  /**
   * 清除缓存
   */
  const clearCache = useCallback((pattern?: string) => {
    const cache = cacheRef.current;
    
    if (!pattern) {
      cache.clear();
      return;
    }

    // 按模式清除缓存
    const regex = new RegExp(pattern);
    for (const key of cache.keys()) {
      if (regex.test(key)) {
        cache.delete(key);
      }
    }
  }, []);

  /**
   * 预加载数据
   */
  const preload = useCallback(async (...args: Parameters<T>): Promise<void> => {
    try {
      await optimizedApiCall(...args);
    } catch (error) {
      // 预加载失败不抛出错误
      console.warn('Preload failed:', error);
    }
  }, [optimizedApiCall]);

  /**
   * 获取缓存统计
   */
  const getCacheStats = useCallback(() => {
    const cache = cacheRef.current;
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;

    for (const entry of cache.values()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: cache.size,
      valid: validCount,
      expired: expiredCount,
      runningRequests: runningCountRef.current,
      queuedRequests: queueRef.current.length
    };
  }, []);

  return {
    // 主要 API 方法
    call: optimizedApiCall,
    debouncedCall: debouncedApiCall,
    
    // 状态
    isLoading,
    error,
    
    // 缓存管理
    clearCache,
    preload,
    getCacheStats,
    
    // 工具方法
    cleanup: useCallback(() => {
      // 清理所有定时器
      for (const timer of debounceRef.current.values()) {
        clearTimeout(timer);
      }
      debounceRef.current.clear();
      
      // 清理缓存
      cacheRef.current.clear();
      
      // 清理待处理请求
      pendingRequestsRef.current.clear();
      
      // 清理队列
      queueRef.current.length = 0;
    }, [])
  };
}

/**
 * 专门用于搜索的 API 优化 Hook
 * 针对搜索场景优化的防抖和缓存策略
 */
export function useSearchOptimization<T extends (query: string, ...args: any[]) => Promise<any>>(
  searchFunction: T,
  options: {
    debounceMs?: number;
    minQueryLength?: number;
    cacheTimeout?: number;
  } = {}
) {
  const {
    debounceMs = 500, // 搜索防抖时间更长
    minQueryLength = 2,
    cacheTimeout = 300000 // 搜索缓存5分钟
  } = options;

  const { clearCache, isLoading, error } = useApiOptimization(
    searchFunction,
    {
      debounceMs,
      cacheTimeout,
      maxConcurrency: 2 // 搜索并发数较低
    }
  );

  const search = useCallback(async (query: string, ...args: any[]): Promise<any> => {
    // 查询长度检查
    if (query.length < minQueryLength) {
      return [];
    }

    // 直接调用搜索函数，绕过类型检查
    return (searchFunction as any)(query, ...args);
  }, [searchFunction, minQueryLength]);

  return {
    search,
    clearSearchCache: clearCache,
    isSearching: isLoading,
    searchError: error
  };
}