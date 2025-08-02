import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api, type ClaudeInstallation } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CheckCircle, HardDrive, Settings, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { handleError } from "@/lib/errorHandler";
import { logger } from "@/lib/logger";

/**
 * Props interface for the ClaudeVersionSelector component
 */
interface ClaudeVersionSelectorProps {
  /**
   * Currently selected installation path
   */
  selectedPath?: string | null;
  /**
   * Callback when an installation is selected
   */
  onSelect: (installation: ClaudeInstallation) => void;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Whether to show the save button
   */
  showSaveButton?: boolean;
  /**
   * Callback when save is clicked
   */
  onSave?: () => void;
  /**
   * Whether save is in progress
   */
  isSaving?: boolean;
}

/**
 * ClaudeVersionSelector component for selecting Claude Code installations
 * Supports bundled sidecar, system installations, and user preferences
 *
 * @example
 * <ClaudeVersionSelector
 *   selectedPath={currentPath}
 *   onSelect={(installation) => setSelectedInstallation(installation)}
 * />
 */
/**
 * ClaudeVersionSelector component for selecting Claude Code installations
 *
 * A comprehensive interface for detecting, selecting, and managing Claude Code
 * binary installations. Features automatic detection, installation validation,
 * version information display, and configuration management with real-time
 * status updates and error handling.
 *
 * @param selectedPath - Currently selected installation path
 * @param onSelect - Callback when an installation is selected
 * @param className - Optional className for styling
 *
 * @example
 * ```tsx
 * <ClaudeVersionSelector
 *   selectedPath={currentInstallation?.path}
 *   onSelect={(installation) => {
 *     console.log('Selected installation:', installation.version);
 *     setCurrentInstallation(installation);
 *     saveToSettings(installation);
 *   }}
 *   className="max-w-2xl"
 * />
 * ```
 */
// Cache for installations to avoid repeated detection
let installationsCache: ClaudeInstallation[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30000; // 30 seconds cache

export const ClaudeVersionSelector: React.FC<ClaudeVersionSelectorProps> = ({
  selectedPath,
  onSelect,
  className,
  showSaveButton = false,
  onSave,
  isSaving = false,
}) => {
  const { t } = useI18n();
  const [installations, setInstallations] = useState<ClaudeInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<ClaudeInstallation | null>(null);

  /**
   * Load available Claude installations from the system
   */
  const loadInstallations = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let foundInstallations: ClaudeInstallation[];

      // Use cache if available and not expired, unless explicitly refreshing
      const now = Date.now();
      if (!isRefresh && installationsCache && (now - cacheTimestamp) < CACHE_DURATION) {
        foundInstallations = installationsCache;
        logger.debug("Using cached Claude installations");
      } else {
        // Fetch fresh installations and update cache
        foundInstallations = await api.listClaudeInstallations();
        installationsCache = foundInstallations;
        cacheTimestamp = now;
        logger.debug("Fetched fresh Claude installations and updated cache");
      }

      setInstallations(foundInstallations);

      // If we have a selected path, find and select it
      if (selectedPath) {
        const found = foundInstallations.find((i) => i.path === selectedPath);
        if (found) {
          setSelectedInstallation(found);
        }
      } else if (foundInstallations.length > 0) {
        // Auto-select the first (best) installation
        setSelectedInstallation(foundInstallations[0]);
        onSelect(foundInstallations[0]);
      }
    } catch (err) {
      await handleError("Failed to load Claude installations:", { context: err });
      setError(err instanceof Error ? err.message : "Failed to load Claude installations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onSelect, selectedPath]);

  /**
   * Handle installation selection change
   *
   * @param installationPath - Path of the selected installation
   */
  const handleInstallationChange = useCallback(
    (installationPath: string) => {
      const installation = installations.find((i) => i.path === installationPath);
      if (installation) {
        setSelectedInstallation(installation);
        onSelect(installation);
      }
    },
    [installations, onSelect]
  );

  /**
   * Get appropriate icon for installation type
   *
   * @param installation - Installation object to get icon for
   * @returns Lucide icon component
   */
  const getInstallationIcon = (installation: ClaudeInstallation) => {
    switch (installation.installation_type) {
      case "System":
        return <HardDrive className="h-4 w-4" />;
      case "Custom":
        return <Settings className="h-4 w-4" />;
      default:
        return <HardDrive className="h-4 w-4" />;
    }
  };

  // Only load installations once when component mounts, not on every render
  useEffect(() => {
    loadInstallations(false);
  }, [loadInstallations]); // Include loadInstallations dependency

  useEffect(() => {
    // Update selected installation when selectedPath changes
    if (selectedPath && installations.length > 0) {
      const found = installations.find((i) => i.path === selectedPath);
      if (found) {
        setSelectedInstallation(found);
      }
    }
  }, [selectedPath, installations]);

  /**
   * Get color class for installation type badge
   *
   * @param installation - Installation object to get color for
   * @returns CSS color class name
   */
  const getInstallationTypeColor = (installation: ClaudeInstallation) => {
    switch (installation.installation_type) {
      case "Bundled":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "System":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Custom":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t.settings.claudeInstallation}</CardTitle>
          <CardDescription>{t.settings.loadingInstallations}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t.settings.claudeInstallation}</CardTitle>
          <CardDescription>Error loading installations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive mb-4">{error}</div>
          <Button onClick={() => loadInstallations(false)} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const bundledInstallations = installations.filter((i) => i.installation_type === "Bundled");
  const systemInstallations = installations.filter((i) => i.installation_type === "System");
  const customInstallations = installations.filter((i) => i.installation_type === "Custom");

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            {t.settings.claudeInstallation}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadInstallations(true)}
            disabled={loading || refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? t.common.loading : t.settings.refresh}
          </Button>
        </CardTitle>
        <CardDescription>{t.settings.choosePreferredInstallation}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Available Installations */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t.settings.availableInstallations}</Label>
          <Select value={selectedInstallation?.path || ""} onValueChange={handleInstallationChange}>
            <SelectTrigger>
              <SelectValue placeholder={t.settings.selectClaudeInstallation}>
                {selectedInstallation && (
                  <div className="flex items-center gap-2">
                    {getInstallationIcon(selectedInstallation)}
                    <span className="truncate">{selectedInstallation.path}</span>
                    <Badge
                      variant="secondary"
                      className={cn("text-xs", getInstallationTypeColor(selectedInstallation))}
                    >
                      {selectedInstallation.installation_type}
                    </Badge>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {bundledInstallations.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {t.settings.bundled}
                  </div>
                  {bundledInstallations.map((installation) => (
                    <SelectItem key={installation.path} value={installation.path}>
                      <div className="flex items-center gap-2 w-full">
                        {getInstallationIcon(installation)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{t.settings.claudeCodeBundled}</div>
                          <div className="text-xs text-muted-foreground">
                            {installation.version || "Version unknown"} • {installation.source}
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", getInstallationTypeColor(installation))}
                        >
                          Recommended
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}

              {systemInstallations.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    System Installations
                  </div>
                  {systemInstallations.map((installation) => (
                    <SelectItem key={installation.path} value={installation.path}>
                      <div className="flex items-center gap-2 w-full">
                        {getInstallationIcon(installation)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{installation.path}</div>
                          <div className="text-xs text-muted-foreground">
                            {installation.version || "Version unknown"} • {installation.source}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          System
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}

              {customInstallations.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Custom Installations
                  </div>
                  {customInstallations.map((installation) => (
                    <SelectItem key={installation.path} value={installation.path}>
                      <div className="flex items-center gap-2 w-full">
                        {getInstallationIcon(installation)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{installation.path}</div>
                          <div className="text-xs text-muted-foreground">
                            {installation.version || "Version unknown"} • {installation.source}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Custom
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Installation Details */}
        {selectedInstallation && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t.settings.selectedInstallation}</span>
              <Badge className={cn("text-xs", getInstallationTypeColor(selectedInstallation))}>
                {selectedInstallation.installation_type}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <div>
                <strong>{t.settings.path}:</strong> {selectedInstallation.path}
              </div>
              <div>
                <strong>{t.settings.source}:</strong> {selectedInstallation.source}
              </div>
              {selectedInstallation.version && (
                <div>
                  <strong>{t.settings.version}:</strong> {selectedInstallation.version}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save Button */}
        {showSaveButton && (
          <Button onClick={onSave} disabled={isSaving || !selectedInstallation} className="w-full">
            {isSaving ? t.common.loading : t.settings.saveSettings}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
