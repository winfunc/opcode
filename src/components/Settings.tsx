import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Save, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api, type ClaudeSettings, type ClaudeInstallation } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { ClaudeVersionSelector } from "./ClaudeVersionSelector";
import { StorageTab } from "./StorageTab";
import { HooksEditor } from "./HooksEditor";
import { SlashCommandsManager } from "./SlashCommandsManager";
import { logger } from "@/lib/logger";
import { handleError, handleApiError } from "@/lib/errorHandler";
interface SettingsProps {
  /**
   * Callback to go back to the main view
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

interface PermissionRule {
  id: string;
  value: string;
}

interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
}

/**
 * Comprehensive Settings UI for managing Claude Code settings
 *
 * A complete settings management interface providing a no-code way to edit
 * the settings.json file. Features include tabbed navigation, real-time
 * validation, binary path management, permission rules, environment variables,
 * hooks configuration, and slash commands management.
 *
 * @param onBack - Callback to go back to the main view
 * @param className - Optional className for styling
 *
 * @example
 * ```tsx
 * <Settings
 *   onBack={() => setView('main')}
 *   className="max-w-6xl mx-auto"
 * />
 * ```
 */
export const Settings: React.FC<SettingsProps> = ({ onBack, className }) => {
  const { t } = useI18n();
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [currentBinaryPath, setCurrentBinaryPath] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<ClaudeInstallation | null>(null);
  const [binaryPathChanged, setBinaryPathChanged] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Permission rules state
  const [allowRules, setAllowRules] = useState<PermissionRule[]>([]);
  const [denyRules, setDenyRules] = useState<PermissionRule[]>([]);

  // Environment variables state
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);

  // Hooks state
  const [userHooksChanged, setUserHooksChanged] = useState(false);
  const getUserHooks = React.useRef<(() => unknown) | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadClaudeBinaryPath();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Loads the current Claude binary path
   */
  const loadClaudeBinaryPath = async () => {
    try {
      const path = await api.getClaudeBinaryPath();
      setCurrentBinaryPath(path);
    } catch (err) {
      await handleApiError(err as Error, {
        operation: "loadClaudeBinaryPath",
        component: "Settings",
      });
    }
  };

  /**
   * Loads the current Claude settings
   */
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSettings = await api.getClaudeSettings();

      // Ensure loadedSettings is an object
      if (!loadedSettings || typeof loadedSettings !== "object") {
        logger.warn("Loaded settings is not an object:", loadedSettings);
        setSettings({});
        return;
      }

      setSettings(loadedSettings);

      // Parse permissions
      if (loadedSettings.permissions && typeof loadedSettings.permissions === "object") {
        const permissions = loadedSettings.permissions as { allow?: string[]; deny?: string[] };
        if (Array.isArray(permissions.allow)) {
          setAllowRules(
            permissions.allow.map((rule: string, index: number) => ({
              id: `allow-${index}`,
              value: rule,
            }))
          );
        }
        if (Array.isArray(permissions.deny)) {
          setDenyRules(
            permissions.deny.map((rule: string, index: number) => ({
              id: `deny-${index}`,
              value: rule,
            }))
          );
        }
      }

      // Parse environment variables
      if (
        loadedSettings.env &&
        typeof loadedSettings.env === "object" &&
        !Array.isArray(loadedSettings.env)
      ) {
        setEnvVars(
          Object.entries(loadedSettings.env).map(([key, value], index) => ({
            id: `env-${index}`,
            key,
            value: value as string,
          }))
        );
      }
    } catch (err) {
      await handleError("Failed to load settings:", { context: err });
      setError(t.settings.failedToLoadSettings);
      setSettings({});
    } finally {
      setLoading(false);
    }
  }, [t.settings.failedToLoadSettings]);

  /**
   * Saves the current settings
   */
  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setToast(null);

      // Build the settings object
      const updatedSettings: ClaudeSettings = {
        ...settings,
        permissions: {
          allow: allowRules.map((rule) => rule.value).filter((v) => v.trim()),
          deny: denyRules.map((rule) => rule.value).filter((v) => v.trim()),
        },
        env: envVars.reduce(
          (acc, { key, value }) => {
            if (key.trim() && value.trim()) {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, string>
        ),
      };

      await api.saveClaudeSettings(updatedSettings);
      setSettings(updatedSettings);

      // Save Claude binary path if changed
      if (binaryPathChanged && selectedInstallation) {
        await api.setClaudeBinaryPath(selectedInstallation.path);
        setCurrentBinaryPath(selectedInstallation.path);
        setBinaryPathChanged(false);
      }

      // Save user hooks if changed
      if (userHooksChanged && getUserHooks.current) {
        const hooks = getUserHooks.current();
        await api.updateHooksConfig("user", hooks as Record<string, unknown>);
        setUserHooksChanged(false);
      }

      setToast({ message: t.settings.settingsSavedSuccessfully, type: "success" });
    } catch (err) {
      await handleError("Failed to save settings:", { context: err });
      setError("Failed to save settings.");
      setToast({ message: t.settings.failedToSaveSettings, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Updates a simple setting value
   */
  /**
   * Update a specific setting value
   *
   * @param key - Setting key to update
   * @param value - New value for the setting
   */
  const updateSetting = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Adds a new permission rule
   */
  /**
   * Add a new permission rule
   *
   * @param type - Type of rule to add (allow or deny)
   */
  const addPermissionRule = (type: "allow" | "deny") => {
    const newRule: PermissionRule = {
      id: `${type}-${Date.now()}`,
      value: "",
    };

    if (type === "allow") {
      setAllowRules((prev) => [...prev, newRule]);
    } else {
      setDenyRules((prev) => [...prev, newRule]);
    }
  };

  /**
   * Updates a permission rule
   */
  /**
   * Update an existing permission rule
   *
   * @param type - Type of rule (allow or deny)
   * @param id - ID of the rule to update
   * @param value - New value for the rule
   */
  const updatePermissionRule = (type: "allow" | "deny", id: string, value: string) => {
    if (type === "allow") {
      setAllowRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, value } : rule)));
    } else {
      setDenyRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, value } : rule)));
    }
  };

  /**
   * Removes a permission rule
   */
  /**
   * Remove a permission rule
   *
   * @param type - Type of rule (allow or deny)
   * @param id - ID of the rule to remove
   */
  const removePermissionRule = (type: "allow" | "deny", id: string) => {
    if (type === "allow") {
      setAllowRules((prev) => prev.filter((rule) => rule.id !== id));
    } else {
      setDenyRules((prev) => prev.filter((rule) => rule.id !== id));
    }
  };

  /**
   * Adds a new environment variable
   */
  /**
   * Add a new environment variable
   */
  const addEnvVar = () => {
    const newVar: EnvironmentVariable = {
      id: `env-${Date.now()}`,
      key: "",
      value: "",
    };
    setEnvVars((prev) => [...prev, newVar]);
  };

  /**
   * Updates an environment variable
   */
  /**
   * Update an environment variable
   *
   * @param id - ID of the environment variable
   * @param field - Field to update (key or value)
   * @param value - New value for the field
   */
  const updateEnvVar = (id: string, field: "key" | "value", value: string) => {
    setEnvVars((prev) =>
      prev.map((envVar) => (envVar.id === id ? { ...envVar, [field]: value } : envVar))
    );
  };

  /**
   * Removes an environment variable
   */
  /**
   * Remove an environment variable
   *
   * @param id - ID of the environment variable to remove
   */
  const removeEnvVar = (id: string) => {
    setEnvVars((prev) => prev.filter((envVar) => envVar.id !== id));
  };

  /**
   * Handle Claude installation selection
   */
  const handleClaudeInstallationSelect = (installation: ClaudeInstallation) => {
    setSelectedInstallation(installation);
    setBinaryPathChanged(installation.path !== currentBinaryPath);
  };

  return (
    <div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between p-4 border-b border-border"
        >
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold">{t.settings.title}</h2>
              <p className="text-xs text-muted-foreground">{t.settings.subtitle}</p>
            </div>
          </div>

          <Button
            onClick={saveSettings}
            disabled={saving || loading}
            size="sm"
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.settings.saving}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {t.settings.saveSettings}
              </>
            )}
          </Button>
        </motion.div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-4 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 flex items-center gap-2 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-7 w-full">
                <TabsTrigger value="general">{t.settings.general}</TabsTrigger>
                <TabsTrigger value="permissions">{t.settings.permissions}</TabsTrigger>
                <TabsTrigger value="environment">{t.settings.environment}</TabsTrigger>
                <TabsTrigger value="advanced">{t.settings.advanced}</TabsTrigger>
                <TabsTrigger value="hooks">{t.settings.hooks}</TabsTrigger>
                <TabsTrigger value="commands">{t.settings.commands}</TabsTrigger>
                <TabsTrigger value="storage">{t.settings.storage}</TabsTrigger>
              </TabsList>

              {/* General Settings */}
              <TabsContent value="general" className="space-y-6">
                <Card className="p-6 space-y-6">
                  <div>
                    <h3 className="text-base font-semibold mb-4">{t.settings.generalSettings}</h3>

                    <div className="space-y-4">
                      {/* Include Co-authored By */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5 flex-1">
                          <Label htmlFor="coauthored">{t.settings.includeCoAuthoredBy}</Label>
                          <p className="text-xs text-muted-foreground">
                            {t.settings.includeCoAuthoredByDesc}
                          </p>
                        </div>
                        <Switch
                          id="coauthored"
                          checked={settings?.includeCoAuthoredBy !== false}
                          onCheckedChange={(checked) =>
                            updateSetting("includeCoAuthoredBy", checked)
                          }
                        />
                      </div>

                      {/* Verbose Output */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5 flex-1">
                          <Label htmlFor="verbose">{t.settings.verboseOutput}</Label>
                          <p className="text-xs text-muted-foreground">
                            {t.settings.verboseOutputDesc}
                          </p>
                        </div>
                        <Switch
                          id="verbose"
                          checked={settings?.verbose === true}
                          onCheckedChange={(checked) => updateSetting("verbose", checked)}
                        />
                      </div>

                      {/* Cleanup Period */}
                      <div className="space-y-2">
                        <Label htmlFor="cleanup">{t.settings.chatRetention}</Label>
                        <Input
                          id="cleanup"
                          type="number"
                          min="1"
                          placeholder="30"
                          value={settings?.cleanupPeriodDays?.toString() || ""}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            updateSetting("cleanupPeriodDays", value);
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t.settings.chatRetentionDesc}
                        </p>
                      </div>

                      {/* Claude Binary Path Selector */}
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium mb-2 block">
                            {t.settings.claudeInstallation}
                          </Label>
                          <p className="text-xs text-muted-foreground mb-4">
                            {t.settings.claudeInstallationDesc}
                          </p>
                        </div>
                        <ClaudeVersionSelector
                          selectedPath={currentBinaryPath}
                          onSelect={handleClaudeInstallationSelect}
                        />
                        {binaryPathChanged && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {t.settings.binaryPathChanged}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Permissions Settings */}
              <TabsContent value="permissions" className="space-y-6">
                <Card className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-semibold mb-2">{t.settings.permissionRules}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t.settings.permissionRulesDesc}
                      </p>
                    </div>

                    {/* Allow Rules */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-green-500">
                          {t.settings.allowRules}
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addPermissionRule("allow")}
                          className="gap-2 hover:border-green-500/50 hover:text-green-500"
                        >
                          <Plus className="h-3 w-3" />
                          {t.settings.addRule}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {allowRules.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">
                            {t.settings.noAllowRules}
                          </p>
                        ) : (
                          allowRules.map((rule) => (
                            <motion.div
                              key={rule.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-2"
                            >
                              <Input
                                placeholder="e.g., Bash(npm run test:*)"
                                value={rule.value}
                                onChange={(e) =>
                                  updatePermissionRule("allow", rule.id, e.target.value)
                                }
                                className="flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removePermissionRule("allow", rule.id)}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Deny Rules */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-red-500">
                          {t.settings.denyRules}
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addPermissionRule("deny")}
                          className="gap-2 hover:border-red-500/50 hover:text-red-500"
                        >
                          <Plus className="h-3 w-3" />
                          {t.settings.addRule}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {denyRules.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">
                            {t.settings.noDenyRules}
                          </p>
                        ) : (
                          denyRules.map((rule) => (
                            <motion.div
                              key={rule.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-2"
                            >
                              <Input
                                placeholder="e.g., Bash(curl:*)"
                                value={rule.value}
                                onChange={(e) =>
                                  updatePermissionRule("deny", rule.id, e.target.value)
                                }
                                className="flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removePermissionRule("deny", rule.id)}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        <strong>{t.settings.examples}</strong>
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                        <li>
                          •{" "}
                          <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                            Bash
                          </code>{" "}
                          - {t.settings.allowAllBashCommands}
                        </li>
                        <li>
                          •{" "}
                          <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                            Bash(npm run build)
                          </code>{" "}
                          - {t.settings.allowExactCommand}
                        </li>
                        <li>
                          •{" "}
                          <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                            Bash(npm run test:*)
                          </code>{" "}
                          - {t.settings.allowCommandsWithPrefix}
                        </li>
                        <li>
                          •{" "}
                          <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                            Read(~/.zshrc)
                          </code>{" "}
                          - {t.settings.allowReadingSpecificFile}
                        </li>
                        <li>
                          •{" "}
                          <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                            Edit(docs/**)
                          </code>{" "}
                          - {t.settings.allowEditingFilesInDocsDirectory}
                        </li>
                      </ul>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Environment Variables */}
              <TabsContent value="environment" className="space-y-6">
                <Card className="p-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold">
                          {t.settings.environmentVariables}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t.settings.environmentVariablesDesc}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={addEnvVar} className="gap-2">
                        <Plus className="h-3 w-3" />
                        {t.settings.addVariable}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {envVars.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          {t.settings.noEnvironmentVariables}
                        </p>
                      ) : (
                        envVars.map((envVar) => (
                          <motion.div
                            key={envVar.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2"
                          >
                            <Input
                              placeholder="KEY"
                              value={envVar.key}
                              onChange={(e) => updateEnvVar(envVar.id, "key", e.target.value)}
                              className="flex-1 font-mono text-sm"
                            />
                            <span className="text-muted-foreground">=</span>
                            <Input
                              placeholder="value"
                              value={envVar.value}
                              onChange={(e) => updateEnvVar(envVar.id, "value", e.target.value)}
                              className="flex-1 font-mono text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEnvVar(envVar.id)}
                              className="h-8 w-8 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        ))
                      )}
                    </div>

                    <div className="pt-2 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        <strong>{t.settings.commonVariables}</strong>
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                        <li>
                          •{" "}
                          <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            CLAUDE_CODE_ENABLE_TELEMETRY
                          </code>{" "}
                          - {t.settings.enableDisableTelemetry}
                        </li>
                        <li>
                          •{" "}
                          <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            ANTHROPIC_MODEL
                          </code>{" "}
                          - {t.settings.customModelName}
                        </li>
                        <li>
                          •{" "}
                          <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            DISABLE_COST_WARNINGS
                          </code>{" "}
                          - {t.settings.disableCostWarnings}
                        </li>
                      </ul>
                    </div>
                  </div>
                </Card>
              </TabsContent>
              {/* Advanced Settings */}
              <TabsContent value="advanced" className="space-y-6">
                <Card className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-semibold mb-4">
                        {t.settings.advancedSettings}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        {t.settings.advancedSettingsDesc}
                      </p>
                    </div>

                    {/* API Key Helper */}
                    <div className="space-y-2">
                      <Label htmlFor="apiKeyHelper">{t.settings.apiKeyHelper}</Label>
                      <Input
                        id="apiKeyHelper"
                        placeholder="/path/to/generate_api_key.sh"
                        value={settings?.apiKeyHelper?.toString() || ""}
                        onChange={(e) => updateSetting("apiKeyHelper", e.target.value || undefined)}
                      />
                      <p className="text-xs text-muted-foreground">{t.settings.apiKeyHelperDesc}</p>
                    </div>

                    {/* Raw JSON Editor */}
                    <div className="space-y-2">
                      <Label>{t.settings.rawSettings}</Label>
                      <div className="p-3 rounded-md bg-muted font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                        <pre>{JSON.stringify(settings, null, 2)}</pre>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.settings.rawSettingsDesc}</p>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Hooks Settings */}
              <TabsContent value="hooks" className="space-y-6">
                <Card className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold mb-2">{t.settings.userHooks}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t.settings.userHooksDesc}
                      </p>
                    </div>

                    <HooksEditor
                      key={activeTab}
                      scope="user"
                      className="border-0"
                      hideActions={true}
                      onChange={(hasChanges, getHooks) => {
                        setUserHooksChanged(hasChanges);
                        getUserHooks.current = getHooks;
                      }}
                    />
                  </div>
                </Card>
              </TabsContent>

              {/* Commands Tab */}
              <TabsContent value="commands">
                <Card className="p-6">
                  <SlashCommandsManager className="p-0" />
                </Card>
              </TabsContent>

              {/* Storage Tab */}
              <TabsContent value="storage">
                <StorageTab />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
        )}
      </ToastContainer>
    </div>
  );
};
