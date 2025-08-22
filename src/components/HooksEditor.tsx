/**
 * HooksEditor component for managing Claude Code hooks configuration
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  AlertTriangle,
  Code2,
  Terminal,
  FileText,
  ChevronRight,
  ChevronDown,
  Clock,
  Zap,
  Shield,
  PlayCircle,
  Info,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HooksManager } from "@/lib/hooksManager";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { handleError } from "@/lib/errorHandler";
import {
  HooksConfiguration,
  HookEvent,
  HookMatcher,
  HookCommand,
  HookTemplate,
  COMMON_TOOL_MATCHERS,
  HOOK_TEMPLATES,
} from "@/types/hooks";

/**
 * Props interface for the HooksEditor component
 */
interface HooksEditorProps {
  projectPath?: string;
  scope: "project" | "local" | "user";
  readOnly?: boolean;
  className?: string;
  onChange?: (hasChanges: boolean, getHooks: () => HooksConfiguration) => void;
  hideActions?: boolean;
}

interface EditableHookCommand extends HookCommand {
  id: string;
}

interface EditableHookMatcher extends Omit<HookMatcher, "hooks"> {
  id: string;
  hooks: EditableHookCommand[];
  expanded?: boolean;
}

/**
 * HooksEditor component for managing Claude Code hooks configuration
 *
 * A comprehensive editor interface for creating, editing, and managing hooks
 * that can be triggered during Claude Code operations. Features include syntax
 * validation, template selection, security warnings, and real-time preview.
 *
 * @param projectPath - Path to the project for project-scoped hooks
 * @param scope - Scope of the hooks configuration (project, local, or user)
 * @param onClose - Callback to close the editor
 * @param className - Additional CSS classes for styling
 *
 * @example
 * ```tsx
 * <HooksEditor
 *   projectPath="/path/to/project"
 *   scope="project"
 *   onClose={() => setShowEditor(false)}
 * />
 *
 * // User-level hooks
 * <HooksEditor
 *   scope="user"
 *   onClose={() => setShowEditor(false)}
 * />
 * ```
 */
export const HooksEditor: React.FC<HooksEditorProps> = ({
  projectPath,
  scope,
  readOnly = false,
  className,
  onChange,
  hideActions = false,
}) => {
  const { t } = useI18n();

  const EVENT_INFO: Record<
    HookEvent,
    { label: string; description: string; icon: React.ReactNode }
  > = {
    PreToolUse: {
      label: t.hooks.preToolUse,
      description: t.hooks.preToolUseDesc,
      icon: <Shield className="h-4 w-4" />,
    },
    PostToolUse: {
      label: t.hooks.postToolUse,
      description: t.hooks.postToolUseDesc,
      icon: <PlayCircle className="h-4 w-4" />,
    },
    Notification: {
      label: t.hooks.notification,
      description: t.hooks.notificationDesc,
      icon: <Zap className="h-4 w-4" />,
    },
    Stop: {
      label: t.hooks.stop,
      description: t.hooks.stopDesc,
      icon: <Code2 className="h-4 w-4" />,
    },
    SubagentStop: {
      label: t.hooks.subagentStop,
      description: t.hooks.subagentStopDesc,
      icon: <Terminal className="h-4 w-4" />,
    },
  };

  const [selectedEvent, setSelectedEvent] = useState<HookEvent>("PreToolUse");
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const isInitialMount = React.useRef(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hooks, setHooks] = useState<HooksConfiguration>({});

  // Events with matchers (tool-related) - memoized to prevent unnecessary re-renders
  const matcherEvents = React.useMemo(() => ["PreToolUse", "PostToolUse"] as const, []);
  // Events without matchers (non-tool-related) - memoized to prevent unnecessary re-renders
  const directEvents = React.useMemo(() => ["Notification", "Stop", "SubagentStop"] as const, []);

  // Convert hooks to editable format with IDs
  const [editableHooks, setEditableHooks] = useState<{
    PreToolUse: EditableHookMatcher[];
    PostToolUse: EditableHookMatcher[];
    Notification: EditableHookCommand[];
    Stop: EditableHookCommand[];
    SubagentStop: EditableHookCommand[];
  }>(() => {
    const result = {
      PreToolUse: [] as EditableHookMatcher[],
      PostToolUse: [] as EditableHookMatcher[],
      Notification: [] as EditableHookCommand[],
      Stop: [] as EditableHookCommand[],
      SubagentStop: [] as EditableHookCommand[],
    };

    // Initialize matcher events
    matcherEvents.forEach((event) => {
      const matchers = hooks?.[event] as HookMatcher[] | undefined;
      if (matchers && Array.isArray(matchers)) {
        result[event] = matchers.map((matcher) => ({
          ...matcher,
          id: HooksManager.generateId(),
          expanded: false,
          hooks: (matcher.hooks || []).map((hook) => ({
            ...hook,
            id: HooksManager.generateId(),
          })),
        }));
      }
    });

    // Initialize direct events
    directEvents.forEach((event) => {
      const commands = hooks?.[event] as HookCommand[] | undefined;
      if (commands && Array.isArray(commands)) {
        result[event] = commands.map((hook) => ({
          ...hook,
          id: HooksManager.generateId(),
        }));
      }
    });

    return result;
  });

  // Load hooks when projectPath or scope changes
  useEffect(() => {
    // For user scope, we don't need a projectPath
    if (scope === "user" || projectPath) {
      setIsLoading(true);
      setLoadError(null);

      api
        .getHooksConfig(scope, projectPath)
        .then((config) => {
          setHooks(config || {});
          setHasUnsavedChanges(false);
        })
        .catch(async (err) => {
          await handleError("Failed to load hooks configuration:", { context: err });
          setLoadError(err instanceof Error ? err.message : "Failed to load hooks configuration");
          setHooks({});
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      // No projectPath for project/local scopes
      setHooks({});
    }
  }, [projectPath, scope]);

  // Reset initial mount flag when hooks prop changes
  useEffect(() => {
    isInitialMount.current = true;
    setHasUnsavedChanges(false); // Reset unsaved changes when hooks prop changes

    // Reinitialize editable hooks when hooks prop changes
    const result: Record<HookEvent, EditableHookMatcher[]> = {
      PreToolUse: [],
      PostToolUse: [],
      Notification: [],
      Stop: [],
      SubagentStop: [],
    };

    // Initialize matcher events
    matcherEvents.forEach((event) => {
      const matchers = hooks?.[event] as HookMatcher[] | undefined;
      if (matchers && Array.isArray(matchers)) {
        result[event] = matchers.map((matcher) => ({
          ...matcher,
          id: HooksManager.generateId(),
          expanded: false,
          hooks: (matcher.hooks || []).map((hook) => ({
            ...hook,
            id: HooksManager.generateId(),
          })),
        }));
      }
    });

    // Initialize direct events
    directEvents.forEach((event) => {
      const commands = hooks?.[event] as HookCommand[] | undefined;
      if (commands && Array.isArray(commands)) {
        (result as Record<string, unknown>)[event] = commands.map((hook) => ({
          ...hook,
          id: HooksManager.generateId(),
        }));
      }
    });

    setEditableHooks(result as unknown as typeof editableHooks);
  }, [hooks, directEvents, matcherEvents]);

  // Track changes when editable hooks change (but don't save automatically)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setHasUnsavedChanges(true);
  }, [editableHooks]);

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      const getHooks = () => {
        const newHooks: HooksConfiguration = {};

        // Handle matcher events
        matcherEvents.forEach((event) => {
          const matchers = editableHooks[event];
          if (matchers.length > 0) {
            newHooks[event] = matchers.map(({ id: _id, expanded: _expanded, ...matcher }) => ({
              ...matcher,
              hooks: matcher.hooks.map(({ id: _hookId, ...hook }) => hook),
            }));
          }
        });

        // Handle direct events
        directEvents.forEach((event) => {
          const commands = editableHooks[event];
          if (commands.length > 0) {
            newHooks[event] = commands.map(({ id: _id, ...hook }) => hook);
          }
        });

        return newHooks;
      };

      onChange(hasUnsavedChanges, getHooks);
    }
  }, [hasUnsavedChanges, editableHooks, onChange, directEvents, matcherEvents]);

  // Save function to be called explicitly
  const handleSave = async () => {
    if (scope !== "user" && !projectPath) return;

    setIsSaving(true);

    const newHooks: HooksConfiguration = {};

    // Handle matcher events
    matcherEvents.forEach((event) => {
      const matchers = editableHooks[event];
      if (matchers.length > 0) {
        newHooks[event] = matchers.map(({ id: _id, expanded: _expanded, ...matcher }) => ({
          ...matcher,
          hooks: matcher.hooks.map(({ id: _hookId, ...hook }) => hook),
        }));
      }
    });

    // Handle direct events
    directEvents.forEach((event) => {
      const commands = editableHooks[event];
      if (commands.length > 0) {
        newHooks[event] = commands.map(({ id: _id, ...hook }) => hook);
      }
    });

    try {
      await api.updateHooksConfig(scope, newHooks, projectPath);
      setHooks(newHooks);
      setHasUnsavedChanges(false);
    } catch (error) {
      await handleError("Failed to save hooks:", { context: error });
      setLoadError(error instanceof Error ? error.message : "Failed to save hooks");
    } finally {
      setIsSaving(false);
    }
  };

  const addMatcher = (event: HookEvent) => {
    // Only for events with matchers
    if (!matcherEvents.includes(event as "PreToolUse" | "PostToolUse")) return;

    const newMatcher: EditableHookMatcher = {
      id: HooksManager.generateId(),
      matcher: ".*", // Default to match all instead of empty string
      hooks: [{
        id: HooksManager.generateId(),
        type: "command" as const,
        command: "echo 'Hook triggered'", // Default command instead of empty
      }],
      expanded: true,
    };

    setEditableHooks((prev) => ({
      ...prev,
      [event]: [
        ...(prev[event as "PreToolUse" | "PostToolUse"] as EditableHookMatcher[]),
        newMatcher,
      ],
    }));
  };

  const addDirectCommand = (event: HookEvent) => {
    // Only for events without matchers
    if (!directEvents.includes(event as "Notification" | "Stop" | "SubagentStop")) return;

    const newCommand: EditableHookCommand = {
      id: HooksManager.generateId(),
      type: "command",
      command: "echo 'Direct command executed'", // Default command instead of empty
    };

    setEditableHooks((prev) => ({
      ...prev,
      [event]: [
        ...(prev[event as "Notification" | "Stop" | "SubagentStop"] as EditableHookCommand[]),
        newCommand,
      ],
    }));
  };

  const updateMatcher = (
    event: HookEvent,
    matcherId: string,
    updates: Partial<EditableHookMatcher>
  ) => {
    if (!matcherEvents.includes(event as "PreToolUse" | "PostToolUse")) return;

    setEditableHooks((prev) => ({
      ...prev,
      [event]: (prev[event as "PreToolUse" | "PostToolUse"] as EditableHookMatcher[]).map(
        (matcher) => (matcher.id === matcherId ? { ...matcher, ...updates } : matcher)
      ),
    }));
  };

  const removeMatcher = (event: HookEvent, matcherId: string) => {
    if (!matcherEvents.includes(event as "PreToolUse" | "PostToolUse")) return;

    setEditableHooks((prev) => ({
      ...prev,
      [event]: (prev[event as "PreToolUse" | "PostToolUse"] as EditableHookMatcher[]).filter(
        (matcher) => matcher.id !== matcherId
      ),
    }));
  };

  const updateDirectCommand = (
    event: HookEvent,
    commandId: string,
    updates: Partial<EditableHookCommand>
  ) => {
    if (!directEvents.includes(event as "Notification" | "Stop" | "SubagentStop")) return;

    setEditableHooks((prev) => ({
      ...prev,
      [event]: (
        prev[event as "Notification" | "Stop" | "SubagentStop"] as EditableHookCommand[]
      ).map((cmd) => (cmd.id === commandId ? { ...cmd, ...updates } : cmd)),
    }));
  };

  const removeDirectCommand = (event: HookEvent, commandId: string) => {
    if (!directEvents.includes(event as "Notification" | "Stop" | "SubagentStop")) return;

    setEditableHooks((prev) => ({
      ...prev,
      [event]: (
        prev[event as "Notification" | "Stop" | "SubagentStop"] as EditableHookCommand[]
      ).filter((cmd) => cmd.id !== commandId),
    }));
  };

  /**
   * Apply a hook template to the editor
   *
   * @param template - Template to apply
   */
  const applyTemplate = (template: HookTemplate) => {
    if (matcherEvents.includes(template.event as "PreToolUse" | "PostToolUse")) {
      // For events with matchers
      const newMatcher: EditableHookMatcher = {
        id: HooksManager.generateId(),
        matcher: template.matcher,
        hooks: template.commands.map((cmd) => ({
          id: HooksManager.generateId(),
          type: "command" as const,
          command: cmd,
        })),
        expanded: true,
      };

      setEditableHooks((prev) => ({
        ...prev,
        [template.event]: [
          ...(prev[template.event as "PreToolUse" | "PostToolUse"] as EditableHookMatcher[]),
          newMatcher,
        ],
      }));
    } else {
      // For direct events
      const newCommands: EditableHookCommand[] = template.commands.map((cmd) => ({
        id: HooksManager.generateId(),
        type: "command" as const,
        command: cmd,
      }));

      setEditableHooks((prev) => ({
        ...prev,
        [template.event]: [
          ...(prev[
            template.event as "Notification" | "Stop" | "SubagentStop"
          ] as EditableHookCommand[]),
          ...newCommands,
        ],
      }));
    }

    setSelectedEvent(template.event);
    setShowTemplateDialog(false);
  };

  /**
   * Validate the current hooks configuration
   */
  const validateHooks = React.useCallback(async () => {
    if (!hooks) {
      setValidationErrors([]);
      setValidationWarnings([]);
      return;
    }

    const result = await HooksManager.validateConfig(hooks);
    setValidationErrors(result.errors.map((e) => e.message));
    setValidationWarnings(
      result.warnings.map(
        (w) => `${w.message} in command: ${(w.command || "").substring(0, 50)}...`
      )
    );
    
    // Auto-fix empty patterns and commands if there are validation errors
    if (result.errors.length > 0) {
      setEditableHooks((prev) => {
        const fixed = { ...prev };
        
        // Fix empty matchers
        matcherEvents.forEach((event) => {
          const matchers = fixed[event] as EditableHookMatcher[];
          if (matchers) {
            fixed[event] = matchers.map((matcher) => ({
              ...matcher,
              matcher: (matcher.matcher || "").trim() || ".*", // Fix empty patterns
              hooks: matcher.hooks.map((hook) => ({
                ...hook,
                command: hook.command.trim() || "echo 'Hook triggered'", // Fix empty commands
              })).filter((hook) => hook.command.trim()), // Remove truly empty commands
            })).filter((matcher) => matcher.hooks.length > 0); // Remove matchers with no valid commands
          }
        });
        
        // Fix empty direct commands
        directEvents.forEach((event) => {
          const commands = fixed[event] as EditableHookCommand[];
          if (commands) {
            fixed[event] = commands.map((cmd) => ({
              ...cmd,
              command: cmd.command.trim() || "echo 'Command executed'", // Fix empty commands
            })).filter((cmd) => cmd.command.trim()); // Remove truly empty commands
          }
        });
        
        return fixed;
      });
    }
  }, [hooks]);

  useEffect(() => {
    validateHooks();
  }, [hooks, validateHooks]);

  const addCommand = (event: HookEvent, matcherId: string) => {
    if (!matcherEvents.includes(event as "PreToolUse" | "PostToolUse")) return;

    const newCommand: EditableHookCommand = {
      id: HooksManager.generateId(),
      type: "command",
      command: "echo 'Command executed'", // Default command instead of empty
    };

    setEditableHooks((prev) => ({
      ...prev,
      [event]: (prev[event as "PreToolUse" | "PostToolUse"] as EditableHookMatcher[]).map(
        (matcher) =>
          matcher.id === matcherId ? { ...matcher, hooks: [...matcher.hooks, newCommand] } : matcher
      ),
    }));
  };

  const updateCommand = (
    event: HookEvent,
    matcherId: string,
    commandId: string,
    updates: Partial<EditableHookCommand>
  ) => {
    if (!matcherEvents.includes(event as "PreToolUse" | "PostToolUse")) return;

    setEditableHooks((prev) => ({
      ...prev,
      [event]: (prev[event as "PreToolUse" | "PostToolUse"] as EditableHookMatcher[]).map(
        (matcher) =>
          matcher.id === matcherId
            ? {
                ...matcher,
                hooks: matcher.hooks.map((cmd) =>
                  cmd.id === commandId ? { ...cmd, ...updates } : cmd
                ),
              }
            : matcher
      ),
    }));
  };

  const removeCommand = (event: HookEvent, matcherId: string, commandId: string) => {
    if (!matcherEvents.includes(event as "PreToolUse" | "PostToolUse")) return;

    setEditableHooks((prev) => ({
      ...prev,
      [event]: (prev[event as "PreToolUse" | "PostToolUse"] as EditableHookMatcher[]).map(
        (matcher) =>
          matcher.id === matcherId
            ? { ...matcher, hooks: matcher.hooks.filter((cmd) => cmd.id !== commandId) }
            : matcher
      ),
    }));
  };

  const renderMatcher = (event: HookEvent, matcher: EditableHookMatcher) => (
    <Card key={matcher.id} className="p-4 space-y-4">
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-6 w-6"
          onClick={() => updateMatcher(event, matcher.id, { expanded: !matcher.expanded })}
        >
          {matcher.expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor={`matcher-${matcher.id}`}>{t.hooks.pattern}</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t.hooks.patternTooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-2">
            <Input
              id={`matcher-${matcher.id}`}
              placeholder={t.hooks.patternPlaceholder}
              value={matcher.matcher ?? ""}
              onChange={(e) => updateMatcher(event, matcher.id, { matcher: e.target.value })}
              disabled={readOnly}
              className="flex-1"
            />

            <Select
              value={matcher.matcher ?? "custom"}
              onValueChange={(value) => {
                if (value !== "custom") {
                  updateMatcher(event, matcher.id, { matcher: value });
                }
              }}
              disabled={readOnly}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t.hooks.commonPatterns} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">{t.hooks.custom}</SelectItem>
                {COMMON_TOOL_MATCHERS.map((pattern) => (
                  <SelectItem key={pattern} value={pattern}>
                    {pattern}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!readOnly && (
              <Button variant="ghost" size="sm" onClick={() => removeMatcher(event, matcher.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {matcher.expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pl-10"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t.hooks.commands}</Label>
                {!readOnly && (
                  <Button variant="outline" size="sm" onClick={() => addCommand(event, matcher.id)}>
                    <Plus className="h-3 w-3 mr-1" />
                    {t.hooks.addCommand}
                  </Button>
                )}
              </div>

              {matcher.hooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.hooks.noCommandsAdded}</p>
              ) : (
                <div className="space-y-2">
                  {matcher.hooks.map((hook) => (
                    <div key={hook.id} className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <Textarea
                            placeholder={t.hooks.commandPlaceholder}
                            value={hook.command || ""}
                            onChange={(e) =>
                              updateCommand(event, matcher.id, hook.id, { command: e.target.value })
                            }
                            disabled={readOnly}
                            className="font-mono text-sm min-h-[80px]"
                          />

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <Input
                                type="number"
                                placeholder="60"
                                value={hook.timeout || ""}
                                onChange={(e) =>
                                  updateCommand(event, matcher.id, hook.id, {
                                    timeout: e.target.value ? parseInt(e.target.value) : undefined,
                                  })
                                }
                                disabled={readOnly}
                                className="w-20 h-8"
                              />
                              <span className="text-sm text-muted-foreground">
                                {t.hooks.seconds}
                              </span>
                            </div>

                            {!readOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCommand(event, matcher.id, hook.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Show warnings for this command */}
                      {(() => {
                        const warnings = HooksManager.checkDangerousPatterns(hook.command || "");
                        return (
                          warnings.length > 0 && (
                            <div className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded-md">
                              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                              <div className="space-y-1">
                                {warnings.map((warning, i) => (
                                  <p key={i} className="text-xs text-yellow-600">
                                    {warning}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );

  const renderDirectCommand = (event: HookEvent, command: EditableHookCommand) => (
    <Card key={command.id} className="p-4 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <Textarea
            placeholder={t.hooks.commandPlaceholder}
            value={command.command || ""}
            onChange={(e) => updateDirectCommand(event, command.id, { command: e.target.value })}
            disabled={readOnly}
            className="font-mono text-sm min-h-[80px]"
          />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <Input
                type="number"
                placeholder="60"
                value={command.timeout || ""}
                onChange={(e) =>
                  updateDirectCommand(event, command.id, {
                    timeout: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                disabled={readOnly}
                className="w-20 h-8"
              />
              <span className="text-sm text-muted-foreground">{t.hooks.seconds}</span>
            </div>

            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeDirectCommand(event, command.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Show warnings for this command */}
      {(() => {
        const warnings = HooksManager.checkDangerousPatterns(command.command || "");
        return (
          warnings.length > 0 && (
            <div className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded-md">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="space-y-1">
                {warnings.map((warning, i) => (
                  <p key={i} className="text-xs text-yellow-600">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          )
        );
      })()}
    </Card>
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">{t.hooks.loadingHooks}</span>
        </div>
      )}

      {/* Error State */}
      {loadError && !isLoading && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {loadError}
        </div>
      )}

      {/* Main Content */}
      {!isLoading && (
        <>
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t.hooks.hooksConfiguration}</h3>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    scope === "project" ? "secondary" : scope === "local" ? "outline" : "default"
                  }
                >
                  {scope === "project"
                    ? t.hooks.projectScope
                    : scope === "local"
                      ? t.hooks.localScope
                      : t.hooks.userScope}
                </Badge>
                {!readOnly && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)}>
                      <FileText className="h-4 w-4 mr-2" />
                      {t.hooks.templates}
                    </Button>
                    {!hideActions && (
                      <Button
                        variant={hasUnsavedChanges ? "default" : "outline"}
                        size="sm"
                        onClick={handleSave}
                        disabled={!hasUnsavedChanges || isSaving || !projectPath}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {isSaving ? t.hooks.savingHooks : t.common.save}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t.hooks.subtitle}
              {scope === "local" && ` ${t.hooks.localScopeDesc}`}
            </p>
            {hasUnsavedChanges && !readOnly && (
              <p className="text-sm text-amber-600">{t.hooks.unsavedChanges}</p>
            )}
          </div>

          {/* Validation Messages */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-red-500/10 rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-red-600">{t.hooks.validationErrors}</p>
                {!readOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Manually trigger the auto-fix logic
                      validateHooks();
                    }}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    Fix Issues
                  </Button>
                )}
              </div>
              {validationErrors.map((error, i) => (
                <p key={i} className="text-xs text-red-600">
                  • {error}
                </p>
              ))}
            </div>
          )}

          {validationWarnings.length > 0 && (
            <div className="p-3 bg-yellow-500/10 rounded-md space-y-1">
              <p className="text-sm font-medium text-yellow-600">{t.hooks.securityWarnings}</p>
              {validationWarnings.map((warning, i) => (
                <p key={i} className="text-xs text-yellow-600">
                  • {warning}
                </p>
              ))}
            </div>
          )}

          {/* Event Tabs */}
          <Tabs value={selectedEvent} onValueChange={(v) => setSelectedEvent(v as HookEvent)}>
            <TabsList className="w-full">
              {(Object.keys(EVENT_INFO) as HookEvent[]).map((event) => {
                const isMatcherEvent = matcherEvents.includes(
                  event as "PreToolUse" | "PostToolUse"
                );
                const count = isMatcherEvent
                  ? (editableHooks[event as "PreToolUse" | "PostToolUse"] as EditableHookMatcher[])
                      .length
                  : (
                      editableHooks[
                        event as "Notification" | "Stop" | "SubagentStop"
                      ] as EditableHookCommand[]
                    ).length;

                return (
                  <TabsTrigger key={event} value={event} className="flex items-center gap-2">
                    {EVENT_INFO[event].icon}
                    <span className="hidden sm:inline">{EVENT_INFO[event].label}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1">
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {(Object.keys(EVENT_INFO) as HookEvent[]).map((event) => {
              const isMatcherEvent = matcherEvents.includes(event as "PreToolUse" | "PostToolUse");
              const items = isMatcherEvent
                ? (editableHooks[event as "PreToolUse" | "PostToolUse"] as EditableHookMatcher[])
                : (editableHooks[
                    event as "Notification" | "Stop" | "SubagentStop"
                  ] as EditableHookCommand[]);

              return (
                <TabsContent key={event} value={event} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{EVENT_INFO[event].description}</p>
                  </div>

                  {items.length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground mb-4">{t.hooks.noHooksConfigured}</p>
                      {!readOnly && (
                        <Button
                          onClick={() =>
                            isMatcherEvent ? addMatcher(event) : addDirectCommand(event)
                          }
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {t.hooks.addHook}
                        </Button>
                      )}
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {isMatcherEvent
                        ? (items as EditableHookMatcher[]).map((matcher) =>
                            renderMatcher(event, matcher)
                          )
                        : (items as EditableHookCommand[]).map((command) =>
                            renderDirectCommand(event, command)
                          )}

                      {!readOnly && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            isMatcherEvent ? addMatcher(event) : addDirectCommand(event)
                          }
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {t.hooks.addHook}
                        </Button>
                      )}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Template Dialog */}
          <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.hooks.templates}</DialogTitle>
                <DialogDescription>
                  {t.hooks.chooseTemplate ||
                    "Choose a pre-configured hook template to get started quickly"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {HOOK_TEMPLATES.map((template) => (
                  <Card
                    key={template.id}
                    className="p-4 cursor-pointer hover:bg-accent"
                    onClick={() => applyTemplate(template)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{template.name}</h4>
                        <Badge>{EVENT_INFO[template.event].label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      {matcherEvents.includes(template.event as "PreToolUse" | "PostToolUse") &&
                        template.matcher && (
                          <p className="text-xs font-mono bg-muted px-2 py-1 rounded inline-block">
                            {t.hooks.pattern}: {template.matcher}
                          </p>
                        )}
                    </div>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};
