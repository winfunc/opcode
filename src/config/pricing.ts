/**
 * Claude 模型定价配置
 * 基于 Anthropic 官方定价：https://docs.anthropic.com/zh-CN/docs/about-claude/pricing
 * 更新时间：2025年1月19日
 * 
 * 价格单位：美元/百万tokens

import { logger } from '@/lib/logger';
 */

export interface ModelPricing {
  inputPrice: number; // 输入token价格
  outputPrice: number; // 输出token价格
  cacheWritePrice: number; // 5分钟缓存写入价格
  cacheWrite1hPrice?: number; // 1小时缓存写入价格
  cacheReadPrice: number; // 缓存读取价格
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 3.5 Haiku - 最具性价比的模型
  "claude-3-5-haiku-20241022": {
    inputPrice: 0.8,
    outputPrice: 4.0,
    cacheWritePrice: 1.0,
    cacheWrite1hPrice: 1.6,
    cacheReadPrice: 0.08,
  },
  haiku: {
    inputPrice: 0.8,
    outputPrice: 4.0,
    cacheWritePrice: 1.0,
    cacheWrite1hPrice: 1.6,
    cacheReadPrice: 0.08,
  },

  // Claude 3.5 Sonnet - 平衡性能和成本 (deprecated)
  "claude-3-5-sonnet-20241022": {
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritePrice: 3.75,
    cacheWrite1hPrice: 6.0,
    cacheReadPrice: 0.3,
  },
  "sonnet-3-5": {
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritePrice: 3.75,
    cacheWrite1hPrice: 6.0,
    cacheReadPrice: 0.3,
  },

  // Claude 3.7 Sonnet - 最新最强性能
  "claude-3-7-sonnet-20250219": {
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritePrice: 3.75,
    cacheWrite1hPrice: 6.0,
    cacheReadPrice: 0.3,
  },
  "sonnet-3-7": {
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritePrice: 3.75,
    cacheWrite1hPrice: 6.0,
    cacheReadPrice: 0.3,
  },

  // Claude 4 Sonnet - 最新 Claude 4 系列
  "claude-sonnet-4-20250514": {
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritePrice: 3.75,
    cacheWrite1hPrice: 6.0,
    cacheReadPrice: 0.3,
  },
  sonnet: {
    // 映射到 Claude 4 Sonnet
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritePrice: 3.75,
    cacheWrite1hPrice: 6.0,
    cacheReadPrice: 0.3,
  },

  // Claude 4 Opus - 最强推理能力 Claude 4 系列
  "claude-opus-4-20250514": {
    inputPrice: 15.0,
    outputPrice: 75.0,
    cacheWritePrice: 18.75,
    cacheWrite1hPrice: 30.0,
    cacheReadPrice: 1.5,
  },
  "claude-opus-4-1-20250805": {
    inputPrice: 15.0, // Base Input Tokens: $15 / MTok
    outputPrice: 75.0, // Output Tokens: $75 / MTok
    cacheWritePrice: 18.75, // 5m Cache Writes: $18.75 / MTok
    cacheWrite1hPrice: 30.0, // 1h Cache Writes: $30 / MTok
    cacheReadPrice: 1.5, // Cache Hits & Refreshes: $1.50 / MTok
  },
  opus: {
    inputPrice: 15.0,
    outputPrice: 75.0,
    cacheWritePrice: 18.75,
    cacheWrite1hPrice: 30.0,
    cacheReadPrice: 1.5,
  },

  // Claude 4 Thinking Models - Enhanced reasoning capabilities
  "claude-sonnet-4-20250514-thinking": {
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritePrice: 3.75,
    cacheWrite1hPrice: 6.0,
    cacheReadPrice: 0.3,
  },
  "claude-opus-4-20250514-thinking": {
    inputPrice: 15.0,
    outputPrice: 75.0,
    cacheWritePrice: 18.75,
    cacheWrite1hPrice: 30.0,
    cacheReadPrice: 1.5,
  },
  "claude-3-7-sonnet-20250219-thinking": {
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritePrice: 3.75,
    cacheWrite1hPrice: 6.0,
    cacheReadPrice: 0.3,
  },
};

/**
 * 获取指定模型的定价信息
 *
 * @param model - 模型名称或别名
 * @returns 模型定价信息，如果模型不存在则返回 null
 *
 * @example
 * ```typescript
 * const pricing = getModelPricing('claude-3-5-sonnet-20241022');
 * if (pricing) {
 *   logger.debug(`Input: $${pricing.inputPrice}/M tokens`);
 * }
 * ```
 */
export function getModelPricing(model: string): ModelPricing | null {
  return MODEL_PRICING[model] || null;
}

/**
 * 计算模型使用的总成本
 *
 * 根据输入输出token数量和缓存使用情况计算总费用。
 * 如果模型不存在，会在控制台输出警告并返回0。
 *
 * @param model - 模型名称
 * @param inputTokens - 输入token数量
 * @param outputTokens - 输出token数量
 * @param cacheCreationTokens - 缓存创建token数量（可选）
 * @param cacheReadTokens - 缓存读取token数量（可选）
 * @returns 总成本（美元）
 *
 * @example
 * ```typescript
 * const cost = calculateCost('claude-3-5-sonnet-20241022', 1000, 500);
 * logger.debug(`Total cost: $${cost.toFixed(4)}`);
 *
 * // 包含缓存的计算
 * const costWithCache = calculateCost('haiku', 1000, 500, 100, 200);
 * ```
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number = 0,
  cacheReadTokens: number = 0
): number {
  const pricing = getModelPricing(model);
  if (!pricing) {
    // Unknown model pricing - using default
    return 0;
  }

  const cost =
    (inputTokens * pricing.inputPrice) / 1_000_000 +
    (outputTokens * pricing.outputPrice) / 1_000_000 +
    (cacheCreationTokens * pricing.cacheWritePrice) / 1_000_000 +
    (cacheReadTokens * pricing.cacheReadPrice) / 1_000_000;

  return cost;
}

/**
 * 格式化价格为美元显示格式
 *
 * @param price - 价格数值
 * @returns 格式化的价格字符串，保留两位小数
 *
 * @example
 * ```typescript
 * formatPrice(0.0123) // "$0.01"
 * formatPrice(1.5) // "$1.50"
 * ```
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * 获取模型性价比评级
 *
 * 基于模型的平均价格计算性价比等级：
 * - high: 平均价格 ≤ $3/M tokens (如 Haiku)
 * - medium: 平均价格 ≤ $10/M tokens (如 Sonnet)
 * - low: 平均价格 > $10/M tokens (如 Opus)
 *
 * @param model - 模型名称
 * @returns 性价比评级
 *
 * @example
 * ```typescript
 * getModelCostEfficiency('claude-3-5-haiku-20241022') // 'high'
 * getModelCostEfficiency('claude-3-5-sonnet-20241022') // 'medium'
 * getModelCostEfficiency('claude-opus-4-20250514') // 'low'
 * ```
 */
export function getModelCostEfficiency(model: string): "high" | "medium" | "low" {
  const pricing = getModelPricing(model);
  if (!pricing) return "medium";

  const avgPrice = (pricing.inputPrice + pricing.outputPrice) / 2;

  if (avgPrice <= 3) return "high"; // Haiku 级别
  if (avgPrice <= 10) return "medium"; // Sonnet 级别
  return "low"; // Opus 级别
}

/**
 * 模型推荐用途
 */
export const MODEL_USE_CASES: Record<string, string[]> = {
  "claude-3-5-haiku-20241022": ["大量文本处理", "内容总结", "简单问答", "代码注释", "翻译任务"],
  "claude-3-5-sonnet-20241022": ["代码生成", "复杂分析", "创意写作", "技术文档", "数据处理"],
  "claude-3-7-sonnet-20250219": ["高级推理", "复杂编程", "深度分析", "专业咨询", "创新解决方案"],
  "claude-sonnet-4-20250514": ["平衡性能", "通用任务", "代码生成", "技术分析", "日常工作"],
  "claude-opus-4-20250514": ["最复杂推理", "高级研究", "专业写作", "复杂决策", "创意项目"],
  "claude-opus-4-1-20250805": ["顶级推理能力", "高端研究分析", "专业级写作", "复杂决策支持", "创新项目开发"],
};
