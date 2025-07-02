import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Settings,
  Save,
  Trash2,
  HardDrive,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SelectComponent, type SelectOption } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { api, type CheckpointStrategy } from "@/lib/api";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

interface CheckpointSettingsProps {
  sessionId: string;
  projectId: string;
  projectPath: string;
  onClose?: () => void;
  className?: string;
}

/**
 * CheckpointSettings component for managing checkpoint configuration
 * 
 * @example
 * <CheckpointSettings 
 *   sessionId={session.id}
 *   projectId={session.project_id}
 *   projectPath={projectPath}
 * />
 */
export const CheckpointSettings: React.FC<CheckpointSettingsProps> = ({
  sessionId,
  projectId,
  projectPath,
  onClose,
  className,
}) => {
  const [autoCheckpointEnabled, setAutoCheckpointEnabled] = useState(true);
  const [checkpointStrategy, setCheckpointStrategy] = useState<CheckpointStrategy>("smart");
  const [totalCheckpoints, setTotalCheckpoints] = useState(0);
  const [keepCount, setKeepCount] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const strategyOptions: SelectOption[] = [
    { value: "manual", label: t('manualOnly') },
    { value: "per_prompt", label: t('afterEachPrompt') },
    { value: "per_tool_use", label: t('afterToolUse') },
    { value: "smart", label: t('smartRecommended') },
  ];

  useEffect(() => {
    loadSettings();
  }, [sessionId, projectId, projectPath]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const settings = await api.getCheckpointSettings(sessionId, projectId, projectPath);
      setAutoCheckpointEnabled(settings.auto_checkpoint_enabled);
      setCheckpointStrategy(settings.checkpoint_strategy);
      setTotalCheckpoints(settings.total_checkpoints);
    } catch (err) {
      console.error("Failed to load checkpoint settings:", err);
      setError(t('failedToLoadCheckpointSettings'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);
      
      await api.updateCheckpointSettings(
        sessionId,
        projectId,
        projectPath,
        autoCheckpointEnabled,
        checkpointStrategy
      );
      
      setSuccessMessage(t('settingsSavedSuccessfully'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save checkpoint settings:", err);
      setError(t('failedToSaveCheckpointSettings'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCleanup = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      const removed = await api.cleanupOldCheckpoints(
        sessionId,
        projectId,
        projectPath,
        keepCount
      );
      
      setSuccessMessage(`${t('removedOldCheckpoints').replace('{count}', removed.toString())}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Reload settings to get updated count
      await loadSettings();
    } catch (err) {
      console.error("Failed to cleanup checkpoints:", err);
      setError(t('failedToCleanupCheckpoints'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn("space-y-6", className)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <h3 className="text-lg font-semibold">{t('checkpointSettings')}</h3>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('closeButton')}
          </Button>
        )}
      </div>

      {/* Experimental Feature Warning */}
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-yellow-600">{t('experimentalFeature')}</p>
            <p className="text-yellow-600/80">
              {t('checkpointingMayAffectStructure')}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </motion.div>
      )}

      {successMessage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-xs text-green-600"
        >
          {successMessage}
        </motion.div>
      )}

      <div className="space-y-4">
        {/* Auto-checkpoint toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-checkpoint">{t('automaticCheckpoints')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('automaticallyCreateCheckpoints')}
            </p>
          </div>
          <Switch
            id="auto-checkpoint"
            checked={autoCheckpointEnabled}
            onCheckedChange={setAutoCheckpointEnabled}
            disabled={isLoading}
          />
        </div>

        {/* Strategy selection */}
        {autoCheckpointEnabled && (
          <div className="space-y-2">
            <Label htmlFor="checkpoint-strategy">{t('checkpointStrategy')}</Label>
            <SelectComponent
              value={checkpointStrategy}
              onValueChange={(value: string) => setCheckpointStrategy(value as CheckpointStrategy)}
              options={strategyOptions}
              disabled={isLoading}
            />
            <div className="text-xs text-muted-foreground">
              {checkpointStrategy === "manual" && t('checkpointsWillOnlyBeCreatedManually')}
              {checkpointStrategy === "per_prompt" && t('checkpointWillBeCreatedAfterEachPrompt')}
              {checkpointStrategy === "per_tool_use" && t('checkpointWillBeCreatedAfterToolUse')}
              {checkpointStrategy === "smart" && t('checkpointsWillBeCreatedAfterDestructive')}
            </div>
          </div>
        )}

        {/* Storage Management */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="h-4 w-4" />
            <h4 className="text-sm font-medium">{t('storageManagement')}</h4>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>{t('totalCheckpoints')}</span>
              <span className="font-mono">{totalCheckpoints}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Label htmlFor="keep-count" className="text-sm">{t('keepMostRecent')}</Label>
              <Input
                id="keep-count"
                type="number"
                min="1"
                max="100"
                value={keepCount}
                onChange={(e) => setKeepCount(parseInt(e.target.value) || 10)}
                className="w-20 h-8"
                disabled={isLoading}
              />
              <Button
                onClick={handleCleanup}
                disabled={isLoading || totalCheckpoints <= keepCount}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Trash2 className="h-3 w-3" />
                {t('cleanupNow')}
              </Button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving || isLoading}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}; 