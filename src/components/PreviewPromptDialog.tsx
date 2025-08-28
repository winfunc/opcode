import React from "react";
import { motion } from "framer-motion";
import { Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

interface PreviewPromptDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;
  /**
   * The detected URL to preview
   */
  url: string;
  /**
   * Callback when user confirms opening preview
   */
  onConfirm: () => void;
  /**
   * Callback when user cancels
   */
  onCancel: () => void;
}

/**
 * Dialog component that prompts the user to open a detected URL in the preview pane
 * 
 * @example
 * <PreviewPromptDialog
 *   isOpen={showPrompt}
 *   url="http://localhost:3000"
 *   onConfirm={() => openPreview(url)}
 *   onCancel={() => setShowPrompt(false)}
 * />
 */
export const PreviewPromptDialog: React.FC<PreviewPromptDialogProps> = ({
  isOpen,
  url,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  // Extract domain for display
  const getDomain = (urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.hostname;
    } catch {
      return urlString;
    }
  };

  const domain = getDomain(url);
  const isLocalhost = domain.includes('localhost') || domain.includes('127.0.0.1');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {t('preview.openPreview')}
          </DialogTitle>
          <DialogDescription>
            {t('preview.urlDetected')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <ExternalLink className={`h-4 w-4 mt-0.5 ${isLocalhost ? 'text-green-500' : 'text-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {isLocalhost ? t('preview.localDevelopmentServer') : t('preview.externalUrl')}
                </p>
                <p className="text-xs text-muted-foreground mt-1 break-all">
                  {url}
                </p>
              </div>
            </div>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-xs text-muted-foreground"
          >
            {t('preview.previewWillOpen')}
          </motion.div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onConfirm} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            {t('preview.openPreviewButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 