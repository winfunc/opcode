import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layers, ChevronUp, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip-modern";
import { api, type EnvGroup, type ClaudeSettings } from "@/lib/api";
import { cn } from "@/lib/utils";

interface EnvGroupSelectorProps {
  /**
   * Whether the selector is disabled
   */
  disabled?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * EnvGroupSelector component - Allows quick switching between environment variable groups
 * in the chat interface
 */
export const EnvGroupSelector: React.FC<EnvGroupSelectorProps> = ({
  disabled = false,
  className,
}) => {
  const [envGroups, setEnvGroups] = useState<Record<string, EnvGroup>>({});
  const [activeGroupId, setActiveGroupId] = useState<string>("default");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load environment groups on mount
  useEffect(() => {
    loadEnvGroups();
  }, []);

  const loadEnvGroups = async () => {
    try {
      setLoading(true);
      const settings = await api.getClaudeSettings();

      if (settings.envGroups && typeof settings.envGroups === "object") {
        setEnvGroups(settings.envGroups);
        setActiveGroupId(settings.activeEnvGroup || "default");
      } else if (settings.env && typeof settings.env === "object") {
        // Migrate from legacy format
        const defaultGroup: EnvGroup = {
          name: "Default",
          variables: settings.env as Record<string, string>,
        };
        setEnvGroups({ default: defaultGroup });
        setActiveGroupId("default");
      } else {
        // No groups configured
        const defaultGroup: EnvGroup = {
          name: "Default",
          variables: {},
        };
        setEnvGroups({ default: defaultGroup });
        setActiveGroupId("default");
      }
    } catch (err) {
      console.error("Failed to load environment groups:", err);
    } finally {
      setLoading(false);
    }
  };

  const switchActiveGroup = async (groupId: string) => {
    if (groupId === activeGroupId) {
      setPickerOpen(false);
      return;
    }

    try {
      setSaving(true);

      // Load current settings
      const settings = await api.getClaudeSettings();

      // Update active group and env field
      const activeGroup = envGroups[groupId];
      const updatedSettings: ClaudeSettings = {
        ...settings,
        activeEnvGroup: groupId,
        env: activeGroup?.variables || {},
      };

      await api.saveClaudeSettings(updatedSettings);
      setActiveGroupId(groupId);
      setPickerOpen(false);
    } catch (err) {
      console.error("Failed to switch environment group:", err);
    } finally {
      setSaving(false);
    }
  };

  const activeGroup = envGroups[activeGroupId];
  const groupCount = Object.keys(envGroups).length;

  // Don't render if no groups or only default with no variables
  if (groupCount === 0) {
    return null;
  }

  // If only one group exists and it has no variables, don't show the selector
  if (
    groupCount === 1 &&
    activeGroup &&
    Object.keys(activeGroup.variables || {}).length === 0
  ) {
    return null;
  }

  return (
    <Popover
      trigger={
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled || loading}
                className={cn("h-9 px-2 hover:bg-accent/50 gap-1", className)}
              >
                {loading || saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Layers className="h-3.5 w-3.5 text-primary" />
                )}
                <span className="text-[10px] font-bold opacity-70 max-w-[60px] truncate">
                  {activeGroup?.name || "ENV"}
                </span>
                <ChevronUp className="h-3 w-3 ml-0.5 opacity-50" />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs font-medium">
              Environment: {activeGroup?.name || "Default"}
            </p>
            <p className="text-xs text-muted-foreground">
              {Object.keys(activeGroup?.variables || {}).length} variables
              configured
            </p>
          </TooltipContent>
        </Tooltip>
      }
      content={
        <div className="w-[240px] p-1">
          <div className="px-2 py-1.5 mb-1">
            <p className="text-xs font-medium text-muted-foreground">
              Environment Groups
            </p>
          </div>
          {Object.entries(envGroups).map(([groupId, group]) => (
            <button
              key={groupId}
              onClick={() => switchActiveGroup(groupId)}
              disabled={saving}
              className={cn(
                "w-full flex items-center justify-between gap-2 p-2.5 rounded-md transition-colors text-left",
                "hover:bg-accent",
                activeGroupId === groupId && "bg-accent"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {group.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Object.keys(group.variables || {}).length} variables
                  </div>
                </div>
              </div>
              {activeGroupId === groupId && (
                <Check className="h-4 w-4 flex-shrink-0 text-green-500" />
              )}
            </button>
          ))}
          <div className="border-t mt-1 pt-1 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">
              Manage groups in Settings → Environment
            </p>
          </div>
        </div>
      }
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      align="start"
      side="top"
    />
  );
};
