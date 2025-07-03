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
import { useTranslations } from "@/lib/i18n/useI18n";

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
  const t = useTranslations();
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
      setError(t('agent.nameRequired'));
      return;
    }

    if (!systemPrompt.trim()) {
      setError(t('agent.promptRequired'));
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
      setError(isEditMode ? t('agent.updateFailed') : t('agent.createFailed'));
      setToast({ 
        message: isEditMode ? t('agent.updateFailed') : t('agent.createFailed'), 
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
        !confirm(t('agent.unsavedConfirm'))) {
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
                {isEditMode ? t('agent.edit') : t('agent.create')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditMode ? t('agent.editDesc') : t('agent.createDesc')}
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
            {saving ? t('agent.saving') : t('agent.save')}
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
                <h3 className="text-sm font-medium mb-4">{t('agent.basicInfo')}</h3>
              </div>
              
              {/* Name and Icon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('agent.name')}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('agent.namePlaceholder')}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>{t('agent.iconLabel')}</Label>
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
                <Label>{t('agent.modelLabel')}</Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setModel("sonnet")}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-full border-2 font-medium transition-all",
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
                        <div className="text-xs opacity-80">{t('agent.sonnetDesc')}</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setModel("opus")}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-full border-2 font-medium transition-all",
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
                        <div className="text-xs opacity-80">{t('agent.opusDesc')}</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Default Task */}
              <div className="space-y-2">
                <Label htmlFor="default-task">{t('agent.defaultTaskLabel')}</Label>
                <Input
                  id="default-task"
                  type="text"
                  placeholder={t('agent.defaultTaskPlaceholder')}
                  value={defaultTask}
                  onChange={(e) => setDefaultTask(e.target.value)}
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">
                  {t('agent.defaultTaskDesc')}
                </p>
              </div>

              {/* System Prompt Editor */}
              <div className="space-y-2">
                <Label>{t('agent.systemPromptLabel')}</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('agent.systemPromptDesc')}
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
