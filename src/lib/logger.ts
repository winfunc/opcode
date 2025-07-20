/**
 * 统一日志管理器
 * 根据环境自动配置日志级别，生产环境移除调试日志
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enablePersistence: boolean;
  maxLogSize: number;
}

/**
 * Unified logging manager with environment-aware configuration
 *
 * Provides structured logging with different levels, automatic environment
 * detection, and production-safe logging. Removes debug logs in production
 * builds for performance and security.
 *
 * @example
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * logger.info('Application started');
 * logger.error('Failed to load data', { userId: '123' });
 * logger.debug('Debug info', { state: currentState });
 * ```
 */
class Logger {
  private config: LogConfig;
  private isDevelopment: boolean;

  constructor() {
    // 检测环境：开发环境或生产环境
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === "development";

    // 根据环境设置默认配置
    this.config = {
      level: this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN,
      enableConsole: this.isDevelopment,
      enablePersistence: false, // 可以根据需要启用
      maxLogSize: 1024 * 1024, // 1MB
    };

    // 从环境变量或本地存储读取配置
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      // 尝试从本地存储读取日志配置
      const savedConfig = localStorage.getItem("claudia_log_config");
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        this.config = { ...this.config, ...parsed };
      }

      // 环境变量覆盖
      const envLogLevel = import.meta.env.VITE_LOG_LEVEL;
      if (envLogLevel) {
        this.config.level = this.parseLogLevel(envLogLevel);
      }
    } catch (error) {
      // 配置加载失败时使用默认配置
      // 在日志模块内部使用原生 console，避免循环引用
      if (this.isDevelopment) {
        // eslint-disable-next-line no-console
        console.warn("Failed to load log config, using defaults:", error);
      }
    }
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case "DEBUG":
        return LogLevel.DEBUG;
      case "INFO":
        return LogLevel.INFO;
      case "WARN":
        return LogLevel.WARN;
      case "ERROR":
        return LogLevel.ERROR;
      case "NONE":
        return LogLevel.NONE;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level && this.config.enableConsole;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      // 日志模块内部直接使用原生 console，避免循环引用
      // eslint-disable-next-line no-console
      console.debug(this.formatMessage("DEBUG", message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      // 日志模块内部直接使用原生 console，避免循环引用
      // eslint-disable-next-line no-console
      console.info(this.formatMessage("INFO", message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      // 日志模块内部直接使用原生 console，避免循环引用
      // eslint-disable-next-line no-console
      console.warn(this.formatMessage("WARN", message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      // 日志模块内部直接使用原生 console，避免循环引用
      // eslint-disable-next-line no-console
      console.error(this.formatMessage("ERROR", message), ...args);
    }
  }

  // 配置方法
  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.saveConfig();
  }

  setConsoleEnabled(enabled: boolean): void {
    this.config.enableConsole = enabled;
    this.saveConfig();
  }

  getConfig(): LogConfig {
    return { ...this.config };
  }

  private saveConfig(): void {
    try {
      localStorage.setItem("claudia_log_config", JSON.stringify(this.config));
    } catch (error) {
      // 在日志模块内部使用原生 console，避免循环引用
      if (this.isDevelopment) {
        // eslint-disable-next-line no-console
        console.warn("Failed to save log config:", error);
      }
    }
  }

  // 性能日志（仅开发环境）
  time(label: string): void {
    if (this.isDevelopment && this.shouldLog(LogLevel.DEBUG)) {
      // eslint-disable-next-line no-console
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.isDevelopment && this.shouldLog(LogLevel.DEBUG)) {
      // eslint-disable-next-line no-console
      console.timeEnd(label);
    }
  }

  // 组日志（仅开发环境）
  group(label: string): void {
    if (this.isDevelopment && this.shouldLog(LogLevel.DEBUG)) {
      // eslint-disable-next-line no-console
      console.group(label);
    }
  }

  groupEnd(): void {
    if (this.isDevelopment && this.shouldLog(LogLevel.DEBUG)) {
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
  }
}

// 导出单例实例
export const logger = new Logger();

// 向后兼容的全局替换函数
/**
 * Replace console methods in production to prevent debug output
 *
 * Removes debug, log, and info console methods in production builds
 * while preserving error and warn methods for critical issues.
 * This improves performance and prevents sensitive information leakage.
 *
 * @example
 * ```typescript
 * // Call during app initialization
 * replaceConsole();
 *
 * // In production, these will be no-ops:
 * console.debug('Debug info'); // Silent
 * console.log('Log message'); // Silent
 *
 * // These still work:
 * console.error('Error message'); // Still logs
 * console.warn('Warning message'); // Still logs
 * ```
 */
export const replaceConsole = () => {
  if (!import.meta.env.DEV) {
    // 生产环境下替换 console 方法
    const noop = () => {};

    // 保留 error 和 warn，移除 debug, log, info
    // eslint-disable-next-line no-console
    console.debug = noop;
    // eslint-disable-next-line no-console
    console.log = noop;
    // eslint-disable-next-line no-console
    console.info = noop;
    // console.warn 和 console.error 保留
  }
};

export default logger;
