import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Loader2, ChevronDown, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
  const [model, setModel] = useState(agent?.model || "sonnet");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const isEditMode = !!agent;

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Agent name is required");
      return;
    }

    if (!systemPrompt.trim()) {
      setError("System prompt is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      if (isEditMode && agent.id) {
        await api.updateAgent(
          agent.id, 
          name, 
          selectedIcon, 
          systemPrompt, 
          defaultTask || undefined, 
          model
        );
      } else {
        await api.createAgent(
          name, 
          selectedIcon, 
          systemPrompt, 
          defaultTask || undefined, 
          model
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
         model !== (agent?.model || "sonnet")) && 
        !confirm("You have unsaved changes. Are you sure you want to leave?")) {
      return;
    }
    onBack();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("h-full overflow-y-auto bg-background", className)}
    >
      <div className="max-w-6xl mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.15 }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="h-9 w-9 -ml-2"
                  title="Back to Agents"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </motion.div>
              <div>
                <h1 className="text-heading-1">
                  {isEditMode ? "Edit Agent" : "Create New Agent"}
                </h1>
                <p className="mt-1 text-body-small text-muted-foreground">
                  {isEditMode ? "Update your Claude Code agent configuration" : "Configure a new Claude Code agent"}
                </p>
              </div>
            </div>
            
            <motion.div
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                onClick={handleSave}
                disabled={saving || !name.trim() || !systemPrompt.trim()}
                size="default"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Agent
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        </div>
        
        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="mx-6 mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/50 flex items-center gap-2"
          >
            <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
            <span className="text-caption text-destructive">{error}</span>
          </motion.div>
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Basic Information */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-heading-4">Basic Information</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-caption text-muted-foreground">Agent Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Code Assistant"
                    required
                    className="h-9"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-caption text-muted-foreground">Agent Icon</Label>
                  <motion.div
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setShowIconPicker(true)}
                    className="h-9 px-3 py-2 bg-background border border-input rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
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
                  </motion.div>
                </div>
              </div>

              {/* Model Selection */}
              <div className="space-y-2 mt-4">
                <Label className="text-caption text-muted-foreground">Model</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <motion.button
                    type="button"
                    onClick={() => setModel("sonnet")}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-md border transition-all",
                      model === "sonnet" 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-border hover:border-primary/50 hover:bg-accent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Zap className={cn(
                        "h-4 w-4",
                        model === "sonnet" ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div className="text-left">
                        <div className="text-body-small font-medium">Claude 4 Sonnet</div>
                        <div className="text-caption text-muted-foreground">Faster, efficient for most tasks</div>
                      </div>
                    </div>
                  </motion.button>
                  
                  <motion.button
                    type="button"
                    onClick={() => setModel("opus")}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-md border transition-all",
                      model === "opus" 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-border hover:border-primary/50 hover:bg-accent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Zap className={cn(
                        "h-4 w-4",
                        model === "opus" ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div className="text-left">
                        <div className="text-body-small font-medium">Claude 4 Opus</div>
                        <div className="text-caption text-muted-foreground">More capable, better for complex tasks</div>
                      </div>
                    </div>
                  </motion.button>
                </div>
              </div>
            </Card>

            {/* Configuration */}
            <Card className="p-5">
              <h3 className="text-heading-4 mb-4">Configuration</h3>
              <div className="space-y-2">
                <Label htmlFor="default-task" className="text-caption text-muted-foreground">Default Task (Optional)</Label>
                <Input
                  id="default-task"
                  type="text"
                  placeholder="e.g., Review this code for security issues"
                  value={defaultTask}
                  onChange={(e) => setDefaultTask(e.target.value)}
                  className="h-9"
                />
                <p className="text-caption text-muted-foreground">
                  This will be used as the default task placeholder when executing the agent
                </p>
              </div>
            </Card>

            {/* System Prompt */}
            <Card className="p-5">
              <div className="mb-4">
                <h3 className="text-heading-4 mb-1">System Prompt</h3>
                <p className="text-caption text-muted-foreground">
                  Define the behavior and capabilities of your Claude Code agent
                </p>
              </div>
              <div className="rounded-md border border-border overflow-hidden" data-color-mode="dark">
                <MDEditor
                  value={systemPrompt}
                  onChange={(val) => setSystemPrompt(val || "")}
                  preview="edit"
                  height={350}
                  visibleDragbar={false}
                />
              </div>
            </Card>
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
    </motion.div>
  );
}; 
