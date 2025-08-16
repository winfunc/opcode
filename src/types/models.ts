import type { ReactNode } from "react";

/**
 * Supported Claude model types
 *
 * Represents all available Claude AI models that can be used in the application.
 * Includes both full model identifiers and shorthand aliases for convenience.
 *
 * @example
 * ```tsx
 * const model: ClaudeModel = "claude-3-5-sonnet-20241022";
 * const shorthand: ClaudeModel = "sonnet-3-5"; // Same model, shorthand
 * ```
 */
export type ClaudeModel =
  | "claude-3-5-haiku-20241022" // Fast, cost-effective model for simple tasks
  | "claude-3-5-sonnet-20241022" // Balanced performance and capability
  | "claude-3-7-sonnet-20250219" // Latest model with enhanced capabilities
  | "claude-sonnet-4-20250514-thinking" // Claude 4 Sonnet with thinking capabilities
  | "claude-opus-4-20250514-thinking" // Claude 4 Opus with thinking capabilities
  | "claude-opus-4-1-20250805" // Claude Opus 4.1 model
  | "claude-3-7-sonnet-20250219-thinking" // Claude 3.7 Sonnet with thinking capabilities
  | "sonnet" // Legacy Claude 4 Sonnet alias
  | "opus" // Legacy Claude 4 Opus alias
  | "haiku" // Claude 3.5 Haiku shorthand
  | "sonnet-3-5" // Claude 3.5 Sonnet shorthand
  | "sonnet-3-7"; // Claude 3.7 Sonnet shorthand

/**
 * Model configuration interface
 *
 * Comprehensive configuration object for Claude models containing
 * display information, categorization, and performance characteristics.
 *
 * @example
 * ```tsx
 * const config: ModelConfig = {
 *   id: "claude-3-5-sonnet-20241022",
 *   name: "Claude 3.5 Sonnet",
 *   description: "Balanced model for general use",
 *   icon: <SonnetIcon />,
 *   category: "current",
 *   performance: "balanced"
 * };
 * ```
 */
export interface ModelConfig {
  /** Unique model identifier */
  id: ClaudeModel;
  /** Human-readable display name */
  name: string;
  /** Brief description of model capabilities and use cases */
  description: string;
  /** React component or icon to display for this model */
  icon: ReactNode;
  /** Whether this is a legacy or current generation model */
  category: "legacy" | "current";
  /** Performance characteristics of the model */
  performance: "fast" | "balanced" | "powerful";
}

/**
 * Model display names mapping
 */
export const MODEL_DISPLAY_NAMES: Record<ClaudeModel, string> = {
  "claude-3-5-haiku-20241022": "Claude 3.5 Haiku",
  "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
  "claude-3-7-sonnet-20250219": "Claude 3.7 Sonnet",
  "claude-sonnet-4-20250514-thinking": "Claude 4 Sonnet (Thinking)",
  "claude-opus-4-20250514-thinking": "Claude 4 Opus (Thinking)",
  "claude-opus-4-1-20250805": "Claude Opus 4.1",
  "claude-3-7-sonnet-20250219-thinking": "Claude 3.7 Sonnet (Thinking)",
  sonnet: "Claude 4 Sonnet",
  opus: "Claude 4 Opus",
  haiku: "Claude 3.5 Haiku",
  "sonnet-3-5": "Claude 3.5 Sonnet",
  "sonnet-3-7": "Claude 3.7 Sonnet",
};

/**
 * Get display name for a model
 *
 * Converts a model identifier to its human-readable display name.
 * Falls back to the original model string if no mapping exists.
 *
 * @param model - The Claude model identifier
 * @returns Human-readable display name
 *
 * @example
 * ```tsx
 * getModelDisplayName("sonnet-3-5") // Returns: "Claude 3.5 Sonnet"
 * getModelDisplayName("claude-3-5-haiku-20241022") // Returns: "Claude 3.5 Haiku"
 * ```
 */
export function getModelDisplayName(model: ClaudeModel): string {
  return MODEL_DISPLAY_NAMES[model] || model;
}

/**
 * Check if model is legacy (Claude 4)
 *
 * Determines if a given model is from the legacy Claude 4 generation.
 * Legacy models may have different capabilities or pricing structures.
 *
 * @param model - The Claude model to check
 * @returns True if the model is from Claude 4 generation
 *
 * @example
 * ```typescript
 * isLegacyModel('sonnet') // true (Claude 4 Sonnet)
 * isLegacyModel('sonnet-3-5') // false (Claude 3.5 Sonnet)
 * ```
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
  "claude-sonnet-4-20250514-thinking": "claude-sonnet-4-20250514-thinking",
  "claude-opus-4-20250514-thinking": "claude-opus-4-20250514-thinking",
  "claude-opus-4-1-20250805": "claude-opus-4-1-20250805",
  "claude-3-7-sonnet-20250219-thinking": "claude-3-7-sonnet-20250219-thinking",
  sonnet: "claude-sonnet-4-20250514", // Legacy mapping to Claude 4 Sonnet
  opus: "claude-opus-4-20250514", // Legacy mapping to Claude 4 Opus
  haiku: "claude-3-5-haiku-20241022",
  "sonnet-3-5": "claude-3-5-sonnet-20241022",
  "sonnet-3-7": "claude-3-7-sonnet-20250219",
};

/**
 * Get API model identifier from shorthand
 *
 * Converts shorthand model names to their full API identifiers
 * required for making requests to the Claude API.
 *
 * @param model - Shorthand or full model identifier
 * @returns Full API model identifier
 *
 * @example
 * ```typescript
 * getApiModel('sonnet-3-5') // 'claude-3-5-sonnet-20241022'
 * getApiModel('haiku') // 'claude-3-5-haiku-20241022'
 * getApiModel('claude-3-5-sonnet-20241022') // 'claude-3-5-sonnet-20241022'
 * ```
 */
export function getApiModel(model: ClaudeModel): string {
  return MODEL_API_MAPPING[model] || model;
}
