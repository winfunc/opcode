import React, { useState, useEffect, useCallback } from "react";
import MDEditor from "@uiw/react-md-editor";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { api, type ClaudeMdFile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { handleError } from "@/lib/errorHandler";
interface ClaudeFileEditorProps {
  /**
   * The CLAUDE.md file to edit
   */
  file: ClaudeMdFile;
  /**
   * Callback to go back to the previous view
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * ClaudeFileEditor component for editing project-specific CLAUDE.md files
 *
 * @example
 * <ClaudeFileEditor
 *   file={claudeMdFile}
 *   onBack={() => setEditingFile(null)}
 * />
 */
export const ClaudeFileEditor: React.FC<ClaudeFileEditorProps> = ({ file, onBack, className }) => {
  const { t } = useI18n();
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const hasChanges = content !== originalContent;

  /**
   * Load file content from the filesystem
   *
   * Asynchronously loads the content of the CLAUDE.md file and handles
   * loading states and error conditions.
   */
  const loadFileContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fileContent = await api.readClaudeMdFile(file.absolute_path);
      setContent(fileContent);
      setOriginalContent(fileContent);
    } catch (err) {
      await handleError("Failed to load file:", { context: err });
      setError(t.claudemd.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [file.absolute_path, t.claudemd.failedToLoad]);

  // Load the file content on mount
  useEffect(() => {
    loadFileContent();
  }, [file.absolute_path, loadFileContent]);

  /**
   * Handle saving the file content
   *
   * Saves the current editor content to the filesystem and provides
   * user feedback through toast notifications.
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setToast(null);
      await api.saveClaudeMdFile(file.absolute_path, content);
      setOriginalContent(content);
      setToast({ message: t.claudemd.savedSuccessfully, type: "success" });
    } catch (err) {
      await handleError("Failed to save file:", { context: err });
      setError(t.claudemd.failedToSave);
      setToast({ message: t.claudemd.failedToSave, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle back navigation with unsaved changes check
   *
   * Prompts user for confirmation if there are unsaved changes
   * before navigating back to the previous view.
   */
  const handleBack = () => {
    if (hasChanges) {
      const confirmLeave = window.confirm(t.claudemd.unsavedChanges);
      if (!confirmLeave) return;
    }
    onBack();
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between p-4 border-b border-border"
        >
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold truncate">{file.relative_path}</h2>
              <p className="text-xs text-muted-foreground">{t.claudemd.editProjectPrompt}</p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={!hasChanges || saving} size="sm">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? t.common.loading : t.common.save}
          </Button>
        </motion.div>

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-4 mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
          >
            {error}
          </motion.div>
        )}

        {/* Editor */}
        <div className="flex-1 p-4 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div
              className="h-full rounded-lg border border-border overflow-hidden shadow-sm"
              data-color-mode="dark"
            >
              <MDEditor
                value={content}
                onChange={(val) => setContent(val || "")}
                preview="edit"
                height="100%"
                visibleDragbar={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
        )}
      </ToastContainer>
    </div>
  );
};
