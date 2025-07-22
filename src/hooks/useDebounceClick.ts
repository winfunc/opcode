import { useCallback, useRef } from 'react';

/**
 * 防抖动点击 Hook - 防止重复点击和提供立即反馈
 * 
 * @param callback 点击回调函数
 * @param delay 防抖延迟时间（毫秒）
 * @param immediate 是否立即提供视觉反馈
 * @returns 防抖后的点击处理器和状态
 */
export function useDebounceClick<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300,
  immediate: boolean = true
) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isLoadingRef = useRef(false);

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    // 如果已经在处理中，直接返回
    if (isLoadingRef.current) {
      return;
    }

    // 设置加载状态
    isLoadingRef.current = true;

    // 立即视觉反馈
    if (immediate) {
      // 添加立即反馈类
      const target = args[0]?.currentTarget;
      if (target) {
        target.classList.add('instant-feedback');
        target.setAttribute('data-loading', 'true');
      }
    }

    // 清除之前的超时
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 设置新的防抖超时
    timeoutRef.current = setTimeout(async () => {
      try {
        // 执行实际回调
        await callback(...args);
      } catch (error) {
        console.error('Debounced click error:', error);
      } finally {
        // 重置状态
        isLoadingRef.current = false;
        
        // 移除加载状态
        if (immediate) {
          const target = args[0]?.currentTarget;
          if (target) {
            target.removeAttribute('data-loading');
            target.classList.remove('instant-feedback');
          }
        }
      }
    }, delay);
  }, [callback, delay, immediate]);

  // 清理函数
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    isLoadingRef.current = false;
  }, []);

  return {
    debouncedCallback,
    isLoading: isLoadingRef.current,
    cleanup
  };
}

/**
 * 性能优化的点击处理器 Hook
 * 提供立即反馈和防抖保护
 */
export function usePerformanceClick<T extends (...args: any[]) => any>(
  callback: T,
  options: {
    debounceMs?: number;
    preventDoubleClick?: boolean;
    immediateResponse?: boolean;
  } = {}
) {
  const {
    debounceMs = 150,
    preventDoubleClick = true,
    immediateResponse = true
  } = options;

  const lastClickRef = useRef<number>(0);
  const processingRef = useRef(false);

  const optimizedCallback = useCallback(async (...args: Parameters<T>) => {
    const now = Date.now();
    
    // 防止双击
    if (preventDoubleClick && now - lastClickRef.current < debounceMs) {
      return;
    }
    
    // 防止重复处理
    if (processingRef.current) {
      return;
    }

    lastClickRef.current = now;
    processingRef.current = true;

    // 立即视觉反馈
    if (immediateResponse) {
      const element = args[0]?.currentTarget;
      if (element) {
        element.classList.add('immediate-response');
        
        // 50ms 后移除立即反馈类
        setTimeout(() => {
          element.classList.remove('immediate-response');
        }, 50);
      }
    }

    try {
      // 执行回调
      const result = await callback(...args);
      return result;
    } catch (error) {
      console.error('Performance click error:', error);
      throw error;
    } finally {
      // 重置处理状态
      setTimeout(() => {
        processingRef.current = false;
      }, debounceMs);
    }
  }, [callback, debounceMs, preventDoubleClick, immediateResponse]);

  return optimizedCallback;
}

/**
 * API 调用防抖 Hook
 * 专为 API 调用优化的防抖处理
 */
export function useApiDebounce<T extends (...args: any[]) => Promise<any>>(
  apiCall: T,
  delay: number = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const requestRef = useRef<AbortController>();

  const debouncedApiCall = useCallback(async (...args: Parameters<T>) => {
    // 取消之前的请求
    if (requestRef.current) {
      requestRef.current.abort();
    }

    // 清除之前的超时
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 创建新的 AbortController
    requestRef.current = new AbortController();
    const signal = requestRef.current.signal;

    return new Promise((resolve, reject) => {
      timeoutRef.current = setTimeout(async () => {
        try {
          // 检查是否被取消
          if (signal.aborted) {
            reject(new Error('Request cancelled'));
            return;
          }

          // 执行 API 调用
          const result = await apiCall(...args);
          
          // 再次检查是否被取消
          if (signal.aborted) {
            reject(new Error('Request cancelled'));
            return;
          }

          resolve(result);
        } catch (error) {
          if (!signal.aborted) {
            reject(error);
          }
        }
      }, delay);
    });
  }, [apiCall, delay]);

  // 清理函数
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (requestRef.current) {
      requestRef.current.abort();
    }
  }, []);

  return { debouncedApiCall, cleanup };
}