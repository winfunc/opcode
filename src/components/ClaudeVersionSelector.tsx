import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api, type ClaudeInstallation } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CheckCircle, HardDrive, Settings, Terminal, Info } from "lucide-react";

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
  /**
   * Simplified mode for cleaner UI
   */
  simplified?: boolean;
}

/**
 * ClaudeVersionSelector component for selecting Claude Code installations
 * Supports system installations and user preferences
 * 
 * @example
 * <ClaudeVersionSelector
 *   selectedPath={currentPath}
 *   onSelect={(installation) => setSelectedInstallation(installation)}
 * />
 */
export const ClaudeVersionSelector: React.FC<ClaudeVersionSelectorProps> = ({
  selectedPath,
  onSelect,
  className,
  showSaveButton = false,
  onSave,
  isSaving = false,
  simplified = false,
}) => {
  const [installations, setInstallations] = useState<ClaudeInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<ClaudeInstallation | null>(null);

  useEffect(() => {
    loadInstallations();
  }, []);

  useEffect(() => {
    // Update selected installation when selectedPath changes
    if (selectedPath && installations.length > 0) {
      const found = installations.find(i => i.path === selectedPath);
      if (found) {
        setSelectedInstallation(found);
      }
    }
  }, [selectedPath, installations]);

  const loadInstallations = async () => {
    try {
      setLoading(true);
      setError(null);
      const foundInstallations = await api.listClaudeInstallations();
      setInstallations(foundInstallations);
      
      // If we have a selected path, find and select it
      if (selectedPath) {
        const found = foundInstallations.find(i => i.path === selectedPath);
        if (found) {
          setSelectedInstallation(found);
        }
      } else if (foundInstallations.length > 0) {
        // Auto-select the first (best) installation
        setSelectedInstallation(foundInstallations[0]);
        onSelect(foundInstallations[0]);
      }
    } catch (err) {
      console.error("Failed to load Claude installations:", err);
      setError(err instanceof Error ? err.message : "Failed to load Claude installations");
    } finally {
      setLoading(false);
    }
  };

  const handleInstallationChange = (installationPath: string) => {
    const installation = installations.find(i => i.path === installationPath);
    if (installation) {
      setSelectedInstallation(installation);
      onSelect(installation);
    }
  };

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

  const getInstallationTypeColor = (installation: ClaudeInstallation) => {
    switch (installation.installation_type) {
      case "System":
        return "default";
      case "Custom":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    if (simplified) {
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Claude Installation</Label>
          <div className="flex items-center justify-center py-3 border rounded-lg">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        </div>
      );
    }
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Claude Code Installation</CardTitle>
          <CardDescription>Loading available installations...</CardDescription>
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
    if (simplified) {
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Claude Installation</Label>
          <div className="p-3 border border-destructive/50 rounded-lg bg-destructive/10">
            <p className="text-sm text-destructive mb-2">{error}</p>
            <Button onClick={loadInstallations} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </div>
      );
    }
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Claude Code Installation</CardTitle>
          <CardDescription>Error loading installations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive mb-4">{error}</div>
          <Button onClick={loadInstallations} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const systemInstallations = installations.filter(i => i.installation_type === "System");
  const customInstallations = installations.filter(i => i.installation_type === "Custom");

  // Simplified mode - more streamlined UI
  if (simplified) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="claude-installation" className="text-sm font-medium">Claude Installation</Label>
            <p className="text-xs text-muted-foreground">
              Select which version of Claude to use
            </p>
          </div>
          {selectedInstallation && (
            <Badge variant={getInstallationTypeColor(selectedInstallation)} className="text-xs">
              {selectedInstallation.installation_type}
            </Badge>
          )}
        </div>
        
        <Select value={selectedInstallation?.path || ""} onValueChange={handleInstallationChange}>
          <SelectTrigger id="claude-installation" className="w-full">
            <SelectValue placeholder="Choose Claude installation">
              {selectedInstallation && (
                <div className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-sm">{selectedInstallation.path.split('/').pop() || selectedInstallation.path}</span>
                  {selectedInstallation.version && (
                    <span className="text-xs text-muted-foreground">({selectedInstallation.version})</span>
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent side="bottom" align="start" sideOffset={5}>
            {installations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No Claude installations found
              </div>
            ) : (
              <>
                {installations.map((installation) => (
                  <SelectItem key={installation.path} value={installation.path} className="cursor-pointer hover:bg-accent focus:bg-accent">
                    <div className="flex items-center gap-2 py-1">
                      <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-mono text-sm">{installation.path}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{installation.version || "Unknown version"}</span>
                          <span>•</span>
                          <span>{installation.source}</span>
                          <Badge variant={getInstallationTypeColor(installation)} className="text-xs ml-2">
                            {installation.installation_type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        
        {selectedInstallation && (
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Path:</span> <code className="font-mono">{selectedInstallation.path}</code>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Original card-based UI
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Claude Code Installation
        </CardTitle>
        <CardDescription>
          Choose your preferred Claude Code installation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Available Installations */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Available Installations</Label>
          <Select value={selectedInstallation?.path || ""} onValueChange={handleInstallationChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select Claude installation">
                {selectedInstallation && (
                  <div className="flex items-center gap-2">
                    {getInstallationIcon(selectedInstallation)}
                    <span className="truncate">{selectedInstallation.path}</span>
                    <Badge variant={getInstallationTypeColor(selectedInstallation)} className="text-xs">
                      {selectedInstallation.installation_type}
                    </Badge>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent side="bottom" align="start" sideOffset={5}>
              {systemInstallations.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">System Installations</div>
                  {systemInstallations.map((installation) => (
                    <SelectItem key={installation.path} value={installation.path} className="cursor-pointer hover:bg-accent focus:bg-accent">
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
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Custom Installations</div>
                  {customInstallations.map((installation) => (
                    <SelectItem key={installation.path} value={installation.path} className="cursor-pointer hover:bg-accent focus:bg-accent">
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
              <span className="text-sm font-medium">Selected Installation</span>
              <Badge variant={getInstallationTypeColor(selectedInstallation)} className="text-xs">
                {selectedInstallation.installation_type}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <div><strong>Path:</strong> {selectedInstallation.path}</div>
              <div><strong>Source:</strong> {selectedInstallation.source}</div>
              {selectedInstallation.version && (
                <div><strong>Version:</strong> {selectedInstallation.version}</div>
              )}
            </div>
          </div>
        )}

        {/* Save Button */}
        {showSaveButton && (
          <Button 
            onClick={onSave} 
            disabled={isSaving || !selectedInstallation}
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save Selection"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}; 
