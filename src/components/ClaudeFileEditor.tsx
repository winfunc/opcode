import React, { useState, useEffect } from "react";
import MDEditor from "@uiw/react-md-editor";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { useTheme } from "@/contexts/ThemeContext";
import { api, type ClaudeMdFile } from "@/lib/api";
import { cn } from "@/lib/utils";

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
export const ClaudeFileEditor: React.FC<ClaudeFileEditorProps> = ({
  file,
  onBack,
  className,
}) => {
  const { theme } = useTheme();
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  const hasChanges = content !== originalContent;
  
  // Load the file content on mount
  useEffect(() => {
    loadFileContent();
  }, [file.absolute_path]);
  
  const loadFileContent = async () => {
    try {
      setLoading(true);
      setError(null);
      const fileContent = await api.readClaudeMdFile(file.absolute_path);
      setContent(fileContent);
      setOriginalContent(fileContent);
    } catch (err) {
      console.error("Failed to load file:", err);
      setError("Failed to load CLAUDE.md file");
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setToast(null);
      await api.saveClaudeMdFile(file.absolute_path, content);
      setOriginalContent(content);
      setToast({ message: "File saved successfully", type: "success" });
    } catch (err) {
      console.error("Failed to save file:", err);
      setError("Failed to save CLAUDE.md file");
      setToast({ message: "Failed to save file", type: "error" });
    } finally {
      setSaving(false);
    }
  };
  
  const handleBack = () => {
    if (hasChanges) {
      const confirmLeave = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
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
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold truncate">{file.relative_path}</h2>
              <p className="text-xs text-muted-foreground">
                Edit project-specific Claude Code system prompt
              </p>
            </div>
          </div>
          
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            size="sm"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save"}
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
            <div className="h-full rounded-lg border border-border overflow-hidden shadow-sm" data-color-mode={theme}>
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
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </div>
  );
}; 