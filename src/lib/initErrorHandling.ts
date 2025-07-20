/**
 * 错误处理系统初始化
 * 设置全局错误处理、Toast通知和用户偏好
 */

import { errorHandler, setupGlobalErrorHandling } from "./errorHandler";
import {
  APP_ERROR_CONFIGS,
  getEnvironmentErrorConfig,
  getUserErrorPreferences,
  applyUserPreferencesToConfig,
} from "@/config/errorConfig";
import { logger } from "./logger";

// Toast回调函数类型
type ToastCallback = (message: string, type: "error" | "warning" | "info") => void;
type ModalCallback = (title: string, message: string, details?: string) => void;
type RedirectCallback = (path: string) => void;

/**
 * 初始化错误处理系统
 * @param callbacks 通知回调函数
 */
export const initializeErrorHandling = (callbacks: {
  toast?: ToastCallback;
  modal?: ModalCallback;
  redirect?: RedirectCallback;
}) => {
  try {
    logger.info("Initializing error handling system...");

    // 设置全局错误捕获
    setupGlobalErrorHandling();

    // 设置通知回调
    errorHandler.setNotificationCallbacks(callbacks);

    // 获取用户偏好设置
    const userPreferences = getUserErrorPreferences();
    const envConfig = getEnvironmentErrorConfig();

    // 应用应用程序特定的错误配置
    Object.entries(APP_ERROR_CONFIGS).forEach(([_key, config]) => {
      // 应用环境配置
      const envOverride = envConfig[config.type] || {};

      // 应用用户偏好
      const finalConfig = applyUserPreferencesToConfig(
        { ...config, ...envOverride },
        userPreferences
      );

      errorHandler.updateErrorConfig(config.type, finalConfig);
    });

    logger.info("Error handling system initialized successfully", {
      userPreferences,
      configCount: Object.keys(APP_ERROR_CONFIGS).length,
    });
  } catch (error) {
    // 使用原生console避免循环引用
    // eslint-disable-next-line no-console
    console.error("Failed to initialize error handling system:", error);
  }
};

/**
 * 创建错误处理中间件（用于API调用）
 */
export const createErrorMiddleware = () => {
  return {
    // API调用前的预处理
    beforeRequest: (operation: string, params?: unknown) => {
      logger.debug(`API Request: ${operation}`, params);
    },

    // API调用后的错误处理
    afterRequest: async (operation: string, error?: unknown, params?: unknown) => {
      if (error) {
        await errorHandler.handle(error instanceof Error ? error : String(error), {
          operation,
          params,
          timestamp: Date.now(),
        });
      }
    },
  };
};

/**
 * 创建React组件错误边界处理器
 */
export const createComponentErrorHandler = (componentName: string) => {
  return async (error: Error, errorInfo?: unknown) => {
    await errorHandler.handle(error, {
      component: componentName,
      errorInfo,
      source: "react_error_boundary",
    });
  };
};

/**
 * 创建异步操作错误处理器
 */
export const createAsyncErrorHandler = (operationName: string) => {
  return async (error: unknown, context?: Record<string, unknown>) => {
    await errorHandler.handle(error instanceof Error ? error : String(error), {
      operation: operationName,
      ...context,
      source: "async_operation",
    });
  };
};

/**
 * 错误恢复策略
 */
export const errorRecoveryStrategies = {
  // 重新加载页面
  reloadPage: () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  },

  // 清除本地存储
  clearLocalStorage: () => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
      logger.info("Local storage cleared for error recovery");
    }
  },

  // 重置应用状态
  resetAppState: () => {
    // 这里可以调用状态管理器的重置方法
    logger.info("App state reset for error recovery");
  },

  // 返回主页
  goHome: (navigate?: (path: string) => void) => {
    if (navigate) {
      navigate("/");
    } else if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  },
};

/**
 * 错误监控和分析
 */
export const errorAnalytics = {
  // 获取错误统计
  getErrorStats: () => {
    return errorHandler.getErrorStats();
  },

  // 获取最近的错误
  getRecentErrors: (limit = 10) => {
    return errorHandler.getErrorHistory(limit);
  },

  // 检查是否有频繁错误
  checkForFrequentErrors: () => {
    const recentErrors = errorHandler.getErrorHistory(20);
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    const recentErrorCount = recentErrors.filter(
      (error) => error.timestamp > fiveMinutesAgo
    ).length;

    if (recentErrorCount > 10) {
      logger.warn("High error frequency detected", {
        errorCount: recentErrorCount,
        timeWindow: "5 minutes",
      });
      return true;
    }

    return false;
  },

  // 生成错误报告
  generateErrorReport: () => {
    const stats = errorHandler.getErrorStats();
    const recentErrors = errorHandler.getErrorHistory(50);

    return {
      timestamp: new Date().toISOString(),
      stats,
      recentErrors: recentErrors.map((error) => ({
        id: error.id,
        type: error.type,
        severity: error.severity,
        message: error.message,
        timestamp: error.timestamp,
        context: error.context,
      })),
      systemInfo: {
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        url: typeof window !== "undefined" ? window.location.href : "unknown",
        timestamp: Date.now(),
      },
    };
  },
};

export default {
  initializeErrorHandling,
  createErrorMiddleware,
  createComponentErrorHandler,
  createAsyncErrorHandler,
  errorRecoveryStrategies,
  errorAnalytics,
};
