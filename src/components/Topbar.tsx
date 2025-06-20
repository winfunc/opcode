import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Circle, FileText, Settings, ExternalLink, BarChart3, Network, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { api, type ClaudeVersionStatus, type ClaudeInstallation } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TopbarProps {
  /**
   * Callback when CLAUDE.md is clicked
   */
  onClaudeClick: () => void;
  /**
   * Callback when Settings is clicked
   */
  onSettingsClick: () => void;
  /**
   * Callback when Usage Dashboard is clicked
   */
  onUsageClick: () => void;
  /**
   * Callback when MCP is clicked
   */
  onMCPClick: () => void;
  /**
   * Callback when Info is clicked
   */
  onInfoClick: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Topbar component with status indicator and navigation buttons
 * 
 * @example
 * <Topbar
 *   onClaudeClick={() => setView('editor')}
 *   onSettingsClick={() => setView('settings')}
 *   onUsageClick={() => setView('usage-dashboard')}
 *   onMCPClick={() => setView('mcp')}
 * />
 */
export const Topbar: React.FC<TopbarProps> = ({
  onClaudeClick,
  onSettingsClick,
  onUsageClick,
  onMCPClick,
  onInfoClick,
  className,
}) => {
  const [versionStatus, setVersionStatus] = useState<ClaudeVersionStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [multipleVersionsAvailable, setMultipleVersionsAvailable] = useState(false);
  const [installations, setInstallations] = useState<ClaudeInstallation[]>([]);
  
  // Check Claude version on mount and when installation changes
  useEffect(() => {
    checkVersion();
    
    // Listen for Claude installation changes
    const handleInstallationChange = () => {
      console.log("Claude installation changed, refreshing version check...");
      checkVersion();
    };
    
    window.addEventListener('claude-installation-changed', handleInstallationChange);
    
    return () => {
      window.removeEventListener('claude-installation-changed', handleInstallationChange);
    };
  }, []);
  
  const checkVersion = async () => {
    try {
      setChecking(true);
      const [status, discoveredInstallations] = await Promise.all([
        api.checkClaudeVersion(),
        api.discoverClaudeInstallations()
      ]);
      
      setVersionStatus(status);
      setInstallations(discoveredInstallations);
      
      // Check if multiple versions are available
      const verifiedInstallations = discoveredInstallations.filter(inst => inst.is_verified);
      setMultipleVersionsAvailable(verifiedInstallations.length > 1);
      
      // If Claude is not installed and the error indicates it wasn't found
      if (!status.is_installed && status.output.includes("No such file or directory")) {
        // Emit an event that can be caught by the parent
        window.dispatchEvent(new CustomEvent('claude-not-found'));
      }
    } catch (err) {
      console.error("Failed to check Claude version:", err);
      setVersionStatus({
        is_installed: false,
        output: "Failed to check version",
      });
      setInstallations([]);
      setMultipleVersionsAvailable(false);
    } finally {
      setChecking(false);
    }
  };
  
  const StatusIndicator = () => {
    if (checking) {
      return (
        <div className="flex items-center space-x-2 text-xs">
          <Circle className="h-3 w-3 animate-pulse text-muted-foreground" />
          <span className="text-muted-foreground">Checking...</span>
        </div>
      );
    }
    
    if (!versionStatus) return null;
    
    const statusContent = (
      <div className="flex items-center space-x-2 text-xs">
        <Circle
          className={cn(
            "h-3 w-3",
            versionStatus.is_installed 
              ? "fill-green-500 text-green-500" 
              : "fill-red-500 text-red-500"
          )}
        />
        <span>
          {versionStatus.is_installed && versionStatus.version
            ? `Claude Code ${versionStatus.version}`
            : "Claude Code"}
        </span>
        {multipleVersionsAvailable && (
          <AlertTriangle className="h-3 w-3 text-orange-500" />
        )}
      </div>
    );
    
    if (!versionStatus.is_installed) {
      return (
        <Popover
          trigger={statusContent}
          content={
            <div className="space-y-3 max-w-xs">
              <p className="text-sm font-medium">Claude Code not found</p>
              <div className="rounded-md bg-muted p-3">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {versionStatus.output}
                </pre>
              </div>
              <a
                href="https://www.anthropic.com/claude-code"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-xs text-primary hover:underline"
              >
                <span>Install Claude Code</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          }
          align="start"
        />
      );
    }
    
    // Show popover with multiple versions info if applicable
    if (multipleVersionsAvailable) {
      const verifiedInstallations = installations.filter(inst => inst.is_verified);
      return (
        <Popover
          trigger={statusContent}
          content={
            <div className="space-y-3 max-w-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <p className="text-sm font-medium">Multiple Claude Versions Available</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Found {verifiedInstallations.length} verified Claude Code installations. 
                Consider reviewing your installation selection for consistency.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-medium">Available versions:</p>
                <div className="space-y-1">
                  {verifiedInstallations.slice(0, 3).map((installation, index) => (
                    <div key={index} className="text-xs bg-muted p-2 rounded border-l-2 border-blue-500">
                      <div className="font-mono truncate">{installation.source}</div>
                      <div className="text-muted-foreground truncate text-[10px]">{installation.path}</div>
                      {installation.version && (
                        <div className="text-muted-foreground text-[10px]">v{installation.version}</div>
                      )}
                    </div>
                  ))}
                  {verifiedInstallations.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      ...and {verifiedInstallations.length - 3} more
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onSettingsClick}
                className="w-full gap-2 text-xs"
              >
                <Settings className="h-3 w-3" />
                Manage Installations
              </Button>
            </div>
          }
          align="start"
        />
      );
    }
    
    return statusContent;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      {/* Status Indicator */}
      <StatusIndicator />
      
      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUsageClick}
          className="text-xs"
        >
          <BarChart3 className="mr-2 h-3 w-3" />
          Usage Dashboard
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onClaudeClick}
          className="text-xs"
        >
          <FileText className="mr-2 h-3 w-3" />
          CLAUDE.md
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onMCPClick}
          className="text-xs"
        >
          <Network className="mr-2 h-3 w-3" />
          MCP
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onSettingsClick}
          className="text-xs"
        >
          <Settings className="mr-2 h-3 w-3" />
          Settings
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onInfoClick}
          className="h-8 w-8"
          title="About"
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}; 