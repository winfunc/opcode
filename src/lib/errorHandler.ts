/**
 * 统一错误处理配置和管理器
 * 提供全局错误处理、分类、报告和恢复机制
 */

import { logger } from "./logger";
// 错误类型枚举
export enum ErrorType {
  NETWORK = "network",
  API = "api",
  VALIDATION = "validation",
  PERMISSION = "permission",
  TIMEOUT = "timeout",
  UNKNOWN = "unknown",
  USER_INPUT = "user_input",
  SYSTEM = "system",
  AUTHENTICATION = "authentication",
  RATE_LIMIT = "rate_limit",
}

// 错误严重程度
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// 错误处理策略
export enum ErrorStrategy {
  SILENT = "silent", // 静默处理，仅记录日志
  TOAST = "toast", // 显示toast通知
  MODAL = "modal", // 显示模态对话框
  REDIRECT = "redirect", // 重定向到错误页面
  RETRY = "retry", // 自动重试
  FALLBACK = "fallback", // 使用备用方案
}

// 错误配置接口
export interface ErrorConfig {
  type: ErrorType;
  severity: ErrorSeverity;
  strategy: ErrorStrategy;
  retryCount?: number;
  retryDelay?: number;
  fallbackAction?: () => void;
  customMessage?: string;
  showDetails?: boolean;
  reportToService?: boolean;
}

// 标准化错误接口
export interface StandardError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  context?: Record<string, unknown>;
  timestamp: number;
  stack?: string;
  userAgent?: string;
  url?: string;
}

// 错误处理结果
export interface ErrorHandlingResult {
  handled: boolean;
  strategy: ErrorStrategy;
  retryAttempted?: boolean;
  fallbackUsed?: boolean;
  userNotified?: boolean;
}

// 默认错误配置映射
const DEFAULT_ERROR_CONFIGS: Record<ErrorType, ErrorConfig> = {
  [ErrorType.NETWORK]: {
    type: ErrorType.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.RETRY,
    retryCount: 3,
    retryDelay: 1000,
    customMessage: "网络连接失败，正在重试...",
    showDetails: false,
    reportToService: false,
  },
  [ErrorType.API]: {
    type: ErrorType.API,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.TOAST,
    customMessage: "API调用失败",
    showDetails: true,
    reportToService: true,
  },
  [ErrorType.VALIDATION]: {
    type: ErrorType.VALIDATION,
    severity: ErrorSeverity.LOW,
    strategy: ErrorStrategy.TOAST,
    customMessage: "输入验证失败",
    showDetails: true,
    reportToService: false,
  },
  [ErrorType.PERMISSION]: {
    type: ErrorType.PERMISSION,
    severity: ErrorSeverity.HIGH,
    strategy: ErrorStrategy.MODAL,
    customMessage: "权限不足",
    showDetails: true,
    reportToService: true,
  },
  [ErrorType.TIMEOUT]: {
    type: ErrorType.TIMEOUT,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.RETRY,
    retryCount: 2,
    retryDelay: 2000,
    customMessage: "请求超时，正在重试...",
    showDetails: false,
    reportToService: false,
  },
  [ErrorType.AUTHENTICATION]: {
    type: ErrorType.AUTHENTICATION,
    severity: ErrorSeverity.HIGH,
    strategy: ErrorStrategy.REDIRECT,
    customMessage: "身份验证失败，请重新登录",
    showDetails: false,
    reportToService: true,
  },
  [ErrorType.RATE_LIMIT]: {
    type: ErrorType.RATE_LIMIT,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.TOAST,
    customMessage: "请求过于频繁，请稍后再试",
    showDetails: false,
    reportToService: false,
  },
  [ErrorType.USER_INPUT]: {
    type: ErrorType.USER_INPUT,
    severity: ErrorSeverity.LOW,
    strategy: ErrorStrategy.TOAST,
    customMessage: "输入格式不正确",
    showDetails: true,
    reportToService: false,
  },
  [ErrorType.SYSTEM]: {
    type: ErrorType.SYSTEM,
    severity: ErrorSeverity.CRITICAL,
    strategy: ErrorStrategy.MODAL,
    customMessage: "系统错误",
    showDetails: true,
    reportToService: true,
  },
  [ErrorType.UNKNOWN]: {
    type: ErrorType.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.TOAST,
    customMessage: "发生未知错误",
    showDetails: true,
    reportToService: true,
  },
};

/**
 * Error classifier utility for categorizing errors by type
 *
 * Analyzes error messages to automatically determine the appropriate error type
 * for consistent error handling across the application.
 */
export class ErrorClassifier {
  /**
   * Classify an error based on its message content
   *
   * @param error - Error object or error message string to classify
   * @returns The determined error type for appropriate handling
   *
   * @example
   * ```typescript
   * const type = ErrorClassifier.classify(new Error('Network timeout'));
   * // Returns: ErrorType.NETWORK
   * ```
   */
  static classify(error: Error | string): ErrorType {
    const message = typeof error === "string" ? error : error.message;
    const lowerMessage = message.toLowerCase();

    // 网络错误
    if (
      lowerMessage.includes("network") ||
      lowerMessage.includes("fetch") ||
      lowerMessage.includes("connection") ||
      lowerMessage.includes("offline")
    ) {
      return ErrorType.NETWORK;
    }

    // API错误
    if (
      lowerMessage.includes("api") ||
      lowerMessage.includes("server") ||
      lowerMessage.includes("http") ||
      lowerMessage.includes("status")
    ) {
      return ErrorType.API;
    }

    // 验证错误
    if (
      lowerMessage.includes("validation") ||
      lowerMessage.includes("invalid") ||
      lowerMessage.includes("required") ||
      lowerMessage.includes("format")
    ) {
      return ErrorType.VALIDATION;
    }

    // 权限错误
    if (
      lowerMessage.includes("permission") ||
      lowerMessage.includes("unauthorized") ||
      lowerMessage.includes("forbidden") ||
      lowerMessage.includes("access denied")
    ) {
      return ErrorType.PERMISSION;
    }

    // 超时错误
    if (
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("timed out") ||
      lowerMessage.includes("deadline")
    ) {
      return ErrorType.TIMEOUT;
    }

    // 认证错误
    if (
      lowerMessage.includes("auth") ||
      lowerMessage.includes("login") ||
      lowerMessage.includes("token") ||
      lowerMessage.includes("credential")
    ) {
      return ErrorType.AUTHENTICATION;
    }

    // 限流错误
    if (
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("too many requests") ||
      lowerMessage.includes("quota exceeded")
    ) {
      return ErrorType.RATE_LIMIT;
    }

    return ErrorType.UNKNOWN;
  }
}

/**
 * Centralized error handler for the application
 *
 * Provides comprehensive error handling with automatic classification,
 * retry mechanisms, user notifications, and error reporting capabilities.
 * Implements singleton pattern for consistent error handling across the app.
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorConfigs: Map<ErrorType, ErrorConfig> = new Map();
  private errorHistory: StandardError[] = [];
  private maxHistorySize = 100;
  private retryAttempts: Map<string, number> = new Map();

  // 通知回调函数
  private toastCallback?: (message: string, type: "error" | "warning" | "info") => void;
  private modalCallback?: (title: string, message: string, details?: string) => void;
  private redirectCallback?: (path: string) => void;

  private constructor() {
    // 初始化默认配置
    Object.values(DEFAULT_ERROR_CONFIGS).forEach((config) => {
      this.errorConfigs.set(config.type, config);
    });
  }

  /**
   * Get the singleton instance of ErrorHandler
   *
   * @returns The singleton ErrorHandler instance
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Set notification callbacks for different error handling strategies
   *
   * @param callbacks - Object containing callback functions for toast, modal, and redirect
   * @param callbacks.toast - Function to show toast notifications
   * @param callbacks.modal - Function to show modal dialogs
   * @param callbacks.redirect - Function to perform redirects
   */
  setNotificationCallbacks(callbacks: {
    toast?: (message: string, type: "error" | "warning" | "info") => void;
    modal?: (title: string, message: string, details?: string) => void;
    redirect?: (path: string) => void;
  }) {
    this.toastCallback = callbacks.toast;
    this.modalCallback = callbacks.modal;
    this.redirectCallback = callbacks.redirect;
  }

  /**
   * Update error configuration for a specific error type
   *
   * @param type - The error type to update configuration for
   * @param config - Partial configuration to merge with existing config
   */
  updateErrorConfig(type: ErrorType, config: Partial<ErrorConfig>) {
    const existingConfig = this.errorConfigs.get(type) || DEFAULT_ERROR_CONFIGS[type];
    this.errorConfigs.set(type, { ...existingConfig, ...config });
  }

  /**
   * Main error handling method
   *
   * Processes errors through classification, configuration lookup, and strategy execution.
   * Provides comprehensive error handling with logging, user notification, and recovery.
   *
   * @param error - Error object or message to handle
   * @param context - Additional context information for debugging
   * @param customConfig - Custom configuration to override defaults
   * @returns Promise resolving to the handling result
   *
   * @example
   * ```typescript
   * const result = await errorHandler.handle(
   *   new Error('API failed'),
   *   { userId: '123', operation: 'fetchData' },
   *   { strategy: ErrorStrategy.RETRY }
   * );
   * ```
   */
  async handle(
    error: Error | string,
    context?: Record<string, unknown>,
    customConfig?: Partial<ErrorConfig>
  ): Promise<ErrorHandlingResult> {
    try {
      // 创建标准化错误对象
      const standardError = this.createStandardError(error, context);

      // 获取错误配置
      const config = this.getErrorConfig(standardError.type, customConfig);

      // 记录错误
      this.recordError(standardError);

      // 执行错误处理策略
      const result = await this.executeStrategy(standardError, config);

      logger.debug("Error handled:", {
        errorId: standardError.id,
        type: standardError.type,
        strategy: config.strategy,
        result,
      });

      return result;
    } catch (handlingError) {
      logger.error("Error in error handler:", handlingError);
      return {
        handled: false,
        strategy: ErrorStrategy.SILENT,
      };
    }
  }

  // 创建标准化错误对象
  private createStandardError(
    error: Error | string,
    context?: Record<string, unknown>
  ): StandardError {
    const originalError = error instanceof Error ? error : new Error(error);
    const type = ErrorClassifier.classify(originalError);

    return {
      id: this.generateErrorId(),
      type,
      severity: DEFAULT_ERROR_CONFIGS[type].severity,
      message: originalError.message,
      originalError,
      context,
      timestamp: Date.now(),
      stack: originalError.stack,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    };
  }

  // 获取错误配置
  private getErrorConfig(type: ErrorType, customConfig?: Partial<ErrorConfig>): ErrorConfig {
    const baseConfig = this.errorConfigs.get(type) || DEFAULT_ERROR_CONFIGS[type];
    return customConfig ? { ...baseConfig, ...customConfig } : baseConfig;
  }

  // 执行错误处理策略
  private async executeStrategy(
    error: StandardError,
    config: ErrorConfig
  ): Promise<ErrorHandlingResult> {
    const result: ErrorHandlingResult = {
      handled: true,
      strategy: config.strategy,
    };

    switch (config.strategy) {
      case ErrorStrategy.SILENT:
        // 仅记录日志，不通知用户
        logger.error(`Silent error: ${error.message}`, error);
        break;

      case ErrorStrategy.TOAST:
        result.userNotified = this.showToast(error, config);
        break;

      case ErrorStrategy.MODAL:
        result.userNotified = this.showModal(error, config);
        break;

      case ErrorStrategy.REDIRECT:
        result.userNotified = this.performRedirect(error, config);
        break;

      case ErrorStrategy.RETRY:
        result.retryAttempted = await this.attemptRetry(error, config);
        break;

      case ErrorStrategy.FALLBACK:
        result.fallbackUsed = this.executeFallback(error, config);
        break;

      default:
        logger.warn(`Unknown error strategy: ${config.strategy}`);
        result.handled = false;
    }

    return result;
  }

  // 显示Toast通知
  private showToast(error: StandardError, config: ErrorConfig): boolean {
    if (!this.toastCallback) {
      logger.warn("Toast callback not set, falling back to console");
      logger.error(config.customMessage || error.message);
      return false;
    }

    const message = config.customMessage || error.message;
    const type = config.severity === ErrorSeverity.CRITICAL ? "error" : "warning";

    this.toastCallback(message, type);
    return true;
  }

  // 显示模态对话框
  private showModal(error: StandardError, config: ErrorConfig): boolean {
    if (!this.modalCallback) {
      logger.warn("Modal callback not set, falling back to toast");
      return this.showToast(error, config);
    }

    const title = this.getSeverityTitle(config.severity);
    const message = config.customMessage || error.message;
    const details = config.showDetails ? error.stack : undefined;

    this.modalCallback(title, message, details);
    return true;
  }

  // 执行重定向
  private performRedirect(error: StandardError, config: ErrorConfig): boolean {
    if (!this.redirectCallback) {
      logger.warn("Redirect callback not set, falling back to toast");
      return this.showToast(error, config);
    }

    // 根据错误类型确定重定向路径
    let redirectPath = "/error";
    if (error.type === ErrorType.AUTHENTICATION) {
      redirectPath = "/login";
    }

    this.redirectCallback(redirectPath);
    return true;
  }

  // 尝试重试
  private async attemptRetry(error: StandardError, config: ErrorConfig): Promise<boolean> {
    const retryKey = `${error.type}_${error.message}`;
    const currentAttempts = this.retryAttempts.get(retryKey) || 0;

    if (currentAttempts >= (config.retryCount || 3)) {
      logger.warn(`Max retry attempts reached for error: ${error.message}`);
      // 达到最大重试次数，显示错误通知
      this.showToast(error, { ...config, strategy: ErrorStrategy.TOAST });
      return false;
    }

    this.retryAttempts.set(retryKey, currentAttempts + 1);

    // 延迟后重试
    if (config.retryDelay) {
      await new Promise((resolve) => setTimeout(resolve, config.retryDelay));
    }

    logger.info(`Retrying operation, attempt ${currentAttempts + 1}/${config.retryCount}`);
    return true;
  }

  // 执行备用方案
  private executeFallback(_error: StandardError, config: ErrorConfig): boolean {
    if (config.fallbackAction) {
      try {
        config.fallbackAction();
        return true;
      } catch (fallbackError) {
        logger.error("Fallback action failed:", fallbackError);
        return false;
      }
    }
    return false;
  }

  // 记录错误到历史
  private recordError(error: StandardError) {
    this.errorHistory.unshift(error);

    // 限制历史记录大小
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }

    // 根据配置决定是否上报错误
    const config = this.errorConfigs.get(error.type);
    if (config?.reportToService) {
      this.reportError(error);
    }
  }

  // 上报错误到服务
  private reportError(error: StandardError) {
    // 这里可以集成错误报告服务，如Sentry、LogRocket等
    logger.info("Error reported to service:", {
      id: error.id,
      type: error.type,
      message: error.message,
      timestamp: error.timestamp,
    });
  }

  // 生成错误ID
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取严重程度标题
  private getSeverityTitle(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW:
        return "提示";
      case ErrorSeverity.MEDIUM:
        return "警告";
      case ErrorSeverity.HIGH:
        return "错误";
      case ErrorSeverity.CRITICAL:
        return "严重错误";
      default:
        return "错误";
    }
  }

  // 清除重试计数
  clearRetryAttempts(pattern?: string) {
    if (pattern) {
      for (const key of this.retryAttempts.keys()) {
        if (key.includes(pattern)) {
          this.retryAttempts.delete(key);
        }
      }
    } else {
      this.retryAttempts.clear();
    }
  }

  // 获取错误历史
  getErrorHistory(limit?: number): StandardError[] {
    return limit ? this.errorHistory.slice(0, limit) : [...this.errorHistory];
  }

  // 获取错误统计
  getErrorStats(): Record<ErrorType, number> {
    const stats: Record<ErrorType, number> = {} as Record<ErrorType, number>;

    Object.values(ErrorType).forEach((type) => {
      stats[type] = 0;
    });

    this.errorHistory.forEach((error) => {
      stats[error.type]++;
    });

    return stats;
  }
}

// 导出单例实例
export const errorHandler = ErrorHandler.getInstance();

// 便捷的错误处理函数
export const handleError = (
  error: Error | string,
  context?: Record<string, unknown>,
  customConfig?: Partial<ErrorConfig>
) => errorHandler.handle(error, context, customConfig);

// 特定类型的错误处理函数
export const handleNetworkError = (error: Error | string, context?: Record<string, unknown>) =>
  handleError(error, context, { type: ErrorType.NETWORK });

export const handleApiError = (error: Error | string, context?: Record<string, unknown>) =>
  handleError(error, context, { type: ErrorType.API });

export const handleValidationError = (error: Error | string, context?: Record<string, unknown>) =>
  handleError(error, context, { type: ErrorType.VALIDATION });

export const handlePermissionError = (error: Error | string, context?: Record<string, unknown>) =>
  handleError(error, context, { type: ErrorType.PERMISSION });

// 全局错误处理器设置
export const setupGlobalErrorHandling = () => {
  // 捕获未处理的Promise拒绝
  if (typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", (event) => {
      handleError(event.reason, { source: "unhandledrejection" });
      event.preventDefault();
    });

    // 捕获全局JavaScript错误
    window.addEventListener("error", (event) => {
      handleError(event.error || event.message, {
        source: "global_error",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });
  }
};

export default errorHandler;
