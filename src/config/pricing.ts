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
 * 获取模型定价信息
 */
export function getModelPricing(model: string): ModelPricing | null {
  return MODEL_PRICING[model] || null;
}

/**
 * 计算使用成本
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
 * 格式化价格显示
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * 获取模型性价比评级
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