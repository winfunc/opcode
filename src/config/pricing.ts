/**
 * Claude 模型定价配置
 * 基于 Anthropic 官方定价：https://docs.anthropic.com/zh-CN/docs/about-claude/pricing
 * 更新时间：2025年1月19日
 * 
 * 价格单位：美元/百万tokens
 */

export interface ModelPricing {
  inputPrice: number;      // 输入token价格
  outputPrice: number;     // 输出token价格
  cacheWritePrice: number; // 缓存写入价格
  cacheReadPrice: number;  // 缓存读取价格
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 3.5 Haiku - 最具性价比的模型
  'claude-3-5-haiku-20241022': {
    inputPrice: 0.80,
    outputPrice: 4.00,
    cacheWritePrice: 1.00,
    cacheReadPrice: 0.08,
  },
  'haiku': {
    inputPrice: 0.80,
    outputPrice: 4.00,
    cacheWritePrice: 1.00,
    cacheReadPrice: 0.08,
  },

  // Claude 3.5 Sonnet - 平衡性能和成本
  'claude-3-5-sonnet-20241022': {
    inputPrice: 3.00,
    outputPrice: 15.00,
    cacheWritePrice: 3.75,
    cacheReadPrice: 0.30,
  },
  'sonnet-3-5': {
    inputPrice: 3.00,
    outputPrice: 15.00,
    cacheWritePrice: 3.75,
    cacheReadPrice: 0.30,
  },
  'sonnet': { // 向后兼容
    inputPrice: 3.00,
    outputPrice: 15.00,
    cacheWritePrice: 3.75,
    cacheReadPrice: 0.30,
  },

  // Claude 3.7 Sonnet - 最新最强性能
  'claude-3-7-sonnet-20250219': {
    inputPrice: 4.00,
    outputPrice: 20.00,
    cacheWritePrice: 5.00,
    cacheReadPrice: 0.40,
  },
  'sonnet-3-7': {
    inputPrice: 4.00,
    outputPrice: 20.00,
    cacheWritePrice: 5.00,
    cacheReadPrice: 0.40,
  },

  // Claude 3 Opus - 最强推理能力
  'claude-3-opus-20240229': {
    inputPrice: 15.00,
    outputPrice: 75.00,
    cacheWritePrice: 18.75,
    cacheReadPrice: 1.50,
  },
  'opus': {
    inputPrice: 15.00,
    outputPrice: 75.00,
    cacheWritePrice: 18.75,
    cacheReadPrice: 1.50,
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
 *   console.log(`Input: $${pricing.inputPrice}/M tokens`);
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
 * console.log(`Total cost: $${cost.toFixed(4)}`);
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
    console.warn(`未知模型定价: ${model}`);
    return 0;
  }

  const cost = 
    (inputTokens * pricing.inputPrice / 1_000_000) +
    (outputTokens * pricing.outputPrice / 1_000_000) +
    (cacheCreationTokens * pricing.cacheWritePrice / 1_000_000) +
    (cacheReadTokens * pricing.cacheReadPrice / 1_000_000);

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
 * getModelCostEfficiency('claude-3-opus-20240229') // 'low'
 * ```
 */
export function getModelCostEfficiency(model: string): 'high' | 'medium' | 'low' {
  const pricing = getModelPricing(model);
  if (!pricing) return 'medium';

  const avgPrice = (pricing.inputPrice + pricing.outputPrice) / 2;
  
  if (avgPrice <= 3) return 'high';      // Haiku 级别
  if (avgPrice <= 10) return 'medium';   // Sonnet 级别
  return 'low';                          // Opus 级别
}

/**
 * 模型推荐用途
 */
export const MODEL_USE_CASES: Record<string, string[]> = {
  'claude-3-5-haiku-20241022': [
    '大量文本处理',
    '内容总结',
    '简单问答',
    '代码注释',
    '翻译任务'
  ],
  'claude-3-5-sonnet-20241022': [
    '代码生成',
    '复杂分析',
    '创意写作',
    '技术文档',
    '数据处理'
  ],
  'claude-3-7-sonnet-20250219': [
    '高级推理',
    '复杂编程',
    '深度分析',
    '专业咨询',
    '创新解决方案'
  ],
  'claude-3-opus-20240229': [
    '最复杂推理',
    '高级研究',
    '专业写作',
    '复杂决策',
    '创意项目'
  ]
};