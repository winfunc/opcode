import React from "react";
import { Shield, FileText, Upload, Network, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { type Agent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

interface AgentSandboxSettingsProps {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
  className?: string;
}

/**
 * Component for managing per-agent sandbox permissions
 * Provides simple toggles for sandbox enable/disable and file/network permissions
 */
export const AgentSandboxSettings: React.FC<AgentSandboxSettingsProps> = ({ 
  agent, 
  onUpdate, 
  className 
}) => {
  const handleToggle = (field: keyof Agent, value: boolean) => {
    onUpdate({ [field]: value });
  };

  return (
    <Card className={cn("p-4 space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-amber-500" />
        <h4 className="font-semibold">{t('sandboxPermissions')}</h4>
        {!agent.sandbox_enabled && (
          <Badge variant="secondary" className="text-xs">
            {t('disabled')}
          </Badge>
        )}
      </div>
      
      <div className="space-y-3">
        {/* Master sandbox toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="space-y-1">
            <Label className="text-sm font-medium">{t('enableSandbox')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('runThisAgentInSecureSandboxEnvironment')}
            </p>
          </div>
          <Switch 
            checked={agent.sandbox_enabled} 
            onCheckedChange={(checked) => handleToggle('sandbox_enabled', checked)}
          />
        </div>

        {/* Permission toggles - only visible when sandbox is enabled */}
        {agent.sandbox_enabled && (
          <div className="space-y-3 pl-4 border-l-2 border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <div>
                  <Label className="text-sm font-medium">{t('fileReadAccess')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('allowReadingFilesAndDirectories')}
                  </p>
                </div>
              </div>
              <Switch 
                checked={agent.enable_file_read} 
                onCheckedChange={(checked) => handleToggle('enable_file_read', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-green-500" />
                <div>
                  <Label className="text-sm font-medium">{t('fileWriteAccess')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('allowCreatingAndModifyingFiles')}
                  </p>
                </div>
              </div>
              <Switch 
                checked={agent.enable_file_write} 
                onCheckedChange={(checked) => handleToggle('enable_file_write', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-purple-500" />
                <div>
                  <Label className="text-sm font-medium">{t('networkAccess')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('allowOutboundNetworkConnections')}
                  </p>
                </div>
              </div>
              <Switch 
                checked={agent.enable_network} 
                onCheckedChange={(checked) => handleToggle('enable_network', checked)}
              />
            </div>
          </div>
        )}

        {/* Warning when sandbox is disabled */}
        {!agent.sandbox_enabled && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-medium">Sandbox Disabled</p>
              <p>This agent will run with full system access. Use with caution.</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};