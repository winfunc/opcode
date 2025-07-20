/**
 * 错误处理迁移工具
 * 帮助将现有代码迁移到统一错误处理系统
 */

import { handleError, handleApiError, handleNetworkError, handleValidationError, handlePermissionError } from '@/lib/errorHandler';

/**
 * 迁移现有的try-catch块到统一错误处理
 */
export const migrationHelpers = {
  // 替换简单的console.error调用
  replaceConsoleError: (error: any, context?: string) => {
    return handleError(error, { source: 'console_migration', context });
  },

  // 替换API错误处理
  replaceApiErrorHandling: (error: any, operation: string, params?: any) => {
    return handleApiError(error, { operation, params, source: 'api_migration' });
  },

  // 替换网络错误处理
  replaceNetworkErrorHandling: (error: any, url?: string) => {
    return handleNetworkError(error, { url, source: 'network_migration' });
  },

  // 替换验证错误处理
  replaceValidationErrorHandling: (error: any, field?: string, value?: any) => {
    return handleValidationError(error, { field, value, source: 'validation_migration' });
  },

  // 替换权限错误处理
  replacePermissionErrorHandling: (error: any, resource?: string, action?: string) => {
    return handlePermissionError(error, { resource, action, source: 'permission_migration' });
  }
};

/**
 * 代码模式匹配和替换建议
 */
export const migrationPatterns = [
  {
    pattern: /console\.error\(['"`]([^'"`]+)['"`],?\s*([^)]*)\)/g,
    replacement: 'await handleError("$1", { context: $2 })',
    description: '替换console.error调用'
  },
  {
    pattern: /catch\s*\(\s*([^)]+)\s*\)\s*{\s*console\.error\(/g,
    replacement: 'catch ($1) {\n  await handleError(',
    description: '替换catch块中的console.error'
  },
  {
    pattern: /throw\s+new\s+Error\(['"`]([^'"`]+)['"`]\)/g,
    replacement: 'await handleError("$1"); throw new Error("$1")',
    description: '在抛出错误前记录错误'
  },
  {
    pattern: /logger\.error\(['"`]([^'"`]+)['"`],?\s*([^)]*)\)/g,
    replacement: 'await handleError("$1", { context: $2 })',
    description: '替换logger.error调用'
  }
];

/**
 * 自动迁移文件内容
 */
export const autoMigrateFileContent = (content: string): string => {
  let migratedContent = content;
  
  migrationPatterns.forEach(pattern => {
    migratedContent = migratedContent.replace(pattern.pattern, pattern.replacement);
  });

  return migratedContent;
};

/**
 * 生成迁移报告
 */
export const generateMigrationReport = (originalContent: string, migratedContent: string) => {
  const changes: Array<{
    pattern: string;
    description: string;
    matches: number;
  }> = [];

  migrationPatterns.forEach(pattern => {
    const matches = (originalContent.match(pattern.pattern) || []).length;
    if (matches > 0) {
      changes.push({
        pattern: pattern.pattern.toString(),
        description: pattern.description,
        matches
      });
    }
  });

  return {
    totalChanges: changes.reduce((sum, change) => sum + change.matches, 0),
    changes,
    originalLength: originalContent.length,
    migratedLength: migratedContent.length,
    timestamp: new Date().toISOString()
  };
};

export default migrationHelpers;