/**
 * Supported Claude model types
 */
export type ClaudeModel = 
  | "claude-3-5-haiku-20241022"
  | "claude-3-5-sonnet-20241022" 
  | "claude-3-7-sonnet-20250219"
  | "sonnet"  // Legacy Claude 4 Sonnet
  | "opus"    // Legacy Claude 4 Opus
  | "haiku"   // Claude 3.5 Haiku shorthand
  | "sonnet-3-5" // Claude 3.5 Sonnet shorthand
  | "sonnet-3-7"; // Claude 3.7 Sonnet shorthand

/**
 * Model configuration interface
 */
export interface ModelConfig {
  id: ClaudeModel;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'legacy' | 'current';
  performance: 'fast' | 'balanced' | 'powerful';
}

/**
 * Model display names mapping
 */
export const MODEL_DISPLAY_NAMES: Record<ClaudeModel, string> = {
  "claude-3-5-haiku-20241022": "Claude 3.5 Haiku",
  "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
  "claude-3-7-sonnet-20250219": "Claude 3.7 Sonnet", 
  "sonnet": "Claude 4 Sonnet",
  "opus": "Claude 4 Opus",
  "haiku": "Claude 3.5 Haiku",
  "sonnet-3-5": "Claude 3.5 Sonnet",
  "sonnet-3-7": "Claude 3.7 Sonnet"
};

/**
 * Get display name for a model
 */
export function getModelDisplayName(model: ClaudeModel): string {
  return MODEL_DISPLAY_NAMES[model] || model;
}

/**
 * Check if model is legacy (Claude 4)
 */
export function isLegacyModel(model: ClaudeModel): boolean {
  return model === "sonnet" || model === "opus";
}

/**
 * Model to API model mapping
 * Maps shorthand model names to their full API identifiers
 */
export const MODEL_API_MAPPING: Record<ClaudeModel, string> = {
  "claude-3-5-haiku-20241022": "claude-3-5-haiku-20241022",
  "claude-3-5-sonnet-20241022": "claude-3-5-sonnet-20241022",
  "claude-3-7-sonnet-20250219": "claude-3-7-sonnet-20250219",
  "sonnet": "claude-3-5-sonnet-20241022", // Legacy mapping to current Sonnet
  "opus": "claude-3-opus-20240229", // Legacy mapping to Opus
  "haiku": "claude-3-5-haiku-20241022",
  "sonnet-3-5": "claude-3-5-sonnet-20241022",
  "sonnet-3-7": "claude-3-7-sonnet-20250219"
};

/**
 * Get API model identifier from shorthand
 */
export function getApiModel(model: ClaudeModel): string {
  return MODEL_API_MAPPING[model] || model;
}