import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  api, 
  type ClaudeSettings,
  type ClaudeInstallation
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { ClaudeVersionSelector } from "./ClaudeVersionSelector";
import { StorageTab } from "./StorageTab";
import { HooksEditor } from "./HooksEditor";
import { SlashCommandsManager } from "./SlashCommandsManager";

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
 * Provides a no-code interface for editing the settings.json file
 */
export const Settings: React.FC<SettingsProps> = ({
  onBack,
  className,
}) => {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [currentBinaryPath, setCurrentBinaryPath] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<ClaudeInstallation | null>(null);
  const [binaryPathChanged, setBinaryPathChanged] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Permission rules state
  const [allowRules, setAllowRules] = useState<PermissionRule[]>([]);
  const [denyRules, setDenyRules] = useState<PermissionRule[]>([]);
  
  // Environment variables state
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  
  // Hooks state
  const [userHooksChanged, setUserHooksChanged] = useState(false);
  const getUserHooks = React.useRef<(() => any) | null>(null);
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadClaudeBinaryPath();
  }, []);

  /**
   * Loads the current Claude binary path
   */
  const loadClaudeBinaryPath = async () => {
    try {
      const path = await api.getClaudeBinaryPath();
      setCurrentBinaryPath(path);
    } catch (err) {
      console.error("Failed to load Claude binary path:", err);
    }
  };

  /**
   * Loads the current Claude settings
   */
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSettings = await api.getClaudeSettings();
      
      // Ensure loadedSettings is an object
      if (!loadedSettings || typeof loadedSettings !== 'object') {
        console.warn("Loaded settings is not an object:", loadedSettings);
        setSettings({});
        return;
      }
      
      setSettings(loadedSettings);

      // Parse permissions
      if (loadedSettings.permissions && typeof loadedSettings.permissions === 'object') {
        if (Array.isArray(loadedSettings.permissions.allow)) {
          setAllowRules(
            loadedSettings.permissions.allow.map((rule: string, index: number) => ({
              id: `allow-${index}`,
              value: rule,
            }))
          );
        }
        if (Array.isArray(loadedSettings.permissions.deny)) {
          setDenyRules(
            loadedSettings.permissions.deny.map((rule: string, index: number) => ({
              id: `deny-${index}`,
              value: rule,
            }))
          );
        }
      }

      // Parse environment variables
      if (loadedSettings.env && typeof loadedSettings.env === 'object' && !Array.isArray(loadedSettings.env)) {
        setEnvVars(
          Object.entries(loadedSettings.env).map(([key, value], index) => ({
            id: `env-${index}`,
            key,
            value: value as string,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError("Failed to load settings. Please ensure ~/.claude directory exists.");
      setSettings({});
    } finally {
      setLoading(false);
    }
  };

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
          allow: allowRules.map(rule => rule.value).filter(v => v.trim()),
          deny: denyRules.map(rule => rule.value).filter(v => v.trim()),
        },
        env: envVars.reduce((acc, { key, value }) => {
          if (key.trim() && value.trim()) {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, string>),
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
        await api.updateHooksConfig('user', hooks);
        setUserHooksChanged(false);
      }

      setToast({ message: "Settings saved successfully!", type: "success" });
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("Failed to save settings.");
      setToast({ message: "Failed to save settings", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Updates a simple setting value
   */
  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Adds a new permission rule
   */
  const addPermissionRule = (type: "allow" | "deny") => {
    const newRule: PermissionRule = {
      id: `${type}-${Date.now()}`,
      value: "",
    };
    
    if (type === "allow") {
      setAllowRules(prev => [...prev, newRule]);
    } else {
      setDenyRules(prev => [...prev, newRule]);
    }
  };

  /**
   * Updates a permission rule
   */
  const updatePermissionRule = (type: "allow" | "deny", id: string, value: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.map(rule => 
        rule.id === id ? { ...rule, value } : rule
      ));
    } else {
      setDenyRules(prev => prev.map(rule => 
        rule.id === id ? { ...rule, value } : rule
      ));
    }
  };

  /**
   * Removes a permission rule
   */
  const removePermissionRule = (type: "allow" | "deny", id: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.filter(rule => rule.id !== id));
    } else {
      setDenyRules(prev => prev.filter(rule => rule.id !== id));
    }
  };

  /**
   * Adds a new environment variable
   */
  const addEnvVar = () => {
    const newVar: EnvironmentVariable = {
      id: `env-${Date.now()}`,
      key: "",
      value: "",
    };
    setEnvVars(prev => [...prev, newVar]);
  };

  /**
   * Updates an environment variable
   */
  const updateEnvVar = (id: string, field: "key" | "value", value: string) => {
    setEnvVars(prev => prev.map(envVar => 
      envVar.id === id ? { ...envVar, [field]: value } : envVar
    ));
  };

  /**
   * Removes an environment variable
   */
  const removeEnvVar = (id: string) => {
    setEnvVars(prev => prev.filter(envVar => envVar.id !== id));
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
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-xs text-muted-foreground">
              Configure Claude Code preferences
          </p>
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
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
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
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="environment">Environment</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              <TabsTrigger value="hooks">Hooks</TabsTrigger>
              <TabsTrigger value="commands">Commands</TabsTrigger>
              <TabsTrigger value="storage">Storage</TabsTrigger>
            </TabsList>
            
            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              <Card className="p-6 space-y-6">
                <div>
                  <h3 className="text-base font-semibold mb-4">General Settings</h3>
                  
                  <div className="space-y-4">
                    {/* Include Co-authored By */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="coauthored">Include "Co-authored by Claude"</Label>
                        <p className="text-xs text-muted-foreground">
                          Add Claude attribution to git commits and pull requests
                        </p>
                      </div>
                      <Switch
                        id="coauthored"
                        checked={settings?.includeCoAuthoredBy !== false}
                        onCheckedChange={(checked) => updateSetting("includeCoAuthoredBy", checked)}
                      />
                    </div>
                    
                    {/* Verbose Output */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="verbose">Verbose Output</Label>
                        <p className="text-xs text-muted-foreground">
                          Show full bash and command outputs
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
                      <Label htmlFor="cleanup">Chat Transcript Retention (days)</Label>
                      <Input
                        id="cleanup"
                        type="number"
                        min="1"
                        placeholder="30"
                        value={settings?.cleanupPeriodDays || ""}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : undefined;
                          updateSetting("cleanupPeriodDays", value);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        How long to retain chat transcripts locally (default: 30 days)
                      </p>
                    </div>
                    
                    {/* Claude Binary Path Selector */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Claude Code Installation</Label>
                        <p className="text-xs text-muted-foreground mb-4">
                          Select which Claude Code installation to use. Bundled version is recommended for best compatibility.
                        </p>
                      </div>
                      <ClaudeVersionSelector
                        selectedPath={currentBinaryPath}
                        onSelect={handleClaudeInstallationSelect}
                      />
                      {binaryPathChanged && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          ⚠️ Claude binary path has been changed. Remember to save your settings.
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
                    <h3 className="text-base font-semibold mb-2">Permission Rules</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Control which tools Claude Code can use without manual approval
                    </p>
                  </div>
                  
                  {/* Allow Rules */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-green-500">Allow Rules</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addPermissionRule("allow")}
                        className="gap-2 hover:border-green-500/50 hover:text-green-500"
                      >
                        <Plus className="h-3 w-3" />
                        Add Rule
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {allowRules.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          No allow rules configured. Claude will ask for approval for all tools.
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
                              onChange={(e) => updatePermissionRule("allow", rule.id, e.target.value)}
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
                      <Label className="text-sm font-medium text-red-500">Deny Rules</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addPermissionRule("deny")}
                        className="gap-2 hover:border-red-500/50 hover:text-red-500"
                      >
                        <Plus className="h-3 w-3" />
                        Add Rule
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {denyRules.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          No deny rules configured.
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
                              onChange={(e) => updatePermissionRule("deny", rule.id, e.target.value)}
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
                      <strong>Examples:</strong>
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash</code> - Allow all bash commands</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run build)</code> - Allow exact command</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run test:*)</code> - Allow commands with prefix</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Read(~/.zshrc)</code> - Allow reading specific file</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Edit(docs/**)</code> - Allow editing files in docs directory</li>
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
                      <h3 className="text-base font-semibold">Environment Variables</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Environment variables applied to every Claude Code session
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addEnvVar}
                      className="gap-2"
                    >
                      <Plus className="h-3 w-3" />
                      Add Variable
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {envVars.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        No environment variables configured.
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
                      <strong>Common variables:</strong>
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                      <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">CLAUDE_CODE_ENABLE_TELEMETRY</code> - Enable/disable telemetry (0 or 1)</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">ANTHROPIC_MODEL</code> - Custom model name</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">DISABLE_COST_WARNINGS</code> - Disable cost warnings (1)</li>
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
                    <h3 className="text-base font-semibold mb-4">Advanced Settings</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Additional configuration options for advanced users
                    </p>
                  </div>
                  
                  {/* API Key Helper */}
                  <div className="space-y-2">
                    <Label htmlFor="apiKeyHelper">API Key Helper Script</Label>
                    <Input
                      id="apiKeyHelper"
                      placeholder="/path/to/generate_api_key.sh"
                      value={settings?.apiKeyHelper || ""}
                      onChange={(e) => updateSetting("apiKeyHelper", e.target.value || undefined)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Custom script to generate auth values for API requests
                    </p>
                  </div>
                  
                  {/* Raw JSON Editor */}
                  <div className="space-y-2">
                    <Label>Raw Settings (JSON)</Label>
                    <div className="p-3 rounded-md bg-muted font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                      <pre>{JSON.stringify(settings, null, 2)}</pre>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This shows the raw JSON that will be saved to ~/.claude/settings.json
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            {/* Hooks Settings */}
            <TabsContent value="hooks" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold mb-2">User Hooks</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure hooks that apply to all Claude Code sessions for your user account.
                      These are stored in <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">~/.claude/settings.json</code>
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
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </div>
  );
}; 
