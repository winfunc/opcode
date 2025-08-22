/**
 * Hooks configuration manager for Claude Code hooks
 */

import {
  HooksConfiguration,
  HookMatcher,
  HookValidationResult,
  HookValidationError,
  HookValidationWarning,
  HookCommand,
} from "@/types/hooks";

/**
 * Hooks configuration manager for Claude Code hooks
 *
 * Provides utilities for managing, validating, and merging hook configurations
 * across different scopes (user, project, local) with proper priority handling.
 */
export class HooksManager {
  /**
   * Merge hooks configurations with proper priority
   * Priority: local > project > user
   *
   * @param user - User-level hooks configuration
   * @param project - Project-level hooks configuration
   * @param local - Local-level hooks configuration
   * @returns Merged hooks configuration with proper priority
   *
   * @example
   * ```typescript
   * const merged = HooksManager.mergeConfigs(userHooks, projectHooks, localHooks);
   * ```
   */
  static mergeConfigs(
    user: HooksConfiguration,
    project: HooksConfiguration,
    local: HooksConfiguration
  ): HooksConfiguration {
    const merged: HooksConfiguration = {};

    // Events with matchers (tool-related)
    const matcherEvents: (keyof HooksConfiguration)[] = ["PreToolUse", "PostToolUse"];

    // Events without matchers (non-tool-related)
    const directEvents: (keyof HooksConfiguration)[] = ["Notification", "Stop", "SubagentStop"];

    // Merge events with matchers
    for (const event of matcherEvents) {
      // Start with user hooks
      let matchers = [...((user[event] as HookMatcher[] | undefined) || [])];

      // Add project hooks (may override by matcher pattern)
      if (project[event]) {
        matchers = this.mergeMatchers(matchers, project[event] as HookMatcher[]);
      }

      // Add local hooks (highest priority)
      if (local[event]) {
        matchers = this.mergeMatchers(matchers, local[event] as HookMatcher[]);
      }

      if (matchers.length > 0) {
        (merged as Record<string, unknown>)[event] = matchers;
      }
    }

    // Merge events without matchers
    for (const event of directEvents) {
      // Combine all hooks from all levels (local takes precedence)
      const hooks: HookCommand[] = [];

      // Add user hooks
      if (user[event]) {
        hooks.push(...(user[event] as HookCommand[]));
      }

      // Add project hooks
      if (project[event]) {
        hooks.push(...(project[event] as HookCommand[]));
      }

      // Add local hooks (highest priority)
      if (local[event]) {
        hooks.push(...(local[event] as HookCommand[]));
      }

      if (hooks.length > 0) {
        (merged as Record<string, unknown>)[event] = hooks;
      }
    }

    return merged;
  }

  /**
   * Merge matcher arrays, with later items taking precedence
   *
   * @param base - Base array of hook matchers
   * @param override - Override array of hook matchers that take precedence
   * @returns Merged array with override matchers replacing base matchers by pattern
   */
  private static mergeMatchers(base: HookMatcher[], override: HookMatcher[]): HookMatcher[] {
    const result = [...base];

    for (const overrideMatcher of override) {
      const existingIndex = result.findIndex((m) => m.matcher === overrideMatcher.matcher);

      if (existingIndex >= 0) {
        // Replace existing matcher
        result[existingIndex] = overrideMatcher;
      } else {
        // Add new matcher
        result.push(overrideMatcher);
      }
    }

    return result;
  }

  /**
   * Validate hooks configuration for syntax errors and security issues
   *
   * @param hooks - The hooks configuration to validate
   * @returns Promise resolving to validation result with errors and warnings
   *
   * @example
   * ```typescript
   * const result = await HooksManager.validateConfig(hooksConfig);
   * if (!result.valid) {
   *   console.error('Validation errors:', result.errors);
   * }
   * ```
   */
  static async validateConfig(hooks: HooksConfiguration): Promise<HookValidationResult> {
    const errors: HookValidationError[] = [];
    const warnings: HookValidationWarning[] = [];

    // Guard against undefined or null hooks
    if (!hooks) {
      return { valid: true, errors, warnings };
    }

    // Events with matchers
    const matcherEvents = ["PreToolUse", "PostToolUse"] as const;

    // Events without matchers
    const directEvents = ["Notification", "Stop", "SubagentStop"] as const;

    // Validate events with matchers
    for (const event of matcherEvents) {
      const matchers = hooks[event];
      if (!matchers || !Array.isArray(matchers)) continue;

      for (const matcher of matchers) {
        // Validate regex pattern if provided
        if (matcher.matcher) {
          // Check for empty or whitespace-only patterns
          if (!matcher.matcher.trim()) {
            errors.push({
              event,
              matcher: matcher.matcher,
              message: "Empty regex pattern - please provide a valid pattern",
            });
          } else {
            try {
              new RegExp(matcher.matcher);
            } catch (regexError) {
              errors.push({
                event,
                matcher: matcher.matcher,
                message: `Invalid regex pattern: ${regexError instanceof Error ? regexError.message : "Unknown error"}`,
              });
            }
          }
        } else {
          errors.push({
            event,
            matcher: matcher.matcher || "(empty)",
            message: "Missing regex pattern - please provide a pattern to match tools",
          });
        }

        // Validate commands
        if (matcher.hooks && Array.isArray(matcher.hooks)) {
          if (matcher.hooks.length === 0) {
            errors.push({
              event,
              matcher: matcher.matcher,
              message: "No commands defined - please add at least one command",
            });
          } else {
            for (const hook of matcher.hooks) {
              if (!hook.command || !hook.command.trim()) {
                errors.push({
                  event,
                  matcher: matcher.matcher,
                  message: "Empty command - please provide a command to execute",
                });
              } else {
                // Check for dangerous patterns
                const dangers = this.checkDangerousPatterns(hook.command);
                warnings.push(
                  ...dangers.map((d) => ({
                    event,
                    matcher: matcher.matcher,
                    command: hook.command,
                    message: d,
                  }))
                );
              }
            }
          }
        }
      }
    }

    // Validate events without matchers
    for (const event of directEvents) {
      const directHooks = hooks[event];
      if (!directHooks || !Array.isArray(directHooks)) continue;

      for (const hook of directHooks) {
        if (!hook.command || !hook.command.trim()) {
          errors.push({
            event,
            message: "Empty command - please provide a command to execute",
          });
        } else {
          // Check for dangerous patterns
          const dangers = this.checkDangerousPatterns(hook.command);
          warnings.push(
            ...dangers.map((d) => ({
              event,
              command: hook.command,
              message: d,
            }))
          );
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Check for potentially dangerous command patterns in shell commands
   *
   * @param command - The shell command to analyze for security risks
   * @returns Array of warning messages for detected dangerous patterns
   *
   * @example
   * ```typescript
   * const warnings = HooksManager.checkDangerousPatterns('rm -rf /');
   * // Returns: ['Destructive command on root directory']
   * ```
   */
  public static checkDangerousPatterns(command: string): string[] {
    const warnings: string[] = [];

    // Guard against undefined or null commands
    if (!command || typeof command !== "string") {
      return warnings;
    }

    const patterns = [
      { pattern: /rm\s+-rf\s+\/(?:\s|$)/, message: "Destructive command on root directory" },
      { pattern: /rm\s+-rf\s+~/, message: "Destructive command on home directory" },
      { pattern: /:\s*\(\s*\)\s*\{.*\}\s*;/, message: "Fork bomb pattern detected" },
      { pattern: /curl.*\|\s*(?:bash|sh)/, message: "Downloading and executing remote code" },
      { pattern: /wget.*\|\s*(?:bash|sh)/, message: "Downloading and executing remote code" },
      { pattern: />\/dev\/sda/, message: "Direct disk write operation" },
      { pattern: /sudo\s+/, message: "Elevated privileges required" },
      { pattern: /dd\s+.*of=\/dev\//, message: "Dangerous disk operation" },
      { pattern: /mkfs\./, message: "Filesystem formatting command" },
      { pattern: /:(){ :|:& };:/, message: "Fork bomb detected" },
    ];

    for (const { pattern, message } of patterns) {
      if (pattern.test(command)) {
        warnings.push(message);
      }
    }

    // Check for unescaped variables that could lead to code injection
    if (command.includes("$") && !command.includes('"$')) {
      warnings.push("Unquoted shell variable detected - potential code injection risk");
    }

    return warnings;
  }

  /**
   * Escape a command for safe shell execution
   *
   * @param command - The command string to escape
   * @returns Escaped command string safe for shell execution
   *
   * @example
   * ```typescript
   * const safe = HooksManager.escapeCommand('echo "hello $USER"');
   * // Returns: 'echo "hello \\$USER"'
   * ```
   */
  static escapeCommand(command: string): string {
    // Basic shell escaping - in production, use a proper shell escaping library
    return command
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\$/g, "\\$")
      .replace(/`/g, "\\`");
  }

  /**
   * Generate a unique ID for hooks/matchers/commands
   *
   * @returns Unique identifier string combining timestamp and random characters
   *
   * @example
   * ```typescript
   * const id = HooksManager.generateId();
   * // Returns: '1703123456789-abc123def'
   * ```
   */
  static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
