import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, type Agent } from "@/lib/api";
import { cn } from "@/lib/utils";
import MDEditor from "@uiw/react-md-editor";
import { AGENT_ICONS, type AgentIconName } from "./CCAgents";
import { AgentSandboxSettings } from "./AgentSandboxSettings";

interface CreateAgentProps {
  /**
   * Optional agent to edit (if provided, component is in edit mode)
   */
  agent?: Agent;
  /**
   * Callback to go back to the agents list
   */
  onBack: () => void;
  /**
   * Callback when agent is created/updated
   */
  onAgentCreated: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * CreateAgent component for creating or editing a CC agent
 * 
 * @example
 * <CreateAgent onBack={() => setView('list')} onAgentCreated={handleCreated} />
 */
export const CreateAgent: React.FC<CreateAgentProps> = ({
  agent,
  onBack,
  onAgentCreated,
  className,
}) => {
  const [name, setName] = useState(agent?.name || "");
  const [selectedIcon, setSelectedIcon] = useState<AgentIconName>((agent?.icon as AgentIconName) || "bot");
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || "");
  const [defaultTask, setDefaultTask] = useState(agent?.default_task || "");
  const [model, setModel] = useState(agent?.model || "sonnet");
  const [engine, setEngine] = useState(agent?.engine || "claude");
  const [sandboxEnabled, setSandboxEnabled] = useState(agent?.sandbox_enabled ?? true);
  const [enableFileRead, setEnableFileRead] = useState(agent?.enable_file_read ?? true);
  const [enableFileWrite, setEnableFileWrite] = useState(agent?.enable_file_write ?? true);
  const [enableNetwork, setEnableNetwork] = useState(agent?.enable_network ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Engine-specific settings state
  const [aiderSettings, setAiderSettings] = useState({
    autoCommit: true,
    gitRepoPath: "",
  });
  
  const [openCodexSettings, setOpenCodexSettings] = useState({
    repositoryPaths: [""],
    endpointUrl: "",
    customConfig: "",
  });

  const isEditMode = !!agent;

  // Get available models based on selected engine
  const getAvailableModels = () => {
    switch (engine) {
      case "claude":
        return [
          { value: "sonnet", label: "Claude 4 Sonnet", description: "Faster, efficient for most tasks", provider: "Anthropic" },
          { value: "opus", label: "Claude 4 Opus", description: "More capable, better for complex tasks", provider: "Anthropic" }
        ];
      case "aider":
        return [
          { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", description: "Best for coding tasks", provider: "OpenRouter" },
          { value: "anthropic/claude-3-opus", label: "Claude 3 Opus", description: "Most capable model", provider: "OpenRouter" },
          { value: "openai/gpt-4o", label: "GPT-4o", description: "OpenAI's latest model", provider: "OpenRouter" }
        ];
      case "opencodx":
        return [
          { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", description: "Excellent code generation", provider: "OpenRouter" },
          { value: "openai/gpt-4o", label: "GPT-4o", description: "Strong coding capabilities", provider: "OpenRouter" },
          { value: "deepseek/deepseek-coder", label: "DeepSeek Coder", description: "Specialized for code", provider: "OpenRouter" }
        ];
      default:
        return [];
    }
  };

  // Reset model when engine changes
  useEffect(() => {
    const availableModels = getAvailableModels();
    if (availableModels.length > 0 && !availableModels.some(m => m.value === model)) {
      setModel(availableModels[0].value);
    }
  }, [engine]);

  // Load engine settings when editing an agent
  useEffect(() => {
    if (agent?.engine_settings) {
      if (agent.engine === "aider") {
        setAiderSettings({
          autoCommit: agent.engine_settings.autoCommit ?? true,
          gitRepoPath: agent.engine_settings.gitRepoPath ?? "",
        });
      } else if (agent.engine === "opencodx") {
        setOpenCodexSettings({
          repositoryPaths: agent.engine_settings.repositoryPaths ?? [""],
          endpointUrl: agent.engine_settings.endpointUrl ?? "",
          customConfig: agent.engine_settings.customConfig ?? "",
        });
      }
    }
  }, [agent]);

  // Validation functions for engine-specific settings
  const validateAiderSettings = () => {
    if (engine !== "aider") return true;
    
    if (aiderSettings.gitRepoPath.trim() && !aiderSettings.gitRepoPath.match(/^[^<>:"|?*]+$/)) {
      setError("Aider: Invalid git repository path format. Avoid special characters.");
      return false;
    }
    return true;
  };

  const validateOpenCodexSettings = () => {
    if (engine !== "opencodx") return true;
    
    // Validate endpoint URL if provided
    if (openCodexSettings.endpointUrl.trim()) {
      try {
        new URL(openCodexSettings.endpointUrl);
      } catch {
        setError("OpenCodex: Invalid endpoint URL format. Must be a valid URL starting with http:// or https://");
        return false;
      }
    }
    
    // Validate repository paths
    for (const path of openCodexSettings.repositoryPaths) {
      if (path.trim() && !path.match(/^[^<>:"|?*]+$/)) {
        setError("OpenCodex: Invalid repository path format. Avoid special characters like < > : \" | ? *");
        return false;
      }
    }

    // Validate that at least one repository path is provided and non-empty
    const validPaths = openCodexSettings.repositoryPaths.filter(path => path.trim());
    if (validPaths.length === 0) {
      setError("OpenCodex: At least one repository path must be provided");
      return false;
    }
    
    return true;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Agent name is required");
      return;
    }

    if (!systemPrompt.trim()) {
      setError("System prompt is required");
      return;
    }

    // Validate engine-specific settings
    if (!validateAiderSettings() || !validateOpenCodexSettings()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      // Prepare engine settings based on selected engine
      const engineSettings = engine === "aider" ? aiderSettings :
                             engine === "opencodx" ? openCodexSettings :
                             undefined;

      if (isEditMode && agent.id) {
        await api.updateAgent(
          agent.id, 
          name, 
          selectedIcon, 
          systemPrompt, 
          defaultTask || undefined, 
          model,
          engine,
          engineSettings,
          sandboxEnabled,
          enableFileRead,
          enableFileWrite,
          enableNetwork
        );
      } else {
        await api.createAgent(
          name, 
          selectedIcon, 
          systemPrompt, 
          defaultTask || undefined, 
          model,
          engine,
          engineSettings,
          sandboxEnabled,
          enableFileRead,
          enableFileWrite,
          enableNetwork
        );
      }
      
      onAgentCreated();
    } catch (err) {
      console.error("Failed to save agent:", err);
      
      // Parse error message for engine-specific guidance
      const errorMessage = err instanceof Error ? err.message : String(err);
      let userFriendlyError = isEditMode ? "Failed to update agent" : "Failed to create agent";
      
      if (errorMessage.includes("OpenRouter")) {
        userFriendlyError += ": OpenRouter API key may be missing or invalid. Check your OPENROUTER_API_KEY environment variable.";
      } else if (errorMessage.includes("Aider dependencies")) {
        userFriendlyError += ": Aider is not installed or not found in PATH. Please install Aider first.";
      } else if (errorMessage.includes("OpenCodex dependencies")) {
        userFriendlyError += ": OpenCodex is not installed or not found in PATH. Please install OpenCodex first.";
      } else if (errorMessage.includes("engine_settings")) {
        userFriendlyError += ": Invalid engine settings provided. Please check your configuration.";
      } else if (errorMessage.includes("Invalid") || errorMessage.includes("format")) {
        userFriendlyError += ": " + errorMessage;
      }
      
      setError(userFriendlyError);
      setToast({ 
        message: userFriendlyError, 
        type: "error" 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    // Check if engine settings have changed
    const originalAiderSettings = agent?.engine === "aider" && agent?.engine_settings ? {
      autoCommit: agent.engine_settings.autoCommit ?? true,
      gitRepoPath: agent.engine_settings.gitRepoPath ?? "",
    } : { autoCommit: true, gitRepoPath: "" };

    const originalOpenCodexSettings = agent?.engine === "opencodx" && agent?.engine_settings ? {
      repositoryPaths: agent.engine_settings.repositoryPaths ?? [""],
      endpointUrl: agent.engine_settings.endpointUrl ?? "",
      customConfig: agent.engine_settings.customConfig ?? "",
    } : { repositoryPaths: [""], endpointUrl: "", customConfig: "" };

    const aiderSettingsChanged = engine === "aider" && (
      aiderSettings.autoCommit !== originalAiderSettings.autoCommit ||
      aiderSettings.gitRepoPath !== originalAiderSettings.gitRepoPath
    );

    const openCodexSettingsChanged = engine === "opencodx" && (
      JSON.stringify(openCodexSettings.repositoryPaths) !== JSON.stringify(originalOpenCodexSettings.repositoryPaths) ||
      openCodexSettings.endpointUrl !== originalOpenCodexSettings.endpointUrl ||
      openCodexSettings.customConfig !== originalOpenCodexSettings.customConfig
    );

    if ((name !== (agent?.name || "") || 
         selectedIcon !== (agent?.icon || "bot") || 
         systemPrompt !== (agent?.system_prompt || "") ||
         defaultTask !== (agent?.default_task || "") ||
         model !== (agent?.model || "sonnet") ||
         engine !== (agent?.engine || "claude") ||
         aiderSettingsChanged ||
         openCodexSettingsChanged ||
         sandboxEnabled !== (agent?.sandbox_enabled ?? true) ||
         enableFileRead !== (agent?.enable_file_read ?? true) ||
         enableFileWrite !== (agent?.enable_file_write ?? true) ||
         enableNetwork !== (agent?.enable_network ?? false)) && 
        !confirm("You have unsaved changes. Are you sure you want to leave?")) {
      return;
    }
    onBack();
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between p-4 border-b border-border"
        >
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold">
                {isEditMode ? "Edit CC Agent" : "Create CC Agent"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditMode ? "Update your Claude Code agent" : "Create a new Claude Code agent"}
              </p>
            </div>
          </div>
          
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !systemPrompt.trim()}
            size="sm"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save"}
          </Button>
        </motion.div>
        
        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-4 mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
          >
            {error}
          </motion.div>
        )}
        
        {/* Form */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-6">
            {/* Agent Name */}
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent Name</Label>
              <Input
                id="agent-name"
                type="text"
                placeholder="e.g., Code Reviewer, Test Generator"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="max-w-md"
              />
            </div>

            {/* Icon Picker */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2 max-w-2xl">
                {(Object.keys(AGENT_ICONS) as AgentIconName[]).map((iconName) => {
                  const Icon = AGENT_ICONS[iconName];
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setSelectedIcon(iconName)}
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all hover:scale-105",
                        "flex items-center justify-center",
                        selectedIcon === iconName
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Engine Selection */}
            <div className="space-y-2">
              <Label>Engine</Label>
              <Select value={engine} onValueChange={setEngine}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an engine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">
                    <div className="flex flex-col">
                      <span className="font-medium">Claude</span>
                      <span className="text-sm text-muted-foreground">Direct Anthropic API integration</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="aider">
                    <div className="flex flex-col">
                      <span className="font-medium">Aider</span>
                      <span className="text-sm text-muted-foreground">AI pair programming tool via OpenRouter</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="opencodx">
                    <div className="flex flex-col">
                      <span className="font-medium">OpenCodex</span>
                      <span className="text-sm text-muted-foreground">Code generation engine via OpenRouter</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {(engine === "aider" || engine === "opencodx") && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <strong>Note:</strong> {engine.charAt(0).toUpperCase() + engine.slice(1)} requires an OpenRouter API key. 
                  Make sure you have set the OPENROUTER_API_KEY environment variable.
                </div>
              )}
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label>Model</Label>
              <div className="flex flex-col gap-3">
                {getAvailableModels().map((modelOption) => (
                  <button
                    key={modelOption.value}
                    type="button"
                    onClick={() => setModel(modelOption.value)}
                    className={cn(
                      "w-full px-4 py-2.5 rounded-lg border-2 font-medium transition-all",
                      "hover:scale-[1.01] active:scale-[0.99]",
                      model === modelOption.value
                        ? "border-primary bg-primary text-primary-foreground shadow-lg" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        model === modelOption.value ? "border-primary-foreground" : "border-current"
                      )}>
                        {model === modelOption.value && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div className="text-left flex-1">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">{modelOption.label}</div>
                          <div className="text-xs opacity-60 bg-background/20 px-2 py-1 rounded">
                            {modelOption.provider}
                          </div>
                        </div>
                        <div className="text-xs opacity-80">{modelOption.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Engine-Specific Settings */}
            {engine === "aider" && (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold">Aider Settings</Label>
                </div>
                
                {/* Auto-commit toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="aider-auto-commit">Auto-commit changes</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically commit code changes made by Aider
                    </p>
                  </div>
                  <Switch
                    id="aider-auto-commit"
                    checked={aiderSettings.autoCommit}
                    onCheckedChange={(checked) => 
                      setAiderSettings(prev => ({ ...prev, autoCommit: checked }))
                    }
                  />
                </div>

                {/* Git repository path */}
                <div className="space-y-2">
                  <Label htmlFor="aider-git-repo">Git Repository Path (Optional)</Label>
                  <Input
                    id="aider-git-repo"
                    type="text"
                    placeholder="e.g., /path/to/git/repository"
                    value={aiderSettings.gitRepoPath}
                    onChange={(e) => 
                      setAiderSettings(prev => ({ ...prev, gitRepoPath: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Specify a custom git repository path for Aider to work with
                  </p>
                </div>
              </div>
            )}

            {engine === "opencodx" && (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold">OpenCodex Settings</Label>
                </div>

                {/* Repository paths */}
                <div className="space-y-2">
                  <Label htmlFor="opencodx-repo-paths">Repository Paths</Label>
                  {openCodexSettings.repositoryPaths.map((path, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="e.g., /path/to/repository"
                        value={path}
                        onChange={(e) => {
                          const newPaths = [...openCodexSettings.repositoryPaths];
                          newPaths[index] = e.target.value;
                          setOpenCodexSettings(prev => ({ ...prev, repositoryPaths: newPaths }));
                        }}
                        className="flex-1"
                      />
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newPaths = openCodexSettings.repositoryPaths.filter((_, i) => i !== index);
                            setOpenCodexSettings(prev => ({ ...prev, repositoryPaths: newPaths }));
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpenCodexSettings(prev => ({
                        ...prev,
                        repositoryPaths: [...prev.repositoryPaths, ""]
                      }));
                    }}
                  >
                    Add Repository
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Multiple repository paths for OpenCodex to analyze
                  </p>
                </div>

                {/* Endpoint URL */}
                <div className="space-y-2">
                  <Label htmlFor="opencodx-endpoint">Custom Endpoint URL (Optional)</Label>
                  <Input
                    id="opencodx-endpoint"
                    type="url"
                    placeholder="e.g., https://custom-opencodx-endpoint.com"
                    value={openCodexSettings.endpointUrl}
                    onChange={(e) => 
                      setOpenCodexSettings(prev => ({ ...prev, endpointUrl: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Override the default OpenCodex API endpoint
                  </p>
                </div>

                {/* Custom configuration */}
                <div className="space-y-2">
                  <Label htmlFor="opencodx-config">Custom Configuration (Optional)</Label>
                  <Input
                    id="opencodx-config"
                    type="text"
                    placeholder="e.g., --max-tokens=4000 --temperature=0.1"
                    value={openCodexSettings.customConfig}
                    onChange={(e) => 
                      setOpenCodexSettings(prev => ({ ...prev, customConfig: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Additional command-line arguments for OpenCodex
                  </p>
                </div>
              </div>
            )}

            {/* Default Task */}
            <div className="space-y-2">
              <Label htmlFor="default-task">Default Task (Optional)</Label>
              <Input
                id="default-task"
                type="text"
                placeholder="e.g., Review this code for security issues"
                value={defaultTask}
                onChange={(e) => setDefaultTask(e.target.value)}
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground">
                This will be used as the default task placeholder when executing the agent
              </p>
            </div>

            {/* Sandbox Settings */}
            <AgentSandboxSettings
              agent={{
                id: agent?.id,
                name,
                icon: selectedIcon,
                system_prompt: systemPrompt,
                default_task: defaultTask || undefined,
                model,
                engine,
                sandbox_enabled: sandboxEnabled,
                enable_file_read: enableFileRead,
                enable_file_write: enableFileWrite,
                enable_network: enableNetwork,
                created_at: agent?.created_at || "",
                updated_at: agent?.updated_at || ""
              }}
              onUpdate={(updates) => {
                if ('sandbox_enabled' in updates) setSandboxEnabled(updates.sandbox_enabled!);
                if ('enable_file_read' in updates) setEnableFileRead(updates.enable_file_read!);
                if ('enable_file_write' in updates) setEnableFileWrite(updates.enable_file_write!);
                if ('enable_network' in updates) setEnableNetwork(updates.enable_network!);
              }}
            />

            {/* System Prompt Editor */}
            <div className="space-y-2">
              <Label>System Prompt</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Define the behavior and capabilities of your CC Agent
              </p>
              <div className="rounded-lg border border-border overflow-hidden shadow-sm" data-color-mode="dark">
                <MDEditor
                  value={systemPrompt}
                  onChange={(val) => setSystemPrompt(val || "")}
                  preview="edit"
                  height={400}
                  visibleDragbar={false}
                />
              </div>
            </div>
          </div>
        </div>
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