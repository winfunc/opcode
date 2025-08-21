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
  type ClaudeInstallation,
  type EnvironmentVariable as DbEnvironmentVariable,
  type EnvironmentVariableGroup
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

  // Environment variables state (now using database)
  const [envVars, setEnvVars] = useState<DbEnvironmentVariable[]>([]);
  const [envGroups, setEnvGroups] = useState<EnvironmentVariableGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [showAddGroup, setShowAddGroup] = useState<boolean>(false);

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
    console.log("Settings component mounted, loading settings...");
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
      console.log("loadSettings function called");
      setLoading(true);
      setError(null);
      const loadedSettings = await api.getClaudeSettings();
      console.log("Claude settings loaded:", loadedSettings);

      // Ensure loadedSettings is an object
      if (!loadedSettings || typeof loadedSettings !== "object") {
        logger.warn("Loaded settings is not an object:", loadedSettings);
        setSettings({});
        return;
      }

      setSettings(loadedSettings);

      // Debug log the loaded settings structure
      logger.debug("Loaded Claude settings:", {
        hasEnv: !!loadedSettings.env,
        envType: typeof loadedSettings.env,
        envKeys: loadedSettings.env ? Object.keys(loadedSettings.env) : [],
        envLength: loadedSettings.env ? Object.keys(loadedSettings.env).length : 0
      });

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

      // Load environment variables from database
      try {
        console.log("Loading environment variables from database...");
        const dbEnvVars = await api.getEnvironmentVariables();
        console.log(`Loaded ${dbEnvVars.length} environment variables from database:`, dbEnvVars);
        logger.debug(`Loaded ${dbEnvVars.length} environment variables from database`);
        
        // 从 Claude 设置中迁移所有环境变量到数据库（不再只迁移特定的三个）
        
        if (loadedSettings.env && 
            typeof loadedSettings.env === "object" && 
            !Array.isArray(loadedSettings.env)) {
          
          // 从 Claude 设置中的 env 对象迁移所有键值对
          const envToMigrate = Object.entries(loadedSettings.env as Record<string, unknown>)
            .map(([key, value]) => ({
              key,
              value: String(value ?? ""),
              enabled: true,
              sort_order: 0,
              group_id: undefined,
            }));
          
          if (envToMigrate.length > 0) {
            logger.debug(`Found ${envToMigrate.length} environment variables in Claude settings for migration: ${envToMigrate.map(v => v.key).join(', ')}`);
            
            // Merge with existing database variables, with Claude settings taking precedence for conflicts
            const existingKeys = new Set(dbEnvVars.map(v => v.key));
            const newVars = envToMigrate.filter(v => !existingKeys.has(v.key));
            const allVars = [...dbEnvVars, ...newVars];
            
            // Update any existing variables with values from Claude settings
            const finalVars = allVars.map(dbVar => {
              const claudeVar = envToMigrate.find(mv => mv.key === dbVar.key);
              return claudeVar ? { 
                ...dbVar, 
                value: claudeVar.value,
                enabled: dbVar.enabled ?? true, // Ensure enabled field exists
                group_id: (dbVar as DbEnvironmentVariable).group_id ?? undefined,
                sort_order: dbVar.sort_order ?? 0,
              } : {
                ...dbVar,
                enabled: dbVar.enabled ?? true, // Ensure enabled field exists
                group_id: (dbVar as DbEnvironmentVariable).group_id ?? undefined,
                sort_order: dbVar.sort_order ?? 0,
              };
            });
            
            await api.saveEnvironmentVariables(finalVars);
            logger.info(`Migrated ${envToMigrate.length} environment variables from Claude settings to database: ${envToMigrate.map(v => v.key).join(', ')}`);
            
            // Do not remove env from Claude settings - keep other environment variables intact
            setEnvVars(finalVars);
          } else {
            logger.debug("No environment variables found in Claude settings for migration");
            // Ensure all variables have the required fields with defaults
            const normalizedVars = dbEnvVars.map(envVar => ({
              ...envVar,
              enabled: envVar.enabled ?? true,
              group_id: envVar.group_id ?? undefined,
              sort_order: envVar.sort_order ?? 0,
            }));
            setEnvVars(normalizedVars);
          }
        } else {
          logger.debug("No environment variables found in Claude settings, using database variables only");
          // Ensure all variables have the required fields with defaults
          const normalizedVars = dbEnvVars.map(envVar => ({
            ...envVar,
            enabled: envVar.enabled ?? true,
            group_id: envVar.group_id ?? undefined,
            sort_order: envVar.sort_order ?? 0,
          }));
          setEnvVars(normalizedVars);
        }

        // Load environment variable groups
        try {
          const groups = await api.getEnvironmentVariableGroups();
          setEnvGroups(groups);
          logger.debug(`Loaded ${groups.length} environment variable groups`);
        } catch (error) {
          logger.error("Failed to load environment variable groups:", error);
          setEnvGroups([]);
        }
      } catch (error) {
        logger.error("Failed to load environment variables from database:", error);
        // Fallback to Claude settings if database fails
        if (
          loadedSettings.env &&
          typeof loadedSettings.env === "object" &&
          !Array.isArray(loadedSettings.env)
        ) {
          setEnvVars(
            Object.entries(loadedSettings.env).map(([key, value]) => ({
              key,
              value: value as string,
              enabled: true,
              group_id: undefined,
              sort_order: 0,
            }))
          );
        }
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

      // Build the settings object (no longer includes env - it's in database)
      const updatedSettings: ClaudeSettings = {
        ...settings,
        permissions: {
          allow: allowRules.map(rule => rule.value).filter(v => v && String(v).trim()),
          deny: denyRules.map(rule => rule.value).filter(v => v && String(v).trim()),
        },
      };
      
      // Keep env field in Claude settings - do not remove it
      // Environment variables are now managed through database but we preserve the original settings

      // Save environment variables to database separately
      try {
        const filteredEnvVars = envVars.filter(({ key, value }) => 
          key && String(key).trim() && value && String(value).trim()
        );
        
        // Validate for duplicate keys within the same group
        const keyGroupMap = new Map<string, Set<number | undefined>>();
        const duplicates: string[] = [];
        
        filteredEnvVars.forEach((envVar) => {
          const key = envVar.key.trim();
          const groupId = envVar.group_id;
          
          if (!keyGroupMap.has(key)) {
            keyGroupMap.set(key, new Set());
          }
          
          const groupsForKey = keyGroupMap.get(key)!;
          if (groupsForKey.has(groupId)) {
            duplicates.push(`"${key}" in group ${groupId || 'ungrouped'}`);
          } else {
            groupsForKey.add(groupId);
          }
        });
        
        if (duplicates.length > 0) {
          const errorMessage = `Duplicate environment variable keys found: ${duplicates.join(', ')}. Each key can only appear once per group.`;
          logger.error(errorMessage);
          setToast({ message: errorMessage, type: "error" });
          throw new Error(errorMessage);
        }
        
        // Deduplicate variables with same key in same group (keep the last one)
        const deduplicatedVars = new Map<string, DbEnvironmentVariable>();
        filteredEnvVars.forEach((envVar) => {
          const uniqueKey = `${envVar.group_id || 0}-${envVar.key.trim()}`;
          deduplicatedVars.set(uniqueKey, envVar);
        });
        
        const finalVars = Array.from(deduplicatedVars.values());
        logger.debug(`Saving ${finalVars.length} environment variables (deduplicated from ${filteredEnvVars.length})`);
        
        await api.saveEnvironmentVariables(finalVars);
        logger.debug("Environment variables saved to database successfully");
      } catch (error) {
        logger.error("Failed to save environment variables to database:", error);
        if (error instanceof Error && error.message.includes("Duplicate environment variable keys")) {
          // Don't wrap the error message if it's already our validation error
          throw error;
        }
        throw new Error("Failed to save environment variables");
      }

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
  const addEnvVar = (groupId?: number) => {
    const newVar: DbEnvironmentVariable = {
      key: "",
      value: "",
      enabled: true,
      group_id: groupId,
      sort_order: 0,
    };
    setEnvVars((prev) => [...prev, newVar]);
  };

  /**
   * Add a new environment variable group
   */
  const addEnvGroup = async () => {
    if (!newGroupName.trim()) return;
    
    try {
      const newGroup = await api.createEnvironmentVariableGroup(
        newGroupName.trim(),
        undefined,
        envGroups.length
      );
      setEnvGroups([...envGroups, newGroup]);
      setNewGroupName("");
      setShowAddGroup(false);
      logger.info(`Created new environment variable group: ${newGroup.name}`);
    } catch (error) {
      logger.error("Failed to create environment variable group:", error);
      setToast({ message: "Failed to create group", type: "error" });
    }
  };

  /**
   * Toggle environment variable group enabled state
   */
  const toggleGroupEnabled = async (groupId: number, enabled: boolean) => {
    try {
      const group = envGroups.find(g => g.id === groupId);
      if (!group) return;

      // 如果启用当前组，需要检查并禁用有冲突键的其他组
      if (enabled) {
        const currentGroupVars = envVars.filter(v => v.group_id === groupId);
        const currentGroupKeys = new Set(currentGroupVars.map(v => v.key.trim()).filter(key => key));
        
        // 检查其他启用的组是否有冲突键
        const conflictingGroups = envGroups.filter(g => 
          g.id !== groupId && g.enabled && 
          envVars.some(v => v.group_id === g.id && currentGroupKeys.has(v.key.trim()))
        );
        
        // 检查未分组变量是否有冲突键
        const ungroupedVars = envVars.filter(v => !v.group_id);
        const hasUngroupedConflict = ungroupedVars.some(v => currentGroupKeys.has(v.key.trim()));
        
        // 禁用冲突的分组
        for (const conflictGroup of conflictingGroups) {
          await api.updateEnvironmentVariableGroup(
            conflictGroup.id!,
            conflictGroup.name,
            conflictGroup.description,
            false, // 禁用冲突组
            conflictGroup.sort_order
          );
        }
        
        // 如果有未分组变量冲突，禁用冲突的未分组变量
        if (hasUngroupedConflict) {
          const updatedVars = envVars.map(v => {
            if (!v.group_id && currentGroupKeys.has(v.key.trim())) {
              return { ...v, enabled: false };
            }
            return v;
          });
          setEnvVars(updatedVars);
          
          // 更新数据库中的所有环境变量
          await api.saveEnvironmentVariables(updatedVars);
        }
        
        // 更新组状态
        setEnvGroups(groups => 
          groups.map(g => {
            if (g.id === groupId) return { ...g, enabled: true };
            if (conflictingGroups.some(cg => cg.id === g.id)) return { ...g, enabled: false };
            return g;
          })
        );
      }

      // 更新当前组
      const updatedGroup = await api.updateEnvironmentVariableGroup(
        groupId,
        group.name,
        group.description,
        enabled,
        group.sort_order
      );
      
      if (!enabled) {
        setEnvGroups(groups => 
          groups.map(g => g.id === groupId ? updatedGroup : g)
        );
      }
      
      logger.info(`Toggled group ${group.name} to ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error("Failed to toggle group enabled state:", error);
      setToast({ message: "Failed to update group", type: "error" });
    }
  };

  /**
   * Delete environment variable group
   */
  const deleteEnvGroup = async (groupId: number) => {
    try {
      await api.deleteEnvironmentVariableGroup(groupId);
      setEnvGroups(groups => groups.filter(g => g.id !== groupId));
      // Move variables from deleted group to ungrouped (null group_id)
      setEnvVars(vars => 
        vars.map(v => v.group_id === groupId ? { ...v, group_id: undefined } : v)
      );
      logger.info(`Deleted environment variable group with ID: ${groupId}`);
    } catch (error) {
      logger.error("Failed to delete environment variable group:", error);
      setToast({ message: "Failed to delete group", type: "error" });
    }
  };

  /**
   * Updates an environment variable
   */
  /**
   * Check if an environment variable key is duplicated within the same group
   */
  const isDuplicateKey = (currentIndex: number, key: string, groupId?: number) => {
    if (!key.trim()) return false;
    
    return envVars.some((envVar, index) => 
      index !== currentIndex && 
      envVar.key.trim() === key.trim() && 
      envVar.group_id === groupId
    );
  };

  /**
   * Update an environment variable
   *
   * @param index - Index of the environment variable in the array
   * @param field - Field to update (key, value, or enabled)
   * @param value - New value for the field
   */
  const updateEnvVar = async (index: number, field: "key" | "value" | "enabled", value: string | boolean) => {
    // 如果是启用未分组变量，需要检查冲突
    if (field === "enabled" && value === true) {
      const envVar = envVars[index];
      if (!envVar.group_id && envVar.key.trim()) {
        await handleUngroupedVariableToggle(envVar.key.trim(), true);
      }
    }
    
    const updatedVars = envVars.map((envVar, i) => 
      i === index ? { ...envVar, [field]: value } : envVar
    );
    
    setEnvVars(updatedVars);
    
    // 批量保存所有环境变量到数据库
    try {
      await api.saveEnvironmentVariables(updatedVars);
    } catch (error) {
      logger.error("Failed to save environment variable:", error);
      setToast({ message: "Failed to save environment variable", type: "error" });
    }
  };

  /**
   * 处理未分组变量的启用/禁用，实现与分组变量的互斥
   */
  const handleUngroupedVariableToggle = async (key: string, enabled: boolean) => {
    if (!enabled) return;

    try {
      // 查找有相同键的启用分组
      const conflictingGroups = envGroups.filter(g => 
        g.enabled && 
        envVars.some(v => v.group_id === g.id && v.key.trim() === key)
      );

      // 禁用冲突的分组
      for (const conflictGroup of conflictingGroups) {
        await api.updateEnvironmentVariableGroup(
          conflictGroup.id!,
          conflictGroup.name,
          conflictGroup.description,
          false,
          conflictGroup.sort_order
        );
      }

      // 更新组状态
      if (conflictingGroups.length > 0) {
        setEnvGroups(groups => 
          groups.map(g => {
            if (conflictingGroups.some(cg => cg.id === g.id)) {
              return { ...g, enabled: false };
            }
            return g;
          })
        );
      }

      logger.info(`Enabled ungrouped variable ${key}, disabled ${conflictingGroups.length} conflicting groups`);
    } catch (error) {
      logger.error("Failed to handle ungrouped variable toggle:", error);
    }
  };

  /**
   * 切换未分组变量的整体启用状态
   */
  const toggleUngroupedEnabled = async (enabled: boolean) => {
    try {
      const ungroupedVars = envVars.filter(v => !v.group_id);
      
      if (enabled) {
        // 启用未分组变量时，需要检查并禁用有冲突键的分组
        const ungroupedKeys = new Set(ungroupedVars.map(v => v.key.trim()).filter(key => key));
        
        const conflictingGroups = envGroups.filter(g => 
          g.enabled && 
          envVars.some(v => v.group_id === g.id && ungroupedKeys.has(v.key.trim()))
        );

        // 禁用冲突的分组
        for (const conflictGroup of conflictingGroups) {
          await api.updateEnvironmentVariableGroup(
            conflictGroup.id!,
            conflictGroup.name,
            conflictGroup.description,
            false,
            conflictGroup.sort_order
          );
        }

        // 更新组状态
        if (conflictingGroups.length > 0) {
          setEnvGroups(groups => 
            groups.map(g => {
              if (conflictingGroups.some(cg => cg.id === g.id)) {
                return { ...g, enabled: false };
              }
              return g;
            })
          );
        }

        // 启用所有未分组变量
        const updatedVars = envVars.map(v => {
          if (!v.group_id) {
            return { ...v, enabled: true };
          }
          return v;
        });
        setEnvVars(updatedVars);

        // 更新数据库
        await api.saveEnvironmentVariables(updatedVars);

        logger.info(`Enabled ungrouped variables, disabled ${conflictingGroups.length} conflicting groups`);
      } else {
        // 禁用所有未分组变量
        const updatedVars = envVars.map(v => {
          if (!v.group_id) {
            return { ...v, enabled: false };
          }
          return v;
        });
        setEnvVars(updatedVars);

        // 更新数据库
        await api.saveEnvironmentVariables(updatedVars);

        logger.info("Disabled all ungrouped variables");
      }
    } catch (error) {
      logger.error("Failed to toggle ungrouped variables:", error);
      setToast({ message: "Failed to update ungrouped variables", type: "error" });
    }
  };

  /**
   * Removes an environment variable
   */
  /**
   * Remove an environment variable
   *
   * @param index - Index of the environment variable to remove
   */
  const removeEnvVar = (index: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
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
                        <Label htmlFor="theme">{t.settings.theme}</Label>
                        <Select
                          value={theme}
                          onValueChange={(value) => setTheme(value as any)}
                        >
                          <SelectTrigger id="theme" className="w-full">
                            <SelectValue placeholder={t.settings.selectTheme} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dark">{t.settings.themeDark}</SelectItem>
                            <SelectItem value="gray">{t.settings.themeGray}</SelectItem>
                            <SelectItem value="light">{t.settings.themeLight}</SelectItem>
                            <SelectItem value="custom">{t.settings.themeCustom}</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {t.settings.themeDesc}
                        </p>
                      </div>

                      {/* Custom Color Editor */}
                      {theme === 'custom' && (
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                          <h4 className="text-sm font-medium">{t.settings.customThemeColors}</h4>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Background Color */}
                            <div className="space-y-2">
                              <Label htmlFor="color-background" className="text-xs">{t.settings.colorBackground}</Label>
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
                              <Label htmlFor="color-foreground" className="text-xs">{t.settings.colorForeground}</Label>
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
                              <Label htmlFor="color-primary" className="text-xs">{t.settings.colorPrimary}</Label>
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
                              <Label htmlFor="color-card" className="text-xs">{t.settings.colorCard}</Label>
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
                              <Label htmlFor="color-accent" className="text-xs">{t.settings.colorAccent}</Label>
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
                              <Label htmlFor="color-destructive" className="text-xs">{t.settings.colorDestructive}</Label>
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
                            {t.settings.cssColorValuesDesc}
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
                            {t.settings.claudeInstallation || "Claude installation selected"}
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
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShowAddGroup(!showAddGroup)} 
                          className="gap-2"
                        >
                          <Plus className="h-3 w-3" />
                          {t.settings.addGroup}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => addEnvVar()} className="gap-2">
                          <Plus className="h-3 w-3" />
                          {t.settings.addVariable}
                        </Button>
                      </div>
                    </div>

                    {/* Add Group Form */}
                    {showAddGroup && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
                      >
                        <Input
                          placeholder="Group name"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') addEnvGroup();
                            if (e.key === 'Escape') setShowAddGroup(false);
                          }}
                        />
                        <Button variant="default" size="sm" onClick={addEnvGroup}>
                          Create
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowAddGroup(false)}>
                          Cancel
                        </Button>
                      </motion.div>
                    )}

                    {/* Environment Variable Groups */}
                    <div className="space-y-4">
                      {/* Render grouped variables */}
                      {envGroups.map((group) => {
                        const groupVars = envVars.filter(v => v.group_id === group.id);
                        return (
                          <div key={group.id} className="border rounded-lg">
                            <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={group.enabled}
                                  onCheckedChange={(enabled) => toggleGroupEnabled(group.id!, enabled)}
                                  variant="high-contrast"
                                  className="flex-shrink-0"
                                />
                                <h4 className="font-medium">{group.name}</h4>
                                {group.description && (
                                  <span className="text-sm text-muted-foreground">
                                    - {group.description}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addEnvVar(group.id)}
                                  className="gap-1"
                                >
                                  <Plus className="h-3 w-3" />
                                  {t.settings.addVariable}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteEnvGroup(group.id!)}
                                  className="hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="p-3 space-y-3">
                              {groupVars.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2">
                                  {t.settings.noVariablesInGroup}
                                </p>
                              ) : (
                                groupVars.map((envVar) => {
                                  const globalIndex = envVars.findIndex(v => v === envVar);
                                  return (
                                    <motion.div
                                      key={`env-${globalIndex}`}
                                      initial={{ opacity: 0, x: -20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      className="flex items-center gap-2"
                                    >
                                      <div className="flex-1 relative">
                                        <Input
                                          placeholder="KEY"
                                          value={envVar.key}
                                          onChange={(e) => updateEnvVar(globalIndex, "key", e.target.value)}
                                          className={cn(
                                            "font-mono text-sm",
                                            isDuplicateKey(globalIndex, envVar.key, envVar.group_id) && 
                                            "border-red-500 focus:border-red-500 focus:ring-red-500",
                                            (!envVar.enabled || !group.enabled) && "opacity-60"
                                          )}
                                          disabled={!envVar.enabled}
                                        />
                                        {isDuplicateKey(globalIndex, envVar.key, envVar.group_id) && (
                                          <div className="absolute -bottom-5 left-0 text-xs text-red-500">
                                            Duplicate key in this group
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-muted-foreground">=</span>
                                      <Input
                                        placeholder="value"
                                        value={envVar.value}
                                        onChange={(e) => updateEnvVar(globalIndex, "value", e.target.value)}
                                        className={cn(
                                          "flex-1 font-mono text-sm",
                                          (!envVar.enabled || !group.enabled) && "opacity-60"
                                        )}
                                        disabled={!envVar.enabled}
                                      />
                                      <Switch
                                        checked={envVar.enabled}
                                        onCheckedChange={(enabled) => updateEnvVar(globalIndex, "enabled", enabled)}
                                        variant="high-contrast"
                                        className={cn(
                                          "flex-shrink-0",
                                          !group.enabled && "opacity-60"
                                        )}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeEnvVar(globalIndex)}
                                        className="h-8 w-8 hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </motion.div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Ungrouped variables */}
                      {(() => {
                        const ungroupedVars = envVars.filter(v => !v.group_id);
                        if (ungroupedVars.length === 0) return null;
                        
                        const ungroupedEnabled = ungroupedVars.some(v => v.enabled);
                        
                        return (
                          <div className="border rounded-lg">
                            <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={ungroupedEnabled}
                                  onCheckedChange={(enabled) => toggleUngroupedEnabled(enabled)}
                                  variant="high-contrast"
                                  className="flex-shrink-0"
                                />
                                <h4 className="font-medium">{t.settings.ungroupedVariables}</h4>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addEnvVar()}
                                className="gap-1"
                              >
                                <Plus className="h-3 w-3" />
                                {t.settings.addVariable}
                              </Button>
                            </div>
                            <div className="p-3 space-y-3">
                              {ungroupedVars.map((envVar) => {
                                const globalIndex = envVars.findIndex(v => v === envVar);
                                return (
                                  <motion.div
                                    key={`env-ungrouped-${globalIndex}`}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-2"
                                  >
                                    <div className="flex-1 relative">
                                      <Input
                                        placeholder="KEY"
                                        value={envVar.key}
                                        onChange={(e) => updateEnvVar(globalIndex, "key", e.target.value)}
                                        className={cn(
                                          "font-mono text-sm",
                                          isDuplicateKey(globalIndex, envVar.key, envVar.group_id) && 
                                          "border-red-500 focus:border-red-500 focus:ring-red-500",
                                          (!envVar.enabled || !ungroupedEnabled) && "opacity-60"
                                        )}
                                        disabled={!envVar.enabled}
                                      />
                                      {isDuplicateKey(globalIndex, envVar.key, envVar.group_id) && (
                                        <div className="absolute -bottom-5 left-0 text-xs text-red-500">
                                          {t.settings.duplicateKeyInUngroupedVariables}
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-muted-foreground">=</span>
                                    <Input
                                      placeholder="value"
                                      value={envVar.value}
                                      onChange={(e) => updateEnvVar(globalIndex, "value", e.target.value)}
                                      className={cn(
                                        "flex-1 font-mono text-sm",
                                        (!envVar.enabled || !ungroupedEnabled) && "opacity-60"
                                      )}
                                      disabled={!envVar.enabled}
                                    />
                                    <Switch
                                      checked={envVar.enabled}
                                      onCheckedChange={(enabled) => updateEnvVar(globalIndex, "enabled", enabled)}
                                      variant="high-contrast"
                                      className={cn(
                                        "flex-shrink-0",
                                        !ungroupedEnabled && "opacity-60"
                                      )}
                                      disabled={!ungroupedEnabled}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeEnvVar(globalIndex)}
                                      className="h-8 w-8 hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
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
                          variant="high-contrast"
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
                      <div className="rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-100 dark:bg-blue-900/30 p-4">
                        <div className="flex gap-3">
                          <Shield className="h-5 w-5 text-blue-700 dark:text-blue-300 flex-shrink-0 mt-0.5" />
                          <div className="space-y-2">
                            <p className="font-medium text-blue-900 dark:text-blue-50">{t.analytics.privacyProtected}</p>
                            <ul className="text-sm text-blue-800 dark:text-blue-100 space-y-1">
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
                            <h4 className="text-sm font-medium mb-2 text-foreground">{t.analytics.whatWeCollect}</h4>
                            <ul className="text-sm text-foreground/80 space-y-1">
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
