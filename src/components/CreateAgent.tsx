import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { api, type Agent } from "@/lib/api";
import { cn } from "@/lib/utils";
import MDEditor from "@uiw/react-md-editor";
import { type AgentIconName } from "./CCAgents";
import { IconPicker, ICON_MAP } from "./IconPicker";

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
  
  // Initialize model state - if agent has a custom model, set it as custom
  const isCustomModel = agent?.model && !["sonnet", "opus"].includes(agent.model);
  const [model, setModel] = useState(isCustomModel ? "custom" : (agent?.model || "sonnet"));
  const [customModel, setCustomModel] = useState(isCustomModel ? agent.model : "");
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const isEditMode = !!agent;

  const getEffectiveModel = () => {
    if (model === "custom") {
      return customModel.trim() || "sonnet";
    }
    return model;
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

    if (model === "custom" && !customModel.trim()) {
      setError("Custom model name is required when using custom model");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const effectiveModel = getEffectiveModel();
      
      if (isEditMode && agent.id) {
        await api.updateAgent(
          agent.id, 
          name, 
          selectedIcon, 
          systemPrompt, 
          defaultTask || undefined, 
          effectiveModel
        );
      } else {
        await api.createAgent(
          name, 
          selectedIcon, 
          systemPrompt, 
          defaultTask || undefined, 
          effectiveModel
        );
      }
      
      onAgentCreated();
    } catch (err) {
      console.error("Failed to save agent:", err);
      setError(isEditMode ? "Failed to update agent" : "Failed to create agent");
      setToast({ 
        message: isEditMode ? "Failed to update agent" : "Failed to create agent", 
        type: "error" 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if ((name !== (agent?.name || "") || 
         selectedIcon !== (agent?.icon || "bot") || 
         systemPrompt !== (agent?.system_prompt || "") ||
         defaultTask !== (agent?.default_task || "") ||
         model !== (agent?.model || "sonnet") ||
         getEffectiveModel() !== (agent?.model || "sonnet")) && 
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
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-6"
          >
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-4">Basic Information</h3>
              </div>
              
              {/* Name and Icon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Code Assistant"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Agent Icon</Label>
                  <div
                    onClick={() => setShowIconPicker(true)}
                    className="h-10 px-3 py-2 bg-background border border-input rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon = ICON_MAP[selectedIcon] || ICON_MAP.bot;
                        return (
                          <>
                            <Icon className="h-4 w-4" />
                            <span className="text-sm">{selectedIcon}</span>
                          </>
                        );
                      })()}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <Label>Model</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setModel("sonnet")}
                    className={cn(
                      "px-4 py-2.5 rounded-full border-2 font-medium transition-all",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "sonnet" 
                        ? "border-primary bg-primary text-primary-foreground shadow-lg" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-center justify-center gap-2.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        model === "sonnet" ? "border-primary-foreground" : "border-current"
                      )}>
                        {model === "sonnet" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold">Claude 4 Sonnet</div>
                        <div className="text-xs opacity-80">Balanced, efficient for most tasks</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setModel("opus")}
                    className={cn(
                      "px-4 py-2.5 rounded-full border-2 font-medium transition-all",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "opus" 
                        ? "border-primary bg-primary text-primary-foreground shadow-lg" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-center justify-center gap-2.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        model === "opus" ? "border-primary-foreground" : "border-current"
                      )}>
                        {model === "opus" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold">Claude 4 Opus</div>
                        <div className="text-xs opacity-80">Most capable, complex tasks</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModel("custom")}
                    className={cn(
                      "px-4 py-2.5 rounded-full border-2 font-medium transition-all",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "custom" 
                        ? "border-primary bg-primary text-primary-foreground shadow-lg" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-center justify-center gap-2.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        model === "custom" ? "border-primary-foreground" : "border-current"
                      )}>
                        {model === "custom" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold">Custom Model</div>
                        <div className="text-xs opacity-80">Bedrock, Vertex AI, etc.</div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Custom Model Input */}
                {model === "custom" && (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="custom-model">Custom Model Name</Label>
                    <Input
                      id="custom-model"
                      type="text"
                      placeholder="e.g., us.anthropic.claude-sonnet-4-20250514-v1"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      className="max-w-lg"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the full model identifier for Bedrock, Vertex AI, or other providers. 
                      Make sure the corresponding environment variables are configured in Settings.
                    </p>
                  </div>
                )}
              </div>

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
          </motion.div>
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

      {/* Icon Picker Dialog */}
      <IconPicker
        value={selectedIcon}
        onSelect={(iconName) => {
          setSelectedIcon(iconName as AgentIconName);
          setShowIconPicker(false);
        }}
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
      />
    </div>
  );
}; 
