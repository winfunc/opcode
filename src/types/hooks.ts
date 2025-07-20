/**
 * Types for Claude Code hooks configuration
 *
 * Defines the structure for configuring hooks that can be triggered
 * during various Claude Code operations like tool usage and notifications.
 */

/**
 * Represents a shell command to execute as part of a hook
 */
export interface HookCommand {
  type: "command";
  command: string;
  timeout?: number; // Optional timeout in seconds (default: 60)
}

/**
 * Matches tools by pattern and defines hooks to execute
 */
export interface HookMatcher {
  matcher?: string; // Pattern to match tool names (regex supported)
  hooks: HookCommand[];
}

/**
 * Complete hooks configuration for different Claude Code events
 */
export interface HooksConfiguration {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
  Notification?: HookCommand[];
  Stop?: HookCommand[];
  SubagentStop?: HookCommand[];
}

/**
 * Available hook event types
 */
export type HookEvent = keyof HooksConfiguration;

/**
 * Claude settings extended with hooks configuration
 */
export interface ClaudeSettingsWithHooks {
  hooks?: HooksConfiguration;
  [key: string]: unknown;
}

/**
 * Represents a validation error in hook configuration
 */
export interface HookValidationError {
  event: string;
  matcher?: string;
  command?: string;
  message: string;
}

/**
 * Represents a validation warning in hook configuration
 */
export interface HookValidationWarning {
  event: string;
  matcher?: string;
  command: string;
  message: string;
}

/**
 * Result of hook configuration validation
 */
export interface HookValidationResult {
  valid: boolean;
  errors: HookValidationError[];
  warnings: HookValidationWarning[];
}

/**
 * Scope levels for hook configuration
 */
export type HookScope = "user" | "project" | "local";

/**
 * Common tool matchers for autocomplete suggestions
 *
 * Predefined patterns that match frequently used Claude Code tools.
 * These can be used in hook configurations for common scenarios.
 */
export const COMMON_TOOL_MATCHERS = [
  "Task",
  "Bash",
  "Glob",
  "Grep",
  "Read",
  "Edit",
  "MultiEdit",
  "Write",
  "WebFetch",
  "WebSearch",
  "Notebook.*",
  "Edit|Write",
  "mcp__.*",
  "mcp__memory__.*",
  "mcp__filesystem__.*",
  "mcp__github__.*",
];

/**
 * Template for creating predefined hook configurations
 */
export interface HookTemplate {
  id: string;
  name: string;
  description: string;
  event: HookEvent;
  matcher?: string;
  commands: string[];
}

/**
 * Predefined hook templates for common use cases
 *
 * Collection of ready-to-use hook configurations that demonstrate
 * best practices and solve common automation scenarios.
 *
 * @example
 * ```typescript
 * const template = HOOK_TEMPLATES.find(t => t.id === 'log-bash-commands');
 * // Use template to create a new hook configuration
 * ```
 */
export const HOOK_TEMPLATES: HookTemplate[] = [
  {
    id: "log-bash-commands",
    name: "Log Shell Commands",
    description: "Log all bash commands to a file for auditing",
    event: "PreToolUse",
    matcher: "Bash",
    commands: [
      'jq -r \'"\\(.tool_input.command) - \\(.tool_input.description // "No description")"\' >> ~/.claude/bash-command-log.txt',
    ],
  },
  {
    id: "format-on-save",
    name: "Auto-format Code",
    description: "Run code formatters after file modifications",
    event: "PostToolUse",
    matcher: "Write|Edit|MultiEdit",
    commands: [
      'if [[ "$( jq -r .tool_input.file_path )" =~ \\.(ts|tsx|js|jsx)$ ]]; then prettier --write "$( jq -r .tool_input.file_path )"; fi',
      'if [[ "$( jq -r .tool_input.file_path )" =~ \\.go$ ]]; then gofmt -w "$( jq -r .tool_input.file_path )"; fi',
    ],
  },
  {
    id: "git-commit-guard",
    name: "Protect Main Branch",
    description: "Prevent direct commits to main/master branch",
    event: "PreToolUse",
    matcher: "Bash",
    commands: [
      'if [[ "$(jq -r .tool_input.command)" =~ "git commit" ]] && [[ "$(git branch --show-current 2>/dev/null)" =~ ^(main|master)$ ]]; then echo "Direct commits to main/master branch are not allowed"; exit 2; fi',
    ],
  },
  {
    id: "custom-notification",
    name: "Custom Notifications",
    description: "Send custom notifications when Claude needs attention",
    event: "Notification",
    commands: [
      'osascript -e "display notification \\"$(jq -r .message)\\" with title \\"$(jq -r .title)\\" sound name \\"Glass\\""',
    ],
  },
  {
    id: "continue-on-tests",
    name: "Auto-continue on Test Success",
    description: "Automatically continue when tests pass",
    event: "Stop",
    commands: [
      'if grep -q "All tests passed" "$( jq -r .transcript_path )"; then echo \'{"decision": "block", "reason": "All tests passed. Continue with next task."}\'; fi',
    ],
  },
];
