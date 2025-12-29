import React, { useState, useEffect } from "react";
import { Layers, ChevronUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip-modern";
import { api, type ClaudeSettings, type EnvGroup } from "@/lib/api";

interface EnvGroupSelectorProps {
  disabled?: boolean;
}

/**
 * Environment Group Selector Component
 * Allows users to quickly switch between different environment variable groups
 */
export const EnvGroupSelector: React.FC<EnvGroupSelectorProps> = ({
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [envGroups, setEnvGroups] = useState<Record<string, EnvGroup>>({});
  const [activeGroupId, setActiveGroupId] = useState<string>("default");
  const [isLoading, setIsLoading] = useState(true);

  // Load environment groups on mount
  useEffect(() => {
    const loadEnvGroups = async () => {
      try {
        setIsLoading(true);
        const settings = await api.getClaudeSettings();

        if (settings.envGroups && typeof settings.envGroups === "object") {
          setEnvGroups(settings.envGroups);
          setActiveGroupId(settings.activeEnvGroup || "default");
        } else {
          // Initialize with default group if none exist
          const defaultGroup: EnvGroup = {
            name: "Default",
            variables: settings.env || {},
          };
          setEnvGroups({ default: defaultGroup });
          setActiveGroupId("default");
        }
      } catch (error) {
        console.error("Failed to load environment groups:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEnvGroups();
  }, []);

  const handleSelectGroup = async (groupId: string) => {
    try {
      setActiveGroupId(groupId);
      setIsOpen(false);

      // Save the active group selection
      const currentSettings = await api.getClaudeSettings();
      const updatedSettings: ClaudeSettings = {
        ...currentSettings,
        activeEnvGroup: groupId,
        // Also update the env field for backward compatibility
        env: envGroups[groupId]?.variables || {},
      };
      await api.saveClaudeSettings(updatedSettings);
    } catch (error) {
      console.error("Failed to save active environment group:", error);
    }
  };

  const activeGroup = envGroups[activeGroupId];
  const groupCount = Object.keys(envGroups).length;
  const varCount = activeGroup
    ? Object.keys(activeGroup.variables || {}).length
    : 0;

  // Don't render if still loading or no groups
  if (isLoading) {
    return null;
  }

  return (
    <Popover
      trigger={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="h-9 px-2 hover:bg-accent/50 gap-1"
            >
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold opacity-70 max-w-[60px] truncate">
                {activeGroup?.name || "Default"}
              </span>
              <ChevronUp className="h-3 w-3 ml-0.5 opacity-50" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs font-medium">
              Environment: {activeGroup?.name || "Default"}
            </p>
            <p className="text-xs text-muted-foreground">
              {varCount} variable{varCount !== 1 ? "s" : ""} • {groupCount}{" "}
              group
              {groupCount !== 1 ? "s" : ""}
            </p>
          </TooltipContent>
        </Tooltip>
      }
      content={
        <div className="w-[240px] p-1">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Environment Groups
          </div>
          {Object.entries(envGroups).map(([groupId, group]) => (
            <button
              key={groupId}
              onClick={() => handleSelectGroup(groupId)}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-md transition-colors text-left",
                "hover:bg-accent",
                activeGroupId === groupId && "bg-accent"
              )}
            >
              <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{group.name}</div>
                <div className="text-xs text-muted-foreground">
                  {Object.keys(group.variables || {}).length} variable
                  {Object.keys(group.variables || {}).length !== 1 ? "s" : ""}
                </div>
              </div>
              {activeGroupId === groupId && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      }
      open={isOpen}
      onOpenChange={setIsOpen}
      align="start"
      side="top"
    />
  );
};
