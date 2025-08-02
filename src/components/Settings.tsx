import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Loader2,
  BarChart3,
  Shield,
  Trash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  api,
  type ClaudeSettings,
  type ClaudeInstallation
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { ClaudeVersionSelector } from "./ClaudeVersionSelector";
import { StorageTab } from "./StorageTab";
import { HooksEditor } from "./HooksEditor";
import { SlashCommandsManager } from "./SlashCommandsManager";
import { ProxySettings } from "./ProxySettings";
import { AnalyticsConsent } from "./AnalyticsConsent";
import { useTheme, useTrackEvent } from "@/hooks";
import { analytics } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { handleError, handleApiError } from "@/lib/errorHandler";
import {
  audioNotificationManager,
  loadAudioConfigFromLocalStorage,
  saveAudioConfigToLocalStorage,
  loadAudioConfigFromSettings,
  type AudioNotificationConfig,
  type AudioNotificationMode
} from "@/lib/audioNotification";
import { fontScaleManager, FONT_SCALE_OPTIONS, type FontScale } from "@/lib/fontScale";
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

  // Audio notification state
  const [audioConfig, setAudioConfig] = useState<AudioNotificationConfig>({ mode: "off" });
  const [audioConfigChanged, setAudioConfigChanged] = useState(false);

  // Font scale state
  const [fontScale, setFontScale] = useState<FontScale>(fontScaleManager.getCurrentScale());
  const [customMultiplierInput, setCustomMultiplierInput] = useState<string>(fontScaleManager.getCustomMultiplier().toString());
  const [fontScaleChanged, setFontScaleChanged] = useState(false);

  const getUserHooks = React.useRef<(() => unknown) | null>(null);

  // Theme hook
  const { theme, setTheme, customColors, setCustomColors } = useTheme();

  // Proxy state
  const [proxySettingsChanged, setProxySettingsChanged] = useState(false);
  const saveProxySettings = React.useRef<(() => Promise<void>) | null>(null);

  // Analytics state
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [analyticsConsented, setAnalyticsConsented] = useState(false);
  const [showAnalyticsConsent, setShowAnalyticsConsent] = useState(false);
  const trackEvent = useTrackEvent();
  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadClaudeBinaryPath();
    loadAnalyticsSettings();
  }, []);

  /**
   * Loads analytics settings
   */
  const loadAnalyticsSettings = async () => {
    const settings = analytics.getSettings();
    if (settings) {
      setAnalyticsEnabled(settings.enabled);
      setAnalyticsConsented(settings.hasConsented);
    }
  };

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

      // Load audio notification config from localStorage (independent of Claude settings)
      try {
        // First try to migrate from old Claude settings if exists
        const legacyConfig = loadAudioConfigFromSettings(loadedSettings);
        if (legacyConfig.mode !== "off") {
          // Migrate to localStorage and remove from Claude settings
          saveAudioConfigToLocalStorage(legacyConfig);
          logger.debug("Migrated audio config from Claude settings to localStorage");
        }

        // Load from localStorage
        const audioConfig = loadAudioConfigFromLocalStorage();
        setAudioConfig(audioConfig);
        audioNotificationManager.setConfig(audioConfig);
        logger.debug("Audio config loaded from localStorage:", audioConfig);
      } catch (error) {
        logger.error("Failed to load audio config, using defaults:", error);
        const defaultConfig: AudioNotificationConfig = { mode: "off" };
        setAudioConfig(defaultConfig);
        audioNotificationManager.setConfig(defaultConfig);
      }

      // Load font scale
      setFontScale(fontScaleManager.getCurrentScale());
      setCustomMultiplierInput(fontScaleManager.getCustomMultiplier().toString());
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
          allow: allowRules.map(rule => rule.value).filter(v => v && String(v).trim()),
          deny: denyRules.map(rule => rule.value).filter(v => v && String(v).trim()),
        },
        env: envVars.reduce((acc, { key, value }) => {
          if (key && String(key).trim() && value && String(value).trim()) {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>),
      };

      // Save audio notification config to localStorage (independent of Claude settings)
      if (audioConfigChanged) {
        try {
          saveAudioConfigToLocalStorage(audioConfig);
          audioNotificationManager.setConfig(audioConfig);
          setAudioConfigChanged(false);
          logger.debug("Audio config saved successfully to localStorage");
        } catch (error) {
          logger.error("Failed to save audio config:", error);
        }
      }

      // Save font scale (independent of Claude settings)
      if (fontScaleChanged) {
        if (fontScale === 'custom') {
          const customValue = parseFloat(customMultiplierInput);
          if (!isNaN(customValue) && customValue >= 0.5 && customValue <= 3.0) {
            fontScaleManager.setScale(fontScale, customValue);
          } else {
            fontScaleManager.setScale(fontScale);
          }
        } else {
          fontScaleManager.setScale(fontScale);
        }
        setFontScaleChanged(false);
      }

      await api.saveClaudeSettings(updatedSettings);
      setSettings(updatedSettings);

      // Save Claude binary path if changed
      if (binaryPathChanged && selectedInstallation) {
        await api.setClaudeBinaryPath(selectedInstallation.path);
        // Immediately refresh the binary path cache so the new version is used right away
        try {
          const refreshedPath = await api.refreshClaudeBinaryPath();
          logger.info("Claude binary path refreshed successfully:", refreshedPath);
          // Update the current binary path immediately to reflect the change
          setCurrentBinaryPath(selectedInstallation.path);
          // Notify the Topbar to refresh the Claude version status
          window.dispatchEvent(new CustomEvent("claude-version-changed"));
        } catch (refreshError) {
          logger.warn("Failed to refresh Claude binary path cache:", refreshError);
          // Still update the UI with the selected path even if refresh fails
          setCurrentBinaryPath(selectedInstallation.path);
          // Still notify the Topbar even if refresh fails, as the path has changed
          window.dispatchEvent(new CustomEvent("claude-version-changed"));
        }
        setBinaryPathChanged(false);
      }

      // Save user hooks if changed
      if (userHooksChanged && getUserHooks.current) {
        const hooks = getUserHooks.current();
        await api.updateHooksConfig("user", hooks as Record<string, unknown>);
        setUserHooksChanged(false);
      }

      // Save proxy settings if changed
      if (proxySettingsChanged && saveProxySettings.current) {
        await saveProxySettings.current();
        setProxySettingsChanged(false);
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
              <TabsList className="grid grid-cols-9 w-full">
                <TabsTrigger value="general">{t.settings.general}</TabsTrigger>
                <TabsTrigger value="permissions">{t.settings.permissions}</TabsTrigger>
                <TabsTrigger value="environment">{t.settings.environment}</TabsTrigger>
                <TabsTrigger value="advanced">{t.settings.advanced}</TabsTrigger>
                <TabsTrigger value="hooks">{t.settings.hooks}</TabsTrigger>
                <TabsTrigger value="commands">{t.settings.commands}</TabsTrigger>
                <TabsTrigger value="storage">{t.settings.storage}</TabsTrigger>
                <TabsTrigger value="proxy">{t.proxy.title}</TabsTrigger>
                <TabsTrigger value="analytics">{t.analytics.title}</TabsTrigger>
              </TabsList>

              {/* General Settings */}
              <TabsContent value="general" className="space-y-6">
                <Card className="p-6">
                  <div className="space-y-6">
                    <h3 className="text-base font-semibold mb-4">{t.settings.generalSettings}</h3>

                    <div className="space-y-4">
                      {/* Theme Selector */}
                      <div className="space-y-2">
                        <Label htmlFor="theme">Theme</Label>
                        <Select
                          value={theme}
                          onValueChange={(value) => setTheme(value as any)}
                        >
                          <SelectTrigger id="theme" className="w-full">
                            <SelectValue placeholder="Select a theme" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="gray">Gray</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Choose your preferred color theme for the interface
                        </p>
                      </div>

                      {/* Custom Color Editor */}
                      {theme === 'custom' && (
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                          <h4 className="text-sm font-medium">Custom Theme Colors</h4>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Background Color */}
                            <div className="space-y-2">
                              <Label htmlFor="color-background" className="text-xs">Background</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="color-background"
                                  type="text"
                                  value={customColors.background}
                                  onChange={(e) => setCustomColors({ background: e.target.value })}
                                  placeholder="oklch(0.12 0.01 240)"
                                  className="font-mono text-xs"
                                />
                                <div
                                  className="w-10 h-10 rounded border"
                                  style={{ backgroundColor: customColors.background }}
                                />
                              </div>
                            </div>

                            {/* Foreground Color */}
                            <div className="space-y-2">
                              <Label htmlFor="color-foreground" className="text-xs">Foreground</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="color-foreground"
                                  type="text"
                                  value={customColors.foreground}
                                  onChange={(e) => setCustomColors({ foreground: e.target.value })}
                                  placeholder="oklch(0.98 0.01 240)"
                                  className="font-mono text-xs"
                                />
                                <div
                                  className="w-10 h-10 rounded border"
                                  style={{ backgroundColor: customColors.foreground }}
                                />
                              </div>
                            </div>

                            {/* Primary Color */}
                            <div className="space-y-2">
                              <Label htmlFor="color-primary" className="text-xs">Primary</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="color-primary"
                                  type="text"
                                  value={customColors.primary}
                                  onChange={(e) => setCustomColors({ primary: e.target.value })}
                                  placeholder="oklch(0.98 0.01 240)"
                                  className="font-mono text-xs"
                                />
                                <div
                                  className="w-10 h-10 rounded border"
                                  style={{ backgroundColor: customColors.primary }}
                                />
                              </div>
                            </div>

                            {/* Card Color */}
                            <div className="space-y-2">
                              <Label htmlFor="color-card" className="text-xs">Card</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="color-card"
                                  type="text"
                                  value={customColors.card}
                                  onChange={(e) => setCustomColors({ card: e.target.value })}
                                  placeholder="oklch(0.14 0.01 240)"
                                  className="font-mono text-xs"
                                />
                                <div
                                  className="w-10 h-10 rounded border"
                                  style={{ backgroundColor: customColors.card }}
                                />
                              </div>
                            </div>

                            {/* Accent Color */}
                            <div className="space-y-2">
                              <Label htmlFor="color-accent" className="text-xs">Accent</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="color-accent"
                                  type="text"
                                  value={customColors.accent}
                                  onChange={(e) => setCustomColors({ accent: e.target.value })}
                                  placeholder="oklch(0.16 0.01 240)"
                                  className="font-mono text-xs"
                                />
                                <div
                                  className="w-10 h-10 rounded border"
                                  style={{ backgroundColor: customColors.accent }}
                                />
                              </div>
                            </div>

                            {/* Destructive Color */}
                            <div className="space-y-2">
                              <Label htmlFor="color-destructive" className="text-xs">Destructive</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="color-destructive"
                                  type="text"
                                  value={customColors.destructive}
                                  onChange={(e) => setCustomColors({ destructive: e.target.value })}
                                  placeholder="oklch(0.6 0.2 25)"
                                  className="font-mono text-xs"
                                />
                                <div
                                  className="w-10 h-10 rounded border"
                                  style={{ backgroundColor: customColors.destructive }}
                                />
                              </div>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Use CSS color values (hex, rgb, oklch, etc.). Changes apply immediately.
                          </p>
                        </div>
                      )}

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
                        {currentBinaryPath && !binaryPathChanged && (
                          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            {t.settings.claudeInstallationSelected || "Claude installation selected"}
                          </p>
                        )}
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

                    {/* Claude Code Installation */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">
                          {t.settings.claudeInstallation}
                        </Label>
                        <p className="text-xs text-muted-foreground mb-4">
                          {t.settings.claudeInstallationDesc}
                        </p>
                      </div>
                      {binaryPathChanged && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {t.settings.binaryPathChanged}
                        </p>
                      )}
                    </div>

                    {/* Font Scale */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">{t.settings.fontScale}</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.settings.fontScaleDesc}
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="fontScale" className="text-sm">
                            {t.settings.fontScale}
                          </Label>
                          <div className="space-y-2 mt-2">
                            {Object.entries(FONT_SCALE_OPTIONS).map(([key, config]) => (
                              <div key={key} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  id={`font-${key}`}
                                  name="fontScale"
                                  value={key}
                                  checked={fontScale === key}
                                  onChange={(e) => {
                                    const newScale = e.target.value as FontScale;
                                    setFontScale(newScale);
                                    setFontScaleChanged(true);
                                  }}
                                  className="w-4 h-4 text-primary bg-background border-border focus:ring-ring focus:ring-2"
                                />
                                <div className="flex-1">
                                  <Label htmlFor={`font-${key}`} className="text-sm font-medium">
                                    {t.settings[`fontScale${key.charAt(0).toUpperCase() + key.slice(1).replace('-', '')}` as keyof typeof t.settings]}
                                    {key !== 'custom' && ` (${config.multiplier}x)`}
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    {t.settings[`fontScale${key.charAt(0).toUpperCase() + key.slice(1).replace('-', '')}Desc` as keyof typeof t.settings]}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Custom multiplier input */}
                          {fontScale === 'custom' && (
                            <div className="mt-4 p-4 border rounded-md bg-muted/50">
                              <Label htmlFor="customMultiplier" className="text-sm font-medium">
                                {t.settings.customMultiplier}
                              </Label>
                              <p className="text-xs text-muted-foreground mb-2">
                                {t.settings.customMultiplierDesc}
                              </p>
                              <div className="flex items-center space-x-2">
                                <Input
                                  id="customMultiplier"
                                  type="number"
                                  min="0.5"
                                  max="3.0"
                                  step="0.1"
                                  value={customMultiplierInput}
                                  onChange={(e) => {
                                    setCustomMultiplierInput(e.target.value);
                                    setFontScaleChanged(true);
                                  }}
                                  placeholder={t.settings.customMultiplierPlaceholder}
                                  className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">x</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t.settings.customMultiplierRange}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Audio Notifications */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">{t.settings.audioNotifications}</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.settings.audioNotificationsDesc}
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="audioMode" className="text-sm">
                            {t.settings.audioNotificationMode}
                          </Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            {t.settings.audioNotificationModeDesc}
                          </p>
                          <div className="space-y-2">
                            {[
                              { value: "off", label: t.settings.audioModeOff, desc: t.settings.audioModeOffDesc },
                              { value: "on_message", label: t.settings.audioModeOnMessage, desc: t.settings.audioModeOnMessageDesc },
                              { value: "on_queue", label: t.settings.audioModeOnQueue, desc: t.settings.audioModeOnQueueDesc },
                            ].map((option) => (
                              <div key={option.value} className="flex items-start space-x-3">
                                <input
                                  type="radio"
                                  id={`audio-${option.value}`}
                                  name="audioMode"
                                  value={option.value}
                                  checked={audioConfig.mode === option.value}
                                  onChange={(e) => {
                                    setAudioConfig({ mode: e.target.value as AudioNotificationMode });
                                    setAudioConfigChanged(true);
                                  }}
                                  className="mt-1"
                                />
                                <div className="flex-1">
                                  <Label htmlFor={`audio-${option.value}`} className="text-sm font-medium">
                                    {option.label}
                                  </Label>
                                  <p className="text-xs text-muted-foreground">{option.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2">
                          <Label className="text-sm">{t.settings.testAudio}</Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            {t.settings.testAudioDesc}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await audioNotificationManager.testNotification();
                              } catch (error) {
                                logger.error("Failed to test audio notification:", error);
                              }
                            }}
                            className="gap-2"
                          >
                            🔊 {t.settings.playTestSound}
                          </Button>
                        </div>
                      </div>
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

              {/* Proxy Settings */}
              <TabsContent value="proxy">
                <Card className="p-6">
                  <ProxySettings
                    setToast={setToast}
                    onChange={(hasChanges, _getSettings, save) => {
                      setProxySettingsChanged(hasChanges);
                      saveProxySettings.current = save;
                    }}
                  />
                </Card>
              </TabsContent>

              {/* Analytics Settings */}
              <TabsContent value="analytics" className="space-y-6">
                <Card className="p-6 space-y-6">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h3 className="text-base font-semibold">{t.analytics.analyticsSettings}</h3>
                    </div>

                    <div className="space-y-6">
                      {/* Analytics Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="analytics-enabled" className="text-base">{t.analytics.enableAnalytics}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t.analytics.helpImprove}
                          </p>
                        </div>
                        <Switch
                          id="analytics-enabled"
                          checked={analyticsEnabled}
                          onCheckedChange={async (checked) => {
                            if (checked && !analyticsConsented) {
                              setShowAnalyticsConsent(true);
                            } else if (checked) {
                              await analytics.enable();
                              setAnalyticsEnabled(true);
                              trackEvent.settingsChanged('analytics_enabled', true);
                              setToast({ message: t.analytics.analyticsEnabled, type: "success" });
                            } else {
                              await analytics.disable();
                              setAnalyticsEnabled(false);
                              trackEvent.settingsChanged('analytics_enabled', false);
                              setToast({ message: t.analytics.analyticsDisabled, type: "success" });
                            }
                          }}
                        />
                      </div>

                      {/* Privacy Info */}
                      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4">
                        <div className="flex gap-3">
                          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                          <div className="space-y-2">
                            <p className="font-medium text-blue-900 dark:text-blue-100">{t.analytics.privacyProtected}</p>
                            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                              <li>• {t.analytics.noPersonalInfo}</li>
                              <li>• {t.analytics.noFileContents}</li>
                              <li>• {t.analytics.anonymousIds}</li>
                              <li>• {t.analytics.optOutAnytime}</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Data Collection Info */}
                      {analyticsEnabled && (
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium mb-2">{t.analytics.whatWeCollect}</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              <li>• {t.analytics.featureUsage}</li>
                              <li>• {t.analytics.performanceMetrics}</li>
                              <li>• {t.analytics.errorReports}</li>
                              <li>• {t.analytics.usagePatterns}</li>
                            </ul>
                          </div>

                          {/* Delete Data Button */}
                          <div className="pt-4 border-t">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                await analytics.deleteAllData();
                                setAnalyticsEnabled(false);
                                setAnalyticsConsented(false);
                                setToast({ message: t.analytics.allDataDeleted, type: "success" });
                              }}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              {t.analytics.deleteAllData}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
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

      {/* Analytics Consent Dialog */}
      <AnalyticsConsent
        open={showAnalyticsConsent}
        onOpenChange={setShowAnalyticsConsent}
        onComplete={async () => {
          await loadAnalyticsSettings();
          setShowAnalyticsConsent(false);
        }}
      />
    </div>
  );
};
