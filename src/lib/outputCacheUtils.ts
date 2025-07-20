/**
 * Output cache utilities separated to avoid fast refresh warnings
 */

interface MessageContent {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: string;
  tool_use_id?: string;
  id?: string;
}

export interface ClaudeStreamMessage {
  type: "system" | "assistant" | "user" | "result";
  subtype?: string;
  message?: {
    content?: MessageContent[];
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  tools?: string[];
  cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  result?: string;
  error?: string;
  session_id?: string;
  model?: string;
  cwd?: string;
  [key: string]: unknown;
}

export interface CachedSessionOutput {
  output: string;
  messages: ClaudeStreamMessage[];
  lastUpdated: number;
  status: string;
}

export interface OutputCacheContextType {
  getCachedOutput: (sessionId: number) => CachedSessionOutput | null;
  setCachedOutput: (sessionId: number, data: CachedSessionOutput) => void;
  updateSessionStatus: (sessionId: number, status: string) => void;
  clearCache: (sessionId?: number) => void;
  isPolling: boolean;
  startBackgroundPolling: () => void;
  stopBackgroundPolling: () => void;
}

/**
 * Create a standardized error for output cache context usage outside provider
 *
 * @param hookName - Name of the hook that was called outside the provider
 * @returns Error object with descriptive message
 *
 * @example
 * ```typescript
 * if (!context) {
 *   throw createOutputCacheError('useOutputCache');
 * }
 * ```
 */
export const createOutputCacheError = (hookName: string): Error => {
  return new Error(`${hookName} must be used within an OutputCacheProvider`);
};
