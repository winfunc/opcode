/**
 * React Hook for unified error handling
 * 提供React组件中使用统一错误处理的Hook
 */

import { useCallback, useEffect, useRef } from "react";
import { errorHandler, ErrorType, type ErrorConfig } from "@/lib/errorHandler";
import { logger } from "@/lib/logger";

/**
 * Configuration options for the useErrorHandler hook
 */
interface UseErrorHandlerOptions {
  // 默认错误配置
  defaultConfig?: Partial<ErrorConfig>;
  // 是否自动处理组件内的错误
  autoHandle?: boolean;
  // 错误处理回调
  onError?: (error: Error, context?: Record<string, unknown>) => void;
  // 错误恢复回调
  onRecover?: () => void;
}

/**
 * Return type for the useErrorHandler hook
 */
interface UseErrorHandlerReturn {
  // 处理错误的主要方法
  handleError: (
    error: Error | string,
    context?: Record<string, unknown>,
    customConfig?: Partial<ErrorConfig>
  ) => Promise<void>;

  // 特定类型的错误处理方法
  handleNetworkError: (error: Error | string, context?: Record<string, unknown>) => Promise<void>;
  handleApiError: (error: Error | string, context?: Record<string, unknown>) => Promise<void>;
  handleValidationError: (
    error: Error | string,
    context?: Record<string, unknown>
  ) => Promise<void>;
  handlePermissionError: (
    error: Error | string,
    context?: Record<string, unknown>
  ) => Promise<void>;

  // 清除错误状态
  clearErrors: () => void;

  // 重试最后一个失败的操作
  retry: () => Promise<void>;

  // 错误边界处理
  withErrorBoundary: <T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    fallback?: R
  ) => (...args: T) => Promise<R>;
}

/**
 * 统一错误处理Hook
 *
 * @param options 配置选项
 * @returns 错误处理方法和状态
 *
 * @example
 * ```tsx
 * const { handleError, handleApiError, withErrorBoundary } = useErrorHandler({
 *   defaultConfig: { strategy: ErrorStrategy.TOAST },
 *   onError: (error) => logger.info('Error occurred:', error)
 * });
 *
 * // 直接处理错误
 * const fetchData = async () => {
 *   try {
 *     const data = await api.getData();
 *     return data;
 *   } catch (error) {
 *     await handleApiError(error, { operation: 'fetchData' });
 *   }
 * };
 *
 * // 使用错误边界包装
 * const safeFetchData = withErrorBoundary(api.getData, []);
 * ```
 */
/**
 * React hook for unified error handling in components
 *
 * Provides a consistent way to handle errors in React components with
 * automatic error classification, user notification, and recovery mechanisms.
 * Integrates with the global error handling system while providing component-specific features.
 *
 * @param options - Configuration options for error handling behavior
 * @returns Object containing error handling functions and state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { handleError, handleAsync, isHandling, lastError, clearError } = useErrorHandler({
 *     defaultConfig: { strategy: ErrorStrategy.TOAST },
 *     onError: (error) => console.log('Component error:', error),
 *     onRecover: () => console.log('Component recovered')
 *   });
 *
 *   const fetchData = handleAsync(async () => {
 *     const data = await api.getData();
 *     return data;
 *   });
 *
 *   return (
 *     <div>
 *       {lastError && (
 *         <div className="error">
 *           Error: {lastError.message}
 *           <button onClick={clearError}>Clear</button>
 *         </div>
 *       )}
 *       <button onClick={fetchData} disabled={isHandling}>
 *         {isHandling ? 'Loading...' : 'Fetch Data'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn {
  const { defaultConfig, onError, onRecover } = options;

  const lastErrorRef = useRef<{
    error: Error | string;
    context?: Record<string, unknown>;
    config?: Partial<ErrorConfig>;
  } | null>(null);

  const isMountedRef = useRef(true);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 主要错误处理方法
  const handleError = useCallback(
    async (
      error: Error | string,
      context?: Record<string, unknown>,
      customConfig?: Partial<ErrorConfig>
    ) => {
      if (!isMountedRef.current) return;

      try {
        // 保存最后一个错误用于重试
        lastErrorRef.current = { error, context, config: customConfig };

        // 合并配置
        const finalConfig = {
          ...defaultConfig,
          ...customConfig,
        };

        // 添加组件上下文信息
        const enhancedContext = {
          ...context,
          component: "useErrorHandler",
          timestamp: Date.now(),
        };

        // 调用错误处理器
        const result = await errorHandler.handle(error, enhancedContext, finalConfig);

        // 调用错误回调
        if (onError) {
          const errorObj = error instanceof Error ? error : new Error(error);
          onError(errorObj, enhancedContext);
        }

        logger.debug("Error handled by useErrorHandler:", {
          error: error instanceof Error ? error.message : error,
          result,
          context: enhancedContext,
        });
      } catch (handlingError) {
        logger.error("Failed to handle error in useErrorHandler:", handlingError);
      }
    },
    [defaultConfig, onError]
  );

  // 网络错误处理
  const handleNetworkError = useCallback(
    (error: Error | string, context?: Record<string, unknown>) => {
      return handleError(error, context, { type: ErrorType.NETWORK });
    },
    [handleError]
  );

  // API错误处理
  const handleApiError = useCallback(
    (error: Error | string, context?: Record<string, unknown>) => {
      return handleError(error, context, { type: ErrorType.API });
    },
    [handleError]
  );

  // 验证错误处理
  const handleValidationError = useCallback(
    (error: Error | string, context?: Record<string, unknown>) => {
      return handleError(error, context, { type: ErrorType.VALIDATION });
    },
    [handleError]
  );

  // 权限错误处理
  const handlePermissionError = useCallback(
    (error: Error | string, context?: Record<string, unknown>) => {
      return handleError(error, context, { type: ErrorType.PERMISSION });
    },
    [handleError]
  );

  // 清除错误状态
  const clearErrors = useCallback(() => {
    lastErrorRef.current = null;
    errorHandler.clearRetryAttempts();

    if (onRecover) {
      onRecover();
    }
  }, [onRecover]);

  // 重试最后一个失败的操作
  const retry = useCallback(async () => {
    if (!lastErrorRef.current) {
      logger.warn("No previous error to retry");
      return;
    }

    const { error, context, config } = lastErrorRef.current;
    await handleError(error, context, config);
  }, [handleError]);

  // 错误边界包装器
  const withErrorBoundary = useCallback(
    <T extends unknown[], R>(fn: (...args: T) => Promise<R>, fallback?: R) => {
      return async (...args: T): Promise<R> => {
        try {
          return await fn(...args);
        } catch (error) {
          await handleError(error as Error, {
            function: fn.name || "anonymous",
            arguments: args,
          });

          if (fallback !== undefined) {
            return fallback;
          }

          throw error;
        }
      };
    },
    [handleError]
  );

  return {
    handleError,
    handleNetworkError,
    handleApiError,
    handleValidationError,
    handlePermissionError,
    clearErrors,
    retry,
    withErrorBoundary,
  };
}

export default useErrorHandler;
