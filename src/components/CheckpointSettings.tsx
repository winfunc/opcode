import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Wrench,
  Save,
  Trash2,
  HardDrive,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SelectComponent, type SelectOption } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { api, type CheckpointStrategy } from "@/lib/api";
import { cn } from "@/lib/utils";

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
    { value: "manual", label: "Manual Only" },
    { value: "per_prompt", label: "After Each Prompt" },
    { value: "per_tool_use", label: "After Tool Use" },
    { value: "smart", label: "Smart (Recommended)" },
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
      setError("Failed to load checkpoint settings");
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
      
      setSuccessMessage("Settings saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save checkpoint settings:", err);
      setError("Failed to save checkpoint settings");
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
      
      setSuccessMessage(`Removed ${removed} old checkpoints`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Reload settings to get updated count
      await loadSettings();
    } catch (err) {
      console.error("Failed to cleanup checkpoints:", err);
      setError("Failed to cleanup checkpoints");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className={cn("space-y-4", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Wrench className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-heading-4 font-semibold">Checkpoint Settings</h3>
            <p className="text-caption text-muted-foreground mt-0.5">Manage session checkpoints and recovery</p>
          </div>
        </div>
      </div>

      {/* Experimental Feature Warning */}
      <div className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-3">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            <p className="text-caption font-medium text-amber-900 dark:text-amber-100">Experimental Feature</p>
            <p className="text-caption text-amber-700 dark:text-amber-300">
              Checkpointing may affect directory structure or cause data loss. Use with caution.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-caption text-destructive">{error}</span>
          </div>
        </motion.div>
      )}

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="rounded-md border border-green-600/50 bg-green-50 dark:bg-green-950/20 p-3"
        >
          <span className="text-caption text-green-700 dark:text-green-400">{successMessage}</span>
        </motion.div>
      )}

      {/* Main Settings Card */}
      <Card className="p-5 space-y-4">
        {/* Auto-checkpoint toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-checkpoint" className="text-label">Automatic Checkpoints</Label>
            <p className="text-caption text-muted-foreground">
              Automatically create checkpoints based on the selected strategy
            </p>
          </div>
          <Switch
            id="auto-checkpoint"
            checked={autoCheckpointEnabled}
            onCheckedChange={setAutoCheckpointEnabled}
            disabled={isLoading}
          />
        </div>

        {/* Checkpoint strategy */}
        <div className="space-y-2">
          <Label htmlFor="strategy" className="text-label">Checkpoint Strategy</Label>
          <SelectComponent
            value={checkpointStrategy}
            onValueChange={(value: string) => setCheckpointStrategy(value as CheckpointStrategy)}
            options={strategyOptions}
            disabled={isLoading || !autoCheckpointEnabled}
          />
          <p className="text-caption text-muted-foreground">
            {checkpointStrategy === "manual" && "Checkpoints will only be created manually"}
            {checkpointStrategy === "per_prompt" && "A checkpoint will be created after each user prompt"}
            {checkpointStrategy === "per_tool_use" && "A checkpoint will be created after each tool use"}
            {checkpointStrategy === "smart" && "Checkpoints will be created after destructive operations"}
          </p>
        </div>

        {/* Save button */}
        <motion.div
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.15 }}
        >
          <Button
            onClick={handleSaveSettings}
            disabled={isLoading || isSaving}
            className="w-full"
            size="default"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </motion.div>
      </Card>

      {/* Storage Management Card */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <Label className="text-label">Storage Management</Label>
            </div>
            <p className="text-caption text-muted-foreground">
              Total checkpoints: <span className="font-medium text-foreground">{totalCheckpoints}</span>
            </p>
          </div>
        </div>

        {/* Cleanup settings */}
        <div className="space-y-2">
          <Label htmlFor="keep-count" className="text-label">Keep Recent Checkpoints</Label>
          <div className="flex gap-2">
            <Input
              id="keep-count"
              type="number"
              min="1"
              max="100"
              value={keepCount}
              onChange={(e) => setKeepCount(parseInt(e.target.value) || 10)}
              disabled={isLoading}
              className="flex-1 h-9"
            />
            <motion.div
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                variant="outline"
                onClick={handleCleanup}
                disabled={isLoading || totalCheckpoints <= keepCount}
                size="sm"
                className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Clean Up
              </Button>
            </motion.div>
          </div>
          <p className="text-caption text-muted-foreground">
            Remove old checkpoints, keeping only the most recent {keepCount}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}; 