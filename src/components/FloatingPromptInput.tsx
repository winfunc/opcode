import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Maximize2, 
  Minimize2,
  ChevronUp,
  Sparkles,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { FilePicker } from "./FilePicker";
import { ImagePreview } from "./ImagePreview";
import { type FileEntry } from "@/lib/api";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

interface FloatingPromptInputProps {
  /**
   * Callback when prompt is sent
   */
  onSend: (prompt: string, model: "sonnet" | "opus") => void;
  /**
   * Whether the input is loading
   */
  isLoading?: boolean;
  /**
   * Whether the input is disabled
   */
  disabled?: boolean;
  /**
   * Default model to select
   */
  defaultModel?: "sonnet" | "opus";
  /**
   * Project path for file picker
   */
  projectPath?: string;
  /**
   * Optional className for styling
   */
  className?: string;
}

type Model = {
  id: "sonnet" | "opus";
  name: string;
  description: string;
  icon: React.ReactNode;
};

const MODELS: Model[] = [
  {
    id: "sonnet",
    name: "Claude 4 Sonnet",
    description: "Faster, efficient for most tasks",
    icon: <Zap className="h-4 w-4" />
  },
  {
    id: "opus",
    name: "Claude 4 Opus",
    description: "More capable, better for complex tasks",
    icon: <Sparkles className="h-4 w-4" />
  }
];

/**
 * FloatingPromptInput component - Fixed position prompt input with model picker
 * 
 * @example
 * <FloatingPromptInput
 *   onSend={(prompt, model) => console.log('Send:', prompt, model)}
 *   isLoading={false}
 * />
 */
export const FloatingPromptInput: React.FC<FloatingPromptInputProps> = ({
  onSend,
  isLoading = false,
  disabled = false,
  defaultModel = "sonnet",
  projectPath,
  className,
}) => {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<"sonnet" | "opus">(defaultModel);
  const [isExpanded, setIsExpanded] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerQuery, setFilePickerQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [embeddedImages, setEmbeddedImages] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);
  const unlistenDragDropRef = useRef<(() => void) | null>(null);

  // Helper function to check if a file is an image
  const isImageFile = (path: string): boolean => {
    const ext = path.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext || '');
  };

  // Extract image paths from prompt text
  const extractImagePaths = (text: string): string[] => {
    console.log('[extractImagePaths] Input text:', text);
    const regex = /@([^\s]+)/g;
    const matches = Array.from(text.matchAll(regex));
    console.log('[extractImagePaths] Regex matches:', matches.map(m => m[0]));
    const pathsSet = new Set<string>(); // Use Set to ensure uniqueness
    
    for (const match of matches) {
      const path = match[1];
      console.log('[extractImagePaths] Processing path:', path);
      // Convert relative path to absolute if needed
      const fullPath = path.startsWith('/') ? path : (projectPath ? `${projectPath}/${path}` : path);
      console.log('[extractImagePaths] Full path:', fullPath, 'Is image:', isImageFile(fullPath));
      if (isImageFile(fullPath)) {
        pathsSet.add(fullPath); // Add to Set (automatically handles duplicates)
      }
    }
    
    const uniquePaths = Array.from(pathsSet); // Convert Set back to Array
    console.log('[extractImagePaths] Final extracted paths (unique):', uniquePaths);
    return uniquePaths;
  };

  // Update embedded images when prompt changes
  useEffect(() => {
    console.log('[useEffect] Prompt changed:', prompt);
    const imagePaths = extractImagePaths(prompt);
    console.log('[useEffect] Setting embeddedImages to:', imagePaths);
    setEmbeddedImages(imagePaths);
  }, [prompt, projectPath]);

  // Set up Tauri drag-drop event listener
  useEffect(() => {
    // This effect runs only once on component mount to set up the listener.
    let lastDropTime = 0;

    const setupListener = async () => {
      try {
        // If a listener from a previous mount/render is still around, clean it up.
        if (unlistenDragDropRef.current) {
          unlistenDragDropRef.current();
        }

        const webview = getCurrentWebviewWindow();
        unlistenDragDropRef.current = await webview.onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setDragActive(true);
          } else if (event.payload.type === 'leave') {
            setDragActive(false);
          } else if (event.payload.type === 'drop' && event.payload.paths) {
            setDragActive(false);

            const currentTime = Date.now();
            if (currentTime - lastDropTime < 200) {
              // This debounce is crucial to handle the storm of drop events
              // that Tauri/OS can fire for a single user action.
              return;
            }
            lastDropTime = currentTime;

            const droppedPaths = event.payload.paths as string[];
            const imagePaths = droppedPaths.filter(isImageFile);

            if (imagePaths.length > 0) {
              setPrompt(currentPrompt => {
                const existingPaths = extractImagePaths(currentPrompt);
                const newPaths = imagePaths.filter(p => !existingPaths.includes(p));

                if (newPaths.length === 0) {
                  return currentPrompt; // All dropped images are already in the prompt
                }

                const mentionsToAdd = newPaths.map(p => `@${p}`).join(' ');
                const newPrompt = currentPrompt + (currentPrompt.endsWith(' ') || currentPrompt === '' ? '' : ' ') + mentionsToAdd + ' ';
                
                setTimeout(() => {
                  const target = isExpanded ? expandedTextareaRef.current : textareaRef.current;
                  target?.focus();
                  target?.setSelectionRange(newPrompt.length, newPrompt.length);
                }, 0);

                return newPrompt;
              });
            }
          }
        });
      } catch (error) {
        console.error('Failed to set up Tauri drag-drop listener:', error);
      }
    };

    setupListener();

    return () => {
      // On unmount, ensure we clean up the listener.
      if (unlistenDragDropRef.current) {
        unlistenDragDropRef.current();
        unlistenDragDropRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount/unmount.

  useEffect(() => {
    // Focus the appropriate textarea when expanded state changes
    if (isExpanded && expandedTextareaRef.current) {
      expandedTextareaRef.current.focus();
    } else if (!isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  const handleSend = () => {
    if (prompt.trim() && !isLoading && !disabled) {
      onSend(prompt.trim(), selectedModel);
      setPrompt("");
      setEmbeddedImages([]);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart || 0;
    
    // Check if @ was just typed
    if (projectPath?.trim() && newValue.length > prompt.length && newValue[newCursorPosition - 1] === '@') {
      console.log('[FloatingPromptInput] @ detected, projectPath:', projectPath);
      setShowFilePicker(true);
      setFilePickerQuery("");
      setCursorPosition(newCursorPosition);
    }
    
    // Check if we're typing after @ (for search query)
    if (showFilePicker && newCursorPosition >= cursorPosition) {
      // Find the @ position before cursor
      let atPosition = -1;
      for (let i = newCursorPosition - 1; i >= 0; i--) {
        if (newValue[i] === '@') {
          atPosition = i;
          break;
        }
        // Stop if we hit whitespace (new word)
        if (newValue[i] === ' ' || newValue[i] === '\n') {
          break;
        }
      }
      
      if (atPosition !== -1) {
        const query = newValue.substring(atPosition + 1, newCursorPosition);
        setFilePickerQuery(query);
      } else {
        // @ was removed or cursor moved away
        setShowFilePicker(false);
        setFilePickerQuery("");
      }
    }
    
    setPrompt(newValue);
    setCursorPosition(newCursorPosition);
  };

  const handleFileSelect = (entry: FileEntry) => {
    if (textareaRef.current) {
      // Replace the @ and partial query with the selected path (file or directory)
      const textarea = textareaRef.current;
      const beforeAt = prompt.substring(0, cursorPosition - 1);
      const afterCursor = prompt.substring(cursorPosition + filePickerQuery.length);
      const relativePath = entry.path.startsWith(projectPath || '') 
        ? entry.path.slice((projectPath || '').length + 1)
        : entry.path;
      
      const newPrompt = `${beforeAt}@${relativePath} ${afterCursor}`;
      setPrompt(newPrompt);
      setShowFilePicker(false);
      setFilePickerQuery("");
      
      // Focus back on textarea and set cursor position after the inserted path
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = beforeAt.length + relativePath.length + 2; // +2 for @ and space
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };
  
  const handleFilePickerClose = () => {
    setShowFilePicker(false);
    setFilePickerQuery("");
    // Return focus to textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showFilePicker && e.key === 'Escape') {
      e.preventDefault();
      setShowFilePicker(false);
      setFilePickerQuery("");
      return;
    }
    
    if (e.key === "Enter" && !e.shiftKey && !isExpanded && !showFilePicker) {
      e.preventDefault();
      handleSend();
    }
  };

  // Browser drag and drop handlers - just prevent default behavior
  // Actual file handling is done via Tauri's window-level drag-drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Visual feedback is handled by Tauri events
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // File processing is handled by Tauri's onDragDropEvent
  };

  const handleRemoveImage = (index: number) => {
    // Remove the corresponding @mention from the prompt
    const imagePath = embeddedImages[index];
    const patterns = [
      new RegExp(`@${imagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s?`, 'g'),
      new RegExp(`@${imagePath.replace(projectPath + '/', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s?`, 'g')
    ];
    
    let newPrompt = prompt;
    for (const pattern of patterns) {
      newPrompt = newPrompt.replace(pattern, '');
    }
    
    setPrompt(newPrompt.trim());
  };

  const selectedModelData = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  return (
    <>
      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Compose your prompt</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(false)}
                  className="h-8 w-8"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Image previews in expanded mode */}
              {embeddedImages.length > 0 && (
                <ImagePreview
                  images={embeddedImages}
                  onRemove={handleRemoveImage}
                  className="border-t border-border pt-2"
                />
              )}
              
              <Textarea
                ref={expandedTextareaRef}
                value={prompt}
                onChange={handleTextChange}
                placeholder="Type your prompt here..."
                className="min-h-[200px] resize-none"
                disabled={isLoading || disabled}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Model:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModelPickerOpen(!modelPickerOpen)}
                    className="gap-2"
                  >
                    {selectedModelData.icon}
                    {selectedModelData.name}
                  </Button>
                </div>
                
                <Button
                  onClick={handleSend}
                  disabled={!prompt.trim() || isLoading || disabled}
                  size="sm"
                  className="min-w-[80px]"
                >
                  {isLoading ? (
                    <div className="rotating-symbol text-primary-foreground"></div>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Position Input Bar */}
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border",
          dragActive && "ring-2 ring-primary ring-offset-2",
          className
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="max-w-5xl mx-auto">
          {/* Image previews */}
          {embeddedImages.length > 0 && (
            <ImagePreview
              images={embeddedImages}
              onRemove={handleRemoveImage}
              className="border-b border-border"
            />
          )}
          
          <div className="p-4">
            <div className="flex items-end gap-3">
              {/* Model Picker */}
              <Popover
                trigger={
                  <Button
                    variant="outline"
                    size="default"
                    disabled={isLoading || disabled}
                    className="gap-2 min-w-[180px] justify-start"
                  >
                    {selectedModelData.icon}
                    <span className="flex-1 text-left">{selectedModelData.name}</span>
                    <ChevronUp className="h-4 w-4 opacity-50" />
                  </Button>
                }
                content={
                  <div className="w-[300px] p-1">
                    {MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          setModelPickerOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 rounded-md transition-colors text-left",
                          "hover:bg-accent",
                          selectedModel === model.id && "bg-accent"
                        )}
                      >
                        <div className="mt-0.5">{model.icon}</div>
                        <div className="flex-1 space-y-1">
                          <div className="font-medium text-sm">{model.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {model.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                }
                open={modelPickerOpen}
                onOpenChange={setModelPickerOpen}
                align="start"
                side="top"
              />
              
              {/* Prompt Input */}
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder={dragActive ? "Drop images here..." : "Ask Claude anything..."}
                  disabled={isLoading || disabled}
                  className={cn(
                    "min-h-[44px] max-h-[120px] resize-none pr-10",
                    dragActive && "border-primary"
                  )}
                  rows={1}
                />
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(true)}
                  disabled={isLoading || disabled}
                  className="absolute right-1 bottom-1 h-8 w-8"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                
                {/* File Picker */}
                <AnimatePresence>
                  {showFilePicker && projectPath && projectPath.trim() && (
                    <FilePicker
                      basePath={projectPath.trim()}
                      onSelect={handleFileSelect}
                      onClose={handleFilePickerClose}
                      initialQuery={filePickerQuery}
                    />
                  )}
                </AnimatePresence>
              </div>
              
              {/* Send Button */}
              <Button
                onClick={handleSend}
                disabled={!prompt.trim() || isLoading || disabled}
                size="default"
                className="min-w-[60px]"
              >
                {isLoading ? (
                  <div className="rotating-symbol text-primary-foreground"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="mt-2 text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line{projectPath?.trim() && ", @ to mention files, drag & drop images"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}; 