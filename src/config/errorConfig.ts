/**
 * 统一错误处理配置文件
 * 定义应用程序的错误处理策略和配置
 */

import { ErrorType, ErrorSeverity, ErrorStrategy, type ErrorConfig } from "@/lib/errorHandler";

// 应用程序特定的错误配置
export const APP_ERROR_CONFIGS: Record<string, ErrorConfig> = {
  // API相关错误
  api_list_projects: {
    type: ErrorType.API,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.RETRY,
    retryCount: 2,
    retryDelay: 1000,
    customMessage: "获取项目列表失败，正在重试...",
    showDetails: false,
    reportToService: false,
  },

  api_get_sessions: {
    type: ErrorType.API,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.TOAST,
    customMessage: "获取会话列表失败",
    showDetails: true,
    reportToService: false,
  },

  api_execute_agent: {
    type: ErrorType.API,
    severity: ErrorSeverity.HIGH,
    strategy: ErrorStrategy.MODAL,
    customMessage: "执行代理失败",
    showDetails: true,
    reportToService: true,
  },

  api_claude_session: {
    type: ErrorType.API,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.TOAST,
    customMessage: "Claude会话操作失败",
    showDetails: true,
    reportToService: false,
  },

  // 文件操作错误
  file_read_error: {
    type: ErrorType.SYSTEM,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.TOAST,
    customMessage: "文件读取失败",
    showDetails: true,
    reportToService: false,
  },

  file_write_error: {
    type: ErrorType.SYSTEM,
    severity: ErrorSeverity.HIGH,
    strategy: ErrorStrategy.MODAL,
    customMessage: "文件保存失败",
    showDetails: true,
    reportToService: true,
  },

  // 网络连接错误
  network_connection: {
    type: ErrorType.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.RETRY,
    retryCount: 3,
    retryDelay: 2000,
    customMessage: "网络连接失败，正在重试...",
    showDetails: false,
    reportToService: false,
  },

  // 用户输入验证错误
  validation_project_path: {
    type: ErrorType.VALIDATION,
    severity: ErrorSeverity.LOW,
    strategy: ErrorStrategy.TOAST,
    customMessage: "请选择有效的项目路径",
    showDetails: false,
    reportToService: false,
  },

  validation_agent_config: {
    type: ErrorType.VALIDATION,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.TOAST,
    customMessage: "代理配置验证失败",
    showDetails: true,
    reportToService: false,
  },

  // 权限相关错误
  permission_file_access: {
    type: ErrorType.PERMISSION,
    severity: ErrorSeverity.HIGH,
    strategy: ErrorStrategy.MODAL,
    customMessage: "文件访问权限不足",
    showDetails: true,
    reportToService: false,
  },

  permission_directory_create: {
    type: ErrorType.PERMISSION,
    severity: ErrorSeverity.HIGH,
    strategy: ErrorStrategy.MODAL,
    customMessage: "无法创建目录，权限不足",
    showDetails: true,
    reportToService: false,
  },

  // 系统级错误
  system_memory: {
    type: ErrorType.SYSTEM,
    severity: ErrorSeverity.CRITICAL,
    strategy: ErrorStrategy.MODAL,
    customMessage: "系统内存不足",
    showDetails: true,
    reportToService: true,
  },

  system_disk_space: {
    type: ErrorType.SYSTEM,
    severity: ErrorSeverity.HIGH,
    strategy: ErrorStrategy.MODAL,
    customMessage: "磁盘空间不足",
    showDetails: true,
    reportToService: false,
  },

  // MCP服务器错误
  mcp_server_connection: {
    type: ErrorType.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.RETRY,
    retryCount: 2,
    retryDelay: 1500,
    customMessage: "MCP服务器连接失败，正在重试...",
    showDetails: false,
    reportToService: false,
  },

  mcp_server_config: {
    type: ErrorType.VALIDATION,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.TOAST,
    customMessage: "MCP服务器配置无效",
    showDetails: true,
    reportToService: false,
  },

  // 代理执行错误
  agent_execution_timeout: {
    type: ErrorType.TIMEOUT,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.TOAST,
    customMessage: "代理执行超时",
    showDetails: true,
    reportToService: false,
  },

  agent_execution_cancelled: {
    type: ErrorType.USER_INPUT,
    severity: ErrorSeverity.LOW,
    strategy: ErrorStrategy.SILENT,
    customMessage: "代理执行已取消",
    showDetails: false,
    reportToService: false,
  },

  // 数据库错误
  database_connection: {
    type: ErrorType.SYSTEM,
    severity: ErrorSeverity.HIGH,
    strategy: ErrorStrategy.MODAL,
    customMessage: "数据库连接失败",
    showDetails: true,
    reportToService: true,
  },

  database_query: {
    type: ErrorType.SYSTEM,
    severity: ErrorSeverity.MEDIUM,
    strategy: ErrorStrategy.TOAST,
    customMessage: "数据库查询失败",
    showDetails: true,
    reportToService: true,
  },
};

/**
 * Get environment-specific error configuration
 *
 * Returns different error handling configurations based on the current
 * environment (development vs production) to optimize debugging and security.
 *
 * @returns Environment-specific error configuration overrides
 *
 * @example
 * ```typescript
 * const envConfig = getEnvironmentErrorConfig();
 * // Development: shows detailed errors, no reporting
 * // Production: hides details, enables reporting
 * ```
 */
export const getEnvironmentErrorConfig = (): Partial<Record<ErrorType, Partial<ErrorConfig>>> => {
  const isDevelopment = import.meta.env.DEV;

  if (isDevelopment) {
    // 开发环境：显示更多详细信息，不上报错误
    return {
      [ErrorType.API]: {
        showDetails: true,
        reportToService: false,
      },
      [ErrorType.SYSTEM]: {
        showDetails: true,
        reportToService: false,
      },
      [ErrorType.UNKNOWN]: {
        showDetails: true,
        reportToService: false,
      },
    };
  } else {
    // 生产环境：隐藏敏感信息，启用错误上报
    return {
      [ErrorType.API]: {
        showDetails: false,
        reportToService: true,
      },
      [ErrorType.SYSTEM]: {
        showDetails: false,
        reportToService: true,
      },
      [ErrorType.UNKNOWN]: {
        showDetails: false,
        reportToService: true,
      },
    };
  }
};

// 用户偏好设置
export interface UserErrorPreferences {
  showToastNotifications: boolean;
  showDetailedErrors: boolean;
  enableErrorReporting: boolean;
  autoRetryEnabled: boolean;
  maxRetryAttempts: number;
}

export const DEFAULT_USER_PREFERENCES: UserErrorPreferences = {
  showToastNotifications: true,
  showDetailedErrors: import.meta.env.DEV,
  enableErrorReporting: !import.meta.env.DEV,
  autoRetryEnabled: true,
  maxRetryAttempts: 3,
};

/**
 * Get user error handling preferences from local storage
 *
 * Retrieves saved user preferences for error handling behavior,
 * falling back to defaults if no preferences are saved or if loading fails.
 *
 * @returns User error preferences with fallback to defaults
 *
 * @example
 * ```typescript
 * const preferences = getUserErrorPreferences();
 * if (preferences.showDetailedErrors) {
 *   // Show detailed error information
 * }
 * ```
 */
export const getUserErrorPreferences = (): UserErrorPreferences => {
  try {
    const saved = localStorage.getItem("claudia_error_preferences");
    if (saved) {
      return { ...DEFAULT_USER_PREFERENCES, ...JSON.parse(saved) };
    }
  } catch (_error) {
    // Failed to load user error preferences - using defaults
  }
  return DEFAULT_USER_PREFERENCES;
};

/**
 * Save user error handling preferences to local storage
 *
 * Persists user preferences for error handling behavior to local storage.
 * Merges with existing preferences to preserve unmodified settings.
 *
 * @param preferences - Partial preferences object to save
 *
 * @example
 * ```typescript
 * saveUserErrorPreferences({
 *   showDetailedErrors: false,
 *   enableErrorReporting: true
 * });
 * ```
 */
export const saveUserErrorPreferences = (preferences: Partial<UserErrorPreferences>) => {
  try {
    const current = getUserErrorPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem("claudia_error_preferences", JSON.stringify(updated));
  } catch (_error) {
    // Failed to save user error preferences - continuing
  }
};

/**
 * Apply user preferences to error configuration
 *
 * Merges user preferences with base error configuration to create
 * a personalized error handling experience while respecting user choices.
 *
 * @param config - Base error configuration
 * @param preferences - User preferences to apply
 * @returns Modified error configuration with user preferences applied
 *
 * @example
 * ```typescript
 * const baseConfig = getErrorConfig(ErrorType.API);
 * const userPrefs = getUserErrorPreferences();
 * const finalConfig = applyUserPreferencesToConfig(baseConfig, userPrefs);
 * ```
 */
export const applyUserPreferencesToConfig = (
  config: ErrorConfig,
  preferences: UserErrorPreferences
): ErrorConfig => {
  return {
    ...config,
    showDetails: preferences.showDetailedErrors && config.showDetails,
    reportToService: preferences.enableErrorReporting && config.reportToService,
    retryCount: preferences.autoRetryEnabled ? config.retryCount : 0,
  };
};

export default APP_ERROR_CONFIGS;
