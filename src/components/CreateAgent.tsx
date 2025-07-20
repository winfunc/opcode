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
import { IconPicker } from "./IconPicker";
import { AGENT_ICONS } from "@/constants/agentIcons";
import { useI18n } from "@/lib/i18n";
import { getModelPricing, formatPrice } from "@/config/pricing";
import { handleError } from "@/lib/errorHandler";
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
  const { t } = useI18n();
  const [name, setName] = useState(agent?.name || "");
  const [selectedIcon, setSelectedIcon] = useState<string>(
    agent?.icon || "Bot"
  );
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || "");
  const [defaultTask, setDefaultTask] = useState(agent?.default_task || "");
  const [model, setModel] = useState(agent?.model || "sonnet-3-5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const isEditMode = !!agent;

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t.agents.agentNameRequired);
      return;
    }

    if (!systemPrompt.trim()) {
      setError(t.agents.systemPromptRequired);
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
        await api.createAgent(name, selectedIcon, systemPrompt, defaultTask || undefined, model);
      }

      onAgentCreated();
    } catch (err) {
      await handleError("Failed to save agent:", { context: err });
      setError(isEditMode ? t.agents.failedToUpdateAgent : t.agents.failedToCreateAgent);
      setToast({
        message: isEditMode ? t.agents.failedToUpdateAgent : t.agents.failedToCreateAgent,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (
      (name !== (agent?.name || "") ||
        selectedIcon !== (agent?.icon || "bot") ||
        systemPrompt !== (agent?.system_prompt || "") ||
        defaultTask !== (agent?.default_task || "") ||
        model !== (agent?.model || "sonnet-3-5")) &&
      !globalThis.confirm(t.agents.unsavedChanges)
    ) {
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
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold">
                {isEditMode ? t.agents.editCCAgent : t.agents.createCCAgent}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditMode ? t.agents.updateAgent : t.agents.createNewAgent}
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
            {saving ? t.agents.saving : t.common.save}
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
                <h3 className="text-sm font-medium mb-4">{t.agents.basicInformation}</h3>
              </div>

              {/* Name and Icon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.agents.agentName}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.agents.agentNamePlaceholder}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.agents.agentIcon}</Label>
                  <div
                    onClick={() => setShowIconPicker(true)}
                    className="h-10 px-3 py-2 bg-background border border-input rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon = AGENT_ICONS[selectedIcon] || AGENT_ICONS.Bot;
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
                <Label>{t.agents.model}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Claude 3.5 Haiku */}
                  <button
                    type="button"
                    onClick={() => setModel("haiku")}
                    className={cn(
                      "px-4 py-3 rounded-lg border-2 font-medium transition-all text-left",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "haiku"
                        ? "border-primary bg-primary text-primary-foreground shadow-lg"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                          model === "haiku" ? "border-primary-foreground" : "border-current"
                        )}
                      >
                        {model === "haiku" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{t.agents.claude35Haiku}</div>
                        <div className="text-xs opacity-80">{t.agents.fastAffordable}</div>
                        <div className="text-xs opacity-60 mt-1">
                          {t.agents.inputTokens}:{" "}
                          {formatPrice(getModelPricing("haiku")?.inputPrice || 0)}/M •{" "}
                          {t.agents.outputTokens}:{" "}
                          {formatPrice(getModelPricing("haiku")?.outputPrice || 0)}/M
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Claude 3.5 Sonnet */}
                  <button
                    type="button"
                    onClick={() => setModel("sonnet-3-5")}
                    className={cn(
                      "px-4 py-3 rounded-lg border-2 font-medium transition-all text-left",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "sonnet-3-5"
                        ? "border-primary bg-primary text-primary-foreground shadow-lg"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                          model === "sonnet-3-5" ? "border-primary-foreground" : "border-current"
                        )}
                      >
                        {model === "sonnet-3-5" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{t.agents.claude35Sonnet}</div>
                        <div className="text-xs opacity-80">{t.agents.balancedPerformance}</div>
                        <div className="text-xs opacity-60 mt-1">
                          {t.agents.inputTokens}:{" "}
                          {formatPrice(getModelPricing("sonnet-3-5")?.inputPrice || 0)}/M •{" "}
                          {t.agents.outputTokens}:{" "}
                          {formatPrice(getModelPricing("sonnet-3-5")?.outputPrice || 0)}/M
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Claude 3.7 Sonnet */}
                  <button
                    type="button"
                    onClick={() => setModel("sonnet-3-7")}
                    className={cn(
                      "px-4 py-3 rounded-lg border-2 font-medium transition-all text-left",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "sonnet-3-7"
                        ? "border-primary bg-primary text-primary-foreground shadow-lg"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                          model === "sonnet-3-7" ? "border-primary-foreground" : "border-current"
                        )}
                      >
                        {model === "sonnet-3-7" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{t.agents.claude37Sonnet}</div>
                        <div className="text-xs opacity-80">{t.agents.advancedReasoning}</div>
                        <div className="text-xs opacity-60 mt-1">
                          {t.agents.inputTokens}:{" "}
                          {formatPrice(getModelPricing("sonnet-3-7")?.inputPrice || 0)}/M •{" "}
                          {t.agents.outputTokens}:{" "}
                          {formatPrice(getModelPricing("sonnet-3-7")?.outputPrice || 0)}/M
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Legacy Claude 4 Sonnet */}
                  <button
                    type="button"
                    onClick={() => setModel("sonnet")}
                    className={cn(
                      "px-4 py-3 rounded-lg border-2 font-medium transition-all text-left",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "sonnet"
                        ? "border-primary bg-primary text-primary-foreground shadow-lg"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                          model === "sonnet" ? "border-primary-foreground" : "border-current"
                        )}
                      >
                        {model === "sonnet" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{t.agents.claude4Sonnet}</div>
                        <div className="text-xs opacity-80">{t.agents.fasterEfficient}</div>
                        <div className="text-xs opacity-60 mt-1">
                          {t.agents.inputTokens}:{" "}
                          {formatPrice(getModelPricing("sonnet")?.inputPrice || 0)}/M •{" "}
                          {t.agents.outputTokens}:{" "}
                          {formatPrice(getModelPricing("sonnet")?.outputPrice || 0)}/M
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Legacy Claude 4 Opus */}
                  <button
                    type="button"
                    onClick={() => setModel("opus")}
                    className={cn(
                      "px-4 py-3 rounded-lg border-2 font-medium transition-all text-left",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "opus"
                        ? "border-primary bg-primary text-primary-foreground shadow-lg"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                          model === "opus" ? "border-primary-foreground" : "border-current"
                        )}
                      >
                        {model === "opus" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{t.agents.claude4Opus}</div>
                        <div className="text-xs opacity-80">{t.agents.moreCapable}</div>
                        <div className="text-xs opacity-60 mt-1">
                          {t.agents.inputTokens}:{" "}
                          {formatPrice(getModelPricing("opus")?.inputPrice || 0)}/M •{" "}
                          {t.agents.outputTokens}:{" "}
                          {formatPrice(getModelPricing("opus")?.outputPrice || 0)}/M
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Default Task */}
              <div className="space-y-2">
                <Label htmlFor="default-task">{t.agents.defaultTask}</Label>
                <Input
                  id="default-task"
                  type="text"
                  placeholder={t.agents.defaultTaskPlaceholder}
                  value={defaultTask}
                  onChange={(e) => setDefaultTask(e.target.value)}
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">{t.agents.defaultTaskDesc}</p>
              </div>

              {/* System Prompt Editor */}
              <div className="space-y-2">
                <Label>{t.agents.systemPrompt}</Label>
                <p className="text-xs text-muted-foreground mb-2">{t.agents.systemPromptDesc}</p>
                <div
                  className="rounded-lg border border-border overflow-hidden shadow-sm"
                  data-color-mode="dark"
                >
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
          <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
        )}
      </ToastContainer>

      {/* Icon Picker Dialog */}
      <IconPicker
        value={selectedIcon}
        onSelect={(iconName) => {
          setSelectedIcon(iconName as string);
          setShowIconPicker(false);
        }}
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
      />
    </div>
  );
};
