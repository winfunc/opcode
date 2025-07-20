import { useState, useEffect } from "react";
import { api, type ClaudeInstallation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, FileQuestion, Terminal, AlertCircle, Loader2 } from "lucide-react";
import { ClaudeVersionSelector } from "./ClaudeVersionSelector";
import { useI18n } from "@/lib/i18n";
import { handleError } from "@/lib/errorHandler";
/**
 * Props interface for the ClaudeBinaryDialog component
 */
interface ClaudeBinaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

/**
 * ClaudeBinaryDialog component for selecting Claude Code installation
 *
 * A dialog interface for detecting, selecting, and configuring Claude Code
 * binary installations. Features automatic detection across common installation
 * paths, validation, and installation guidance with external links.
 *
 * @param open - Whether the dialog is currently open
 * @param onOpenChange - Callback when dialog open state changes
 * @param onSuccess - Callback when installation is successfully configured
 * @param onError - Callback when an error occurs
 *
 * @example
 * ```tsx
 * <ClaudeBinaryDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   onSuccess={() => {
 *     console.log('Claude binary configured successfully');
 *     refreshSettings();
 *   }}
 *   onError={(message) => {
 *     console.error('Configuration failed:', message);
 *     showToast(message, 'error');
 *   }}
 * />
 * ```
 */
export function ClaudeBinaryDialog({
  open,
  onOpenChange,
  onSuccess,
  onError,
}: ClaudeBinaryDialogProps) {
  const { t } = useI18n();
  const [selectedInstallation, setSelectedInstallation] = useState<ClaudeInstallation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [hasInstallations, setHasInstallations] = useState(true);
  const [checkingInstallations, setCheckingInstallations] = useState(true);

  useEffect(() => {
    if (open) {
      checkInstallations();
    }
  }, [open]);

  const checkInstallations = async () => {
    try {
      setCheckingInstallations(true);
      const installations = await api.listClaudeInstallations();
      setHasInstallations(installations.length > 0);
    } catch (_error) {
      // If the API call fails, it means no installations found
      setHasInstallations(false);
    } finally {
      setCheckingInstallations(false);
    }
  };

  /**
   * Handle saving the selected Claude binary configuration
   */
  const handleSave = async () => {
    if (!selectedInstallation) {
      onError(t.settings.pleaseSelectInstallation);
      return;
    }

    setIsValidating(true);
    try {
      await api.setClaudeBinaryPath(selectedInstallation.path);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      await handleError("Failed to save Claude binary path:", { context: error });
      onError(error instanceof Error ? error.message : "Failed to save Claude binary path");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="w-5 h-5" />
            {t.settings.claudeInstallation}
          </DialogTitle>
          <DialogDescription className="space-y-3 mt-4">
            {checkingInstallations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  {t.settings.searchingForInstallations}
                </span>
              </div>
            ) : hasInstallations ? (
              <p>{t.settings.multipleInstallationsFound}</p>
            ) : (
              <>
                <p>{t.settings.claudeNotFoundInLocations}</p>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Searched locations:</span> PATH, /usr/local/bin,
                    /opt/homebrew/bin, ~/.nvm/versions/node/*/bin, ~/.claude/local, ~/.local/bin
                  </p>
                </div>
              </>
            )}
            {!checkingInstallations && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Tip:</span> You can install Claude Code using{" "}
                  <code className="px-1 py-0.5 bg-black/10 dark:bg-white/10 rounded">
                    npm install -g @claude
                  </code>
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {!checkingInstallations && hasInstallations && (
          <div className="py-4">
            <ClaudeVersionSelector
              onSelect={(installation) => setSelectedInstallation(installation)}
              selectedPath={null}
            />
          </div>
        )}

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={() => window.open("https://docs.claude.ai/claude/how-to-install", "_blank")}
            className="mr-auto"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t.settings.installationGuide}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isValidating}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isValidating || !selectedInstallation || !hasInstallations}
          >
            {isValidating
              ? t.settings.validating
              : hasInstallations
                ? t.settings.saveSelection
                : t.settings.noInstallationsFound}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
