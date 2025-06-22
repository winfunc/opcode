import { useState, useEffect } from "react";
import { api, ClaudeInstallation, ClaudePathValidation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, 
  CheckCircle, 
  FileQuestion, 
  Terminal, 
  RefreshCw, 
  ExternalLink,
  Settings,
  AlertCircle,
  Cpu,
  HardDrive,
  Loader2
} from "lucide-react";

interface ClaudeVersionPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  /** Show as settings dialog instead of error dialog */
  settingsMode?: boolean;
}

export function ClaudeVersionPicker({ 
  open, 
  onOpenChange, 
  onSuccess, 
  onError,
  settingsMode = false 
}: ClaudeVersionPickerProps) {
  const [installations, setInstallations] = useState<ClaudeInstallation[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [customPath, setCustomPath] = useState<string>("");
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);
  const [currentManualPath, setCurrentManualPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string>("");
  const [customPathValidation, setCustomPathValidation] = useState<ClaudePathValidation | null>(null);
  const [validationError, setValidationError] = useState<string>("");

  // Load installations and current selection when dialog opens
  useEffect(() => {
    if (open) {
      loadInstallations();
      loadCurrentSelection();
    }
  }, [open]);

  const loadInstallations = async () => {
    setIsDiscovering(true);
    try {
      const discovered = await api.discoverClaudeInstallations();
      setInstallations(discovered);
      
      // If no verified installations found, show custom input by default
      if (!discovered.some(inst => inst.is_verified)) {
        setShowCustomInput(true);
      }
    } catch (error) {
      console.error("Failed to discover Claude installations:", error);
      onError("Failed to discover Claude installations");
    } finally {
      setIsDiscovering(false);
    }
  };

  const loadCurrentSelection = async () => {
    try {
      // Check for manual path first (takes precedence)
      const manualPath = await api.getClaudeBinaryPath();
      setCurrentManualPath(manualPath);
      
      // Then check for selected installation
      const current = await api.getSelectedClaudeInstallation();
      setCurrentSelection(current);
      
      // Set the display path based on priority
      if (manualPath) {
        setCustomPath(manualPath);
        setShowCustomInput(true);
      } else if (current) {
        setSelectedPath(current);
      }
    } catch (error) {
      console.error("Failed to get current selection:", error);
    }
  };

  const handleSelectionChange = (path: string) => {
    // If there's already a selection and user is changing it, show confirmation
    if (currentSelection && path !== currentSelection) {
      setPendingSelection(path);
      setShowConfirmDialog(true);
    } else {
      setSelectedPath(path);
    }
  };

  const confirmSelection = () => {
    setSelectedPath(pendingSelection);
    setShowConfirmDialog(false);
    setPendingSelection("");
  };

  const validateCustomPath = async (path: string) => {
    if (!path.trim()) {
      setCustomPathValidation(null);
      setValidationError("");
      return;
    }

    setIsValidating(true);
    setValidationError("");
    
    try {
      const validation = await api.validateClaudePath(path.trim());
      setCustomPathValidation(validation);
      
      if (!validation.is_valid) {
        setValidationError(validation.error || "Invalid path");
      }
    } catch (error) {
      console.error("Failed to validate custom path:", error);
      setValidationError("Failed to validate path");
      setCustomPathValidation({ is_valid: false, error: "Validation failed" });
    } finally {
      setIsValidating(false);
    }
  };

  // Debounced validation for custom path
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customPath && showCustomInput) {
        validateCustomPath(customPath);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [customPath, showCustomInput]);

  const handleSave = async () => {
    const pathToSave = showCustomInput ? customPath.trim() : selectedPath;
    
    if (!pathToSave) {
      onError("Please select a Claude installation or enter a custom path");
      return;
    }

    // If custom path is being used, validate it first
    if (showCustomInput && customPathValidation && !customPathValidation.is_valid) {
      onError(validationError || "Please enter a valid Claude binary path");
      return;
    }

    setIsLoading(true);
    try {
      if (showCustomInput) {
        // Use manual path API with validation
        const result = await api.setManualClaudePath({
          path: pathToSave,
          label: "Custom Path",
          validate: true
        });
        
        if (!result.success) {
          throw new Error(result.error || "Failed to set manual Claude path");
        }
      } else {
        // Use selected installation API
        await api.setSelectedClaudeInstallation(pathToSave);
      }
      
      // Emit global event to notify other components of Claude installation change
      window.dispatchEvent(new CustomEvent('claude-installation-changed', { 
        detail: { 
          path: pathToSave,
          source: showCustomInput ? 'Manual' : 'Selected'
        } 
      }));
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save Claude installation selection:", error);
      onError(error instanceof Error ? error.message : "Failed to save Claude installation selection");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSelection = async () => {
    if (!currentSelection && !currentManualPath) return;
    
    setIsLoading(true);
    try {
      // Clear manual path first if it exists
      if (currentManualPath) {
        await api.clearManualClaudePath();
        setCurrentManualPath(null);
        setCustomPath("");
      }
      
      // Clear selected installation if it exists
      if (currentSelection) {
        await api.clearSelectedClaudeInstallation();
        setCurrentSelection(null);
        setSelectedPath("");
      }
      
      // Emit global event to notify other components of Claude installation change
      window.dispatchEvent(new CustomEvent('claude-installation-changed', { 
        detail: { path: null } 
      }));
      
      onSuccess();
    } catch (error) {
      console.error("Failed to clear selection:", error);
      onError("Failed to clear selection");
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceIcon = (installation: ClaudeInstallation) => {
    if (installation.source.includes("NVM")) {
      return <Cpu className="w-4 h-4" />;
    } else if (installation.source.includes("Homebrew")) {
      return <HardDrive className="w-4 h-4" />;
    } else if (installation.source.includes("Global")) {
      return <Terminal className="w-4 h-4" />;
    }
    return <FileQuestion className="w-4 h-4" />;
  };

  const verifiedInstallations = installations.filter(inst => inst.is_verified);
  const unverifiedInstallations = installations.filter(inst => !inst.is_verified);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {settingsMode ? (
                <>
                  <Settings className="w-5 h-5" />
                  Claude Code Installation Settings
                </>
              ) : (
                <>
                  <FileQuestion className="w-5 h-5" />
                  Claude Code Installation Required
                </>
              )}
            </DialogTitle>
            <DialogDescription className="space-y-3 mt-4">
              {!settingsMode && (
                <p>
                  Claude Code was not found or multiple versions are available. 
                  Please select which installation to use.
                </p>
              )}
              
              {installations.length > 1 && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                  <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-medium">Multiple installations found!</span>{" "}
                    Please select which version to use. This affects all Claude operations in the app.
                  </p>
                </div>
              )}

              {(currentManualPath || currentSelection) && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <div className="text-sm text-green-800 dark:text-green-200">
                    <span className="font-medium">
                      Currently configured:
                      {currentManualPath && (
                        <Badge variant="secondary" className="ml-2 text-xs">MANUAL</Badge>
                      )}
                    </span>
                    <br />
                    <code className="text-xs bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded">
                      {currentManualPath || currentSelection}
                    </code>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Refresh Button */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Available Installations</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={loadInstallations}
                disabled={isDiscovering}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isDiscovering ? 'animate-spin' : ''}`} />
                {isDiscovering ? "Discovering..." : "Refresh"}
              </Button>
            </div>

            {/* Verified Installations */}
            {verifiedInstallations.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-green-700 dark:text-green-300">
                  ✅ Verified Claude Code Installations
                </Label>
                <div className="space-y-2">
                  {verifiedInstallations.map((installation, index) => (
                    <Card 
                      key={index}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedPath === installation.path 
                          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => handleSelectionChange(installation.path)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getSourceIcon(installation)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium truncate">{installation.source}</h4>
                                {installation.is_active && (
                                  <Badge variant="secondary" className="text-xs">ACTIVE</Badge>
                                )}
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  VERIFIED
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground font-mono truncate">
                                {installation.path}
                              </p>
                              {installation.version && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Version: {installation.version}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            {installation.node_available && (
                              <Badge variant="outline" className="text-xs">Node.js ✓</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Unverified Installations */}
            {unverifiedInstallations.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-orange-700 dark:text-orange-300">
                  ⚠️ Unverified Installations (may not be Claude Code)
                </Label>
                <div className="space-y-2">
                  {unverifiedInstallations.map((installation, index) => (
                    <Card 
                      key={index}
                      className="opacity-75 border-orange-200 dark:border-orange-800"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getSourceIcon(installation)}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{installation.source}</h4>
                              <p className="text-sm text-muted-foreground font-mono truncate">
                                {installation.path}
                              </p>
                            </div>
                          </div>
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* No installations found */}
            {installations.length === 0 && !isDiscovering && (
              <Card className="border-orange-200 dark:border-orange-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <AlertTriangle className="w-5 h-5" />
                    No Claude Code installations found
                  </CardTitle>
                  <CardDescription>
                    Claude Code was not found in any common installation locations. 
                    You can specify a custom path below or install Claude Code first.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {/* Custom Path Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Custom Installation Path</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustomInput(!showCustomInput)}
                >
                  {showCustomInput ? "Hide" : "Show"} Custom Path
                </Button>
              </div>
              
              {showCustomInput && (
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="/usr/local/bin/claude or /Users/name/.nvm/versions/node/v22.15.0/bin/claude"
                      value={customPath}
                      onChange={(e) => setCustomPath(e.target.value)}
                      className={`font-mono text-sm pr-10 ${
                        customPathValidation?.is_valid === false ? 'border-red-500' : 
                        customPathValidation?.is_valid === true ? 'border-green-500' : ''
                      }`}
                    />
                    {isValidating && (
                      <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    {!isValidating && customPathValidation?.is_valid === true && (
                      <CheckCircle className="absolute right-3 top-2.5 w-4 h-4 text-green-500" />
                    )}
                    {!isValidating && customPathValidation?.is_valid === false && (
                      <AlertTriangle className="absolute right-3 top-2.5 w-4 h-4 text-red-500" />
                    )}
                  </div>
                  
                  {/* Validation feedback */}
                  {validationError && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-800">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <p className="text-sm text-red-800 dark:text-red-200">{validationError}</p>
                    </div>
                  )}
                  
                  {customPathValidation?.is_valid && customPathValidation.version && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <p className="text-sm text-green-800 dark:text-green-200">
                        <span className="font-medium">Verified Claude Code</span>
                        {customPathValidation.version && ` (${customPathValidation.version})`}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <Terminal className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Tip:</span> Run{" "}
                      <code className="px-1 py-0.5 bg-black/10 dark:bg-white/10 rounded">which claude</code>{" "}
                      in your terminal to find the installation path
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => window.open("https://docs.anthropic.com/en/docs/claude-code", "_blank")}
              className="mr-auto"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Installation Guide
            </Button>
            
            {(currentSelection || currentManualPath) && (
              <Button
                variant="outline"
                onClick={handleClearSelection}
                disabled={isLoading}
              >
                Use Auto-Detection
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            
            <Button 
              onClick={handleSave} 
              disabled={
                isLoading || 
                isValidating ||
                (!selectedPath && !customPath.trim()) ||
                (showCustomInput && customPathValidation?.is_valid === false)
              }
            >
              {isLoading ? "Saving..." : 
               isValidating ? "Validating..." :
               "Save Selection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Change Claude Installation?
            </DialogTitle>
            <DialogDescription className="space-y-3 mt-4">
              <p>
                You are about to change the Claude Code installation used by the entire application.
              </p>
              <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-md border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  <span className="font-medium">⚠️ Important:</span> This will affect:
                </p>
                <ul className="text-sm text-orange-700 dark:text-orange-300 mt-2 ml-4 list-disc">
                  <li>All agent executions</li>
                  <li>Claude Code sessions</li>
                  <li>MCP server operations</li>
                  <li>Version detection throughout the app</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Current:</span>
                  <br />
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                    {currentSelection || "Auto-detection"}
                  </code>
                </p>
                <p className="text-sm">
                  <span className="font-medium">New selection:</span>
                  <br />
                  <code className="text-xs bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded">
                    {pendingSelection}
                  </code>
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={confirmSelection} className="bg-orange-600 hover:bg-orange-700">
              Change Installation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}