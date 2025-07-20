/**
 * 错误处理迁移工具
 * 帮助将现有代码迁移到统一错误处理系统
 */

import {
  handleError,
  handleApiError,
  handleNetworkError,
  handleValidationError,
  handlePermissionError,
} from "@/lib/errorHandler";

/**
 * Migration helpers for converting existing error handling to unified system
 *
 * Provides utility functions to help migrate existing error handling code
 * to use the unified error handling system. Each helper function maps
 * old error handling patterns to new unified handlers.
 *
 * @example
 * ```typescript
 * // Old code:
 * console.error('API failed', error);
 *
 * // New code:
 * migrationHelpers.replaceConsoleError(error, 'API failed');
 * ```
 */
export const migrationHelpers = {
  /**
   * Replace console.error calls with unified error handling
   *
   * @param error - Error to handle
   * @param context - Additional context information
   * @returns Promise from unified error handler
   */
  replaceConsoleError: (error: unknown, context?: string) => {
    return handleError(error instanceof Error ? error : String(error), {
      source: "console_migration",
      context,
    });
  },

  /**
   * Replace API error handling with unified system
   *
   * @param error - API error to handle
   * @param operation - Name of the API operation that failed
   * @param params - Parameters passed to the API call
   * @returns Promise from unified error handler
   */
  replaceApiErrorHandling: (error: unknown, operation: string, params?: unknown) => {
    return handleApiError(error instanceof Error ? error : String(error), {
      operation,
      params,
      source: "api_migration",
    });
  },

  // 替换网络错误处理
  replaceNetworkErrorHandling: (error: unknown, url?: string) => {
    return handleNetworkError(error instanceof Error ? error : String(error), {
      url,
      source: "network_migration",
    });
  },

  // 替换验证错误处理
  replaceValidationErrorHandling: (error: unknown, field?: string, value?: unknown) => {
    return handleValidationError(error instanceof Error ? error : String(error), {
      field,
      value,
      source: "validation_migration",
    });
  },

  // 替换权限错误处理
  replacePermissionErrorHandling: (error: unknown, resource?: string, action?: string) => {
    return handlePermissionError(error instanceof Error ? error : String(error), {
      resource,
      action,
      source: "permission_migration",
    });
  },
};

/**
 * 代码模式匹配和替换建议
 */
export const migrationPatterns = [
  {
    pattern: /console\.error\(['"`]([^'"`]+)['"`],?\s*([^)]*)\)/g,
    replacement: 'await handleError("$1", { context: $2 })',
    description: "替换console.error调用",
  },
  {
    pattern: /catch\s*\(\s*([^)]+)\s*\)\s*{\s*console\.error\(/g,
    replacement: "catch ($1) {\n  await handleError(",
    description: "替换catch块中的console.error",
  },
  {
    pattern: /throw\s+new\s+Error\(['"`]([^'"`]+)['"`]\)/g,
    replacement: 'await handleError("$1"); throw new Error("$1")',
    description: "在抛出错误前记录错误",
  },
  {
    pattern: /logger\.error\(['"`]([^'"`]+)['"`],?\s*([^)]*)\)/g,
    replacement: 'await handleError("$1", { context: $2 })',
    description: "替换logger.error调用",
  },
];

/**
 * Automatically migrate file content to use unified error handling
 *
 * Applies all migration patterns to transform existing error handling
 * code to use the unified error handling system.
 *
 * @param content - Original file content to migrate
 * @returns Migrated file content with updated error handling
 *
 * @example
 * ```typescript
 * const originalCode = `
 *   try {
 *     await api.call();
 *   } catch (error) {
 *     console.error('API failed', error);
 *   }
 * `;
 *
 * const migratedCode = autoMigrateFileContent(originalCode);
 * // Returns code with unified error handling
 * ```
 */
export const autoMigrateFileContent = (content: string): string => {
  let migratedContent = content;

  migrationPatterns.forEach((pattern) => {
    migratedContent = migratedContent.replace(pattern.pattern, pattern.replacement);
  });

  return migratedContent;
};

/**
 * Generate migration report showing changes made
 *
 * Analyzes the differences between original and migrated content
 * to provide a detailed report of all changes made during migration.
 *
 * @param originalContent - Original file content before migration
 * @param migratedContent - File content after migration
 * @returns Detailed migration report with statistics and changes
 *
 * @example
 * ```typescript
 * const report = generateMigrationReport(originalCode, migratedCode);
 * console.log(`Made ${report.totalChanges} changes`);
 * report.changes.forEach(change => {
 *   console.log(`${change.description}: ${change.matches} matches`);
 * });
 * ```
 */
export const generateMigrationReport = (originalContent: string, migratedContent: string) => {
  const changes: Array<{
    pattern: string;
    description: string;
    matches: number;
  }> = [];

  migrationPatterns.forEach((pattern) => {
    const matches = (originalContent.match(pattern.pattern) || []).length;
    if (matches > 0) {
      changes.push({
        pattern: pattern.pattern.toString(),
        description: pattern.description,
        matches,
      });
    }
  });

  return {
    totalChanges: changes.reduce((sum, change) => sum + change.matches, 0),
    changes,
    originalLength: originalContent.length,
    migratedLength: migratedContent.length,
    timestamp: new Date().toISOString(),
  };
};

export default migrationHelpers;
