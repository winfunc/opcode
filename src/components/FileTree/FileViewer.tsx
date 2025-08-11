import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { X, Copy, Check, Sun, Moon, Send, FileText } from "lucide-react";
import { codeToHtml } from "shiki";
import { languageMap } from "./languageMap";
import { useChatStore } from "@/hooks/useChatStore";

interface FileViewerProps {
  filePath: string | null;
  onClose: () => void;
  addToNotepad?: (text: string, source?: string) => void;
  onSendToChat?: (text: string) => void;
}

export function FileViewer({ filePath, onClose, addToNotepad, onSendToChat }: FileViewerProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const [selectedText, setSelectedText] = useState<string>("");
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");
  const { addFileContent } = useChatStore();

  const getFileName = () => {
    if (!filePath) return "";
    return filePath.split("/").pop() || filePath;
  };

  const getFileExtension = () => {
    if (!filePath) return "";
    const fileName = getFileName();
    const lastDot = fileName.lastIndexOf(".");
    return lastDot > -1 ? fileName.substring(lastDot + 1).toLowerCase() : "";
  };

  useEffect(() => {
    if (!filePath) {
      setContent("");
      setError(null);
      return;
    }

    const loadFile = async () => {
      setLoading(true);
      setError(null);

      try {
        const extension = getFileExtension();
        let fileContent: string;

        switch (extension) {
          case "pdf":
            fileContent = await invoke<string>("read_pdf_content", {
              filePath,
            });
            break;
          case "csv":
            fileContent = await invoke<string>("read_csv_content", {
              filePath,
            });
            break;
          case "xlsx":
            fileContent = await invoke<string>("read_xlsx_content", {
              filePath,
            });
            break;
          default:
            fileContent = await invoke<string>("read_file", { filePath });
            break;
        }

        setContent(fileContent);
      } catch (err) {
        setError(err as string);
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath]);

  const handleCopy = async () => {
    const textToCopy = selectedText || content;
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy content:", err);
      }
    }
  };

  const handleSendToAI = () => {
    if (content && onSendToChat) {
      const textToSend = selectedText || content;
      onSendToChat(textToSend);
    } else if (content) {
      // Fallback to original behavior if no onSendToChat callback
      const fileName = getFileName();
      addFileContent(fileName, content, selectedText || undefined);
    }
  };

  const handleAddToNote = () => {
    if (addToNotepad && content) {
      const fileName = getFileName();
      const textToAdd = selectedText || content;
      addToNotepad(textToAdd, `File: ${fileName}`);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection) {
      const selectedText = selection.toString().trim();
      setSelectedText(selectedText);
    }
  };

  const getLanguage = useMemo(() => {
    const extension = getFileExtension();
    return languageMap[extension] || "text";
  }, [filePath]);

  const isCodeFile = useMemo(() => {
    return getLanguage !== "text";
  }, [getLanguage]);

  const MAX_LINES = 500;

  const displayContent = useMemo(() => {
    if (!content) return "";
    if (showFullContent) return content;

    const lines = content.split("\n");
    if (lines.length <= MAX_LINES) return content;

    return lines.slice(0, MAX_LINES).join("\n");
  }, [content, showFullContent]);

  const isLargeFile = useMemo(() => {
    return content.split("\n").length > MAX_LINES;
  }, [content]);

  const handleToggleContent = useCallback(() => {
    setShowFullContent((prev) => !prev);
  }, []);

  // Generate highlighted HTML using Shiki
  useEffect(() => {
    if (!content || !isCodeFile) {
      setHighlightedHtml("");
      return;
    }

    const generateHighlight = async () => {
      try {
        const html = await codeToHtml(displayContent, {
          lang: getLanguage as any,
          theme: isDarkTheme ? "github-dark" : "github-light"
        });
        
        // Add line numbers with CSS that makes them unselectable
        const withLineNumbers = html.replace(
          /<pre[^>]*>/,
          `<pre style="position: relative; counter-reset: line; padding-left: 4rem; margin: 0; padding-top: 1rem; padding-bottom: 1rem; padding-right: 1rem; font-size: 0.875rem; overflow-x: auto; background: ${isDarkTheme ? '#0d1117' : '#f6f8fa'} !important;">`
        ).replace(
          /<span class="line">/g,
          '<span class="line" style="position: relative; display: block; padding-left: 0;"><span style="position: absolute; left: -3.5rem; width: 3rem; text-align: right; user-select: none; -webkit-user-select: none; color: #7d8590; counter-increment: line; content: counter(line);" data-line-number></span>'
        ).replace(
          /<\/span><span class="line"/g,
          '</span></span><span class="line"'
        ) + '<style>.shiki-container span[data-line-number]::before { content: counter(line); }</style>';
        
        setHighlightedHtml(withLineNumbers);
      } catch (err) {
        console.error("Shiki highlighting failed:", err);
        setHighlightedHtml("");
      }
    };

    generateHighlight();
  }, [content, isCodeFile, getLanguage, isDarkTheme, displayContent]);

  if (!filePath) return null;

  return (
    <div className="flex flex-col h-full border-l border-border min-w-0">
      <div className="flex items-center justify-between p-3 border-b border-border bg-background">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate" title={filePath}>
            {getFileName()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {selectedText && (
            <span className="text-xs text-primary mr-2">
              {selectedText.length} chars selected
            </span>
          )}
          {isLargeFile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleContent}
              className="p-1 h-auto text-xs"
              title={`${showFullContent ? "Show first 500 lines" : "Show all lines"} (${content.split("\n").length} total)`}
            >
              {showFullContent ? "500" : "All"}
            </Button>
          )}
          {isCodeFile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDarkTheme(!isDarkTheme)}
              className="p-1 h-auto"
              title={
                isDarkTheme ? "Switch to light theme" : "Switch to dark theme"
              }
            >
              {isDarkTheme ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSendToAI}
            disabled={!content || loading}
            className="p-1 h-auto"
            title={
              selectedText
                ? "Send selected text to AI"
                : "Send file content to AI"
            }
          >
            <Send className="w-4 h-4" />
          </Button>
          {addToNotepad && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddToNote}
              disabled={!content || loading}
              className="p-1 h-auto"
              title={
                selectedText
                  ? "Add selected text to note"
                  : "Add file content to note"
              }
            >
              <FileText className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!content || loading}
            className="p-1 h-auto"
            title={selectedText ? "Copy selected text" : "Copy file content"}
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 h-auto"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">Loading file...</div>
        ) : error ? (
          <div className="p-4 text-center text-destructive">{error}</div>
        ) : isCodeFile ? (
          <div onMouseUp={handleTextSelection} className="min-w-0">
            {highlightedHtml ? (
              <div
                className="shiki-container text-sm overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
                }}
              />
            ) : (
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-all overflow-x-auto text-foreground bg-muted/30">
                {displayContent}
              </pre>
            )}
            {isLargeFile && !showFullContent && (
              <div className="p-4 text-center border-t border-border bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">
                  Showing first {MAX_LINES} lines of{" "}
                  {content.split("\n").length} total lines
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleContent}
                >
                  Show All Lines
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div onMouseUp={handleTextSelection} className="min-w-0">
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-all overflow-x-auto text-foreground bg-muted/30">
              {displayContent}
            </pre>
            {isLargeFile && !showFullContent && (
              <div className="p-4 text-center border-t border-border bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">
                  Showing first {MAX_LINES} lines of{" "}
                  {content.split("\n").length} total lines
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleContent}
                >
                  Show All Lines
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
