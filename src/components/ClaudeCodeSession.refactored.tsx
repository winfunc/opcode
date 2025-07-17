import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Session } from "@/lib/api";
import { cn } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import { FloatingPromptInput, type FloatingPromptInputRef } from "./FloatingPromptInput";
import { ErrorBoundary } from "./ErrorBoundary";
import { TimelineNavigator } from "./TimelineNavigator";
import { CheckpointSettings } from "./CheckpointSettings";
import { SlashCommandsManager } from "./SlashCommandsManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SplitPane } from "@/components/ui/split-pane";
import { WebviewPreview } from "./WebviewPreview";

// Import refactored components and hooks
import { useClaudeMessages } from "./claude-code-session/useClaudeMessages";
import { useCheckpoints } from "./claude-code-session/useCheckpoints";
import { SessionHeader } from "./claude-code-session/SessionHeader";
import { MessageList } from "./claude-code-session/MessageList";
import { PromptQueue } from "./claude-code-session/PromptQueue";

interface ClaudeCodeSessionProps {
  session?: Session;
  initialProjectPath?: string;
  onBack: () => void;
  onProjectSettings?: (projectPath: string) => void;
  className?: string;
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
}

export const ClaudeCodeSession: React.FC<ClaudeCodeSessionProps> = ({
  session,
  initialProjectPath = "",
  onBack,
  onProjectSettings,
  className,
  onStreamingChange,
}) => {
  const [projectPath, setProjectPath] = useState(initialProjectPath || session?.project_path || "");
  const [error, setError] = useState<string | null>(null);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  const [isFirstPrompt, setIsFirstPrompt] = useState(!session);
  const [totalTokens, setTotalTokens] = useState(0);
  const [claudeSessionId, setClaudeSessionId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showForkDialog, setShowForkDialog] = useState(false);
  const [showSlashCommandsSettings, setShowSlashCommandsSettings] = useState(false);
  const [forkCheckpointId, setForkCheckpointId] = useState<string | null>(null);
  const [forkSessionName, setForkSessionName] = useState("");
  const [queuedPrompts, setQueuedPrompts] = useState<Array<{ id: string; prompt: string; model: "sonnet" | "opus" }>>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);
  const promptInputRef = useRef<FloatingPromptInputRef>(null);
  const processQueueTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use custom hooks
  const {
    messages,
    rawJsonlOutput,
    isStreaming,
    currentSessionId: _currentSessionId,
    clearMessages,
    loadMessages
  } = useClaudeMessages({
    onSessionInfo: (info) => {
      setClaudeSessionId(info.sessionId);
    },
    onTokenUpdate: setTotalTokens,
    onStreamingChange
  });

  const {
    checkpoints: _checkpoints,
    timelineVersion,
    loadCheckpoints,
    createCheckpoint: _createCheckpoint,
    restoreCheckpoint,
    forkCheckpoint
  } = useCheckpoints({
    sessionId: claudeSessionId,
    projectId: session?.project_id || '',
    projectPath: projectPath,
    onToast: (message: string, type: 'success' | 'error') => {
      console.log(`Toast: ${type} - ${message}`);
    }
  });

  // Handle path selection
  const handleSelectPath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Project Directory"
    });
    
    if (selected && typeof selected === 'string') {
      setProjectPath(selected);
      setError(null);
      setIsFirstPrompt(true);
    }
  };

  // Handle sending prompts
  const handleSendPrompt = useCallback(async (prompt: string, model: "sonnet" | "opus") => {
    if (!projectPath || !prompt.trim()) return;

    // Add to queue if streaming
    if (isStreaming) {
      const id = Date.now().toString();
      setQueuedPrompts(prev => [...prev, { id, prompt, model }]);
      return;
    }

    try {
      setError(null);
      
      if (isFirstPrompt) {
        await api.executeClaudeCode(projectPath, prompt, model);
        setIsFirstPrompt(false);
      } else if (claudeSessionId) {
        await api.continueClaudeCode(projectPath, prompt, model);
      }
    } catch (error) {
      console.error("Failed to send prompt:", error);
      setError(error instanceof Error ? error.message : "Failed to send prompt");
    }
  }, [projectPath, isStreaming, isFirstPrompt, claudeSessionId]);

  // Process queued prompts
  const processQueuedPrompts = useCallback(async () => {
    if (queuedPrompts.length === 0 || isStreaming) return;

    const nextPrompt = queuedPrompts[0];
    setQueuedPrompts(prev => prev.slice(1));
    
    await handleSendPrompt(nextPrompt.prompt, nextPrompt.model);
  }, [queuedPrompts, isStreaming, handleSendPrompt]);

  // Effect to process queue when streaming stops
  useEffect(() => {
    if (!isStreaming && queuedPrompts.length > 0) {
      processQueueTimeoutRef.current = setTimeout(processQueuedPrompts, 500);
    }
    
    return () => {
      if (processQueueTimeoutRef.current) {
        clearTimeout(processQueueTimeoutRef.current);
      }
    };
  }, [isStreaming, queuedPrompts.length, processQueuedPrompts]);

  // Copy handlers
  const handleCopyAsJsonl = async () => {
    try {
      await navigator.clipboard.writeText(rawJsonlOutput.join('\n'));
      setCopyPopoverOpen(false);
      console.log("Session output copied as JSONL");
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleCopyAsMarkdown = async () => {
    try {
      const markdown = messages
        .filter(msg => msg.type === 'user' || msg.type === 'assistant')
        .map(msg => {
          if (msg.type === 'user') {
            return `## User\n\n${msg.message || ''}`;
          } else if (msg.type === 'assistant' && msg.message?.content) {
            const content = Array.isArray(msg.message.content) 
              ? msg.message.content.map((item: any) => {
                  if (typeof item === 'string') return item;
                  if (item.type === 'text') return item.text;
                  return '';
                }).filter(Boolean).join('')
              : msg.message.content;
            return `## Assistant\n\n${content}`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n---\n\n');
      
      await navigator.clipboard.writeText(markdown);
      setCopyPopoverOpen(false);
      console.log("Session output copied as Markdown");
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Fork dialog handlers
  const handleFork = (checkpointId: string) => {
    setForkCheckpointId(checkpointId);
    setForkSessionName("");
    setShowForkDialog(true);
  };

  const handleConfirmFork = async () => {
    if (!forkCheckpointId || !forkSessionName.trim()) return;

    const forkedSession = await forkCheckpoint(forkCheckpointId, forkSessionName);
    if (forkedSession) {
      setShowForkDialog(false);
      // Navigate to forked session
      window.location.reload(); // Or use proper navigation
    }
  };

  // Link detection handler
  const handleLinkDetected = (url: string) => {
    setPreviewUrl(url);
    if (!showPreview) {
      setShowPreview(true);
    }
  };

  // Load session if provided
  useEffect(() => {
    if (session) {
      setProjectPath(session.project_path);
      setClaudeSessionId(session.id);
      loadMessages(session.id);
      loadCheckpoints();
    }
  }, [session, loadMessages, loadCheckpoints]);

  return (
    <ErrorBoundary>
      <div className={cn("flex flex-col h-screen bg-background", className)}>
        {/* Header */}
        <SessionHeader
          projectPath={projectPath}
          claudeSessionId={claudeSessionId}
          totalTokens={totalTokens}
          isStreaming={isStreaming}
          hasMessages={messages.length > 0}
          showTimeline={showTimeline}
          copyPopoverOpen={copyPopoverOpen}
          onBack={onBack}
          onSelectPath={handleSelectPath}
          onCopyAsJsonl={handleCopyAsJsonl}
          onCopyAsMarkdown={handleCopyAsMarkdown}
          onToggleTimeline={() => setShowTimeline(!showTimeline)}
          onProjectSettings={onProjectSettings ? () => onProjectSettings(projectPath) : undefined}
          onSlashCommandsSettings={() => setShowSlashCommandsSettings(true)}
          setCopyPopoverOpen={setCopyPopoverOpen}
        />

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {showPreview ? (
            <SplitPane
              left={
                <div className="flex flex-col h-full">
                  <MessageList
                    messages={messages}
                    projectPath={projectPath}
                    isStreaming={isStreaming}
                    onLinkDetected={handleLinkDetected}
                    className="flex-1"
                  />
                  <PromptQueue
                    queuedPrompts={queuedPrompts}
                    onRemove={(id) => setQueuedPrompts(prev => prev.filter(p => p.id !== id))}
                  />
                </div>
              }
              right={
                <WebviewPreview
                  initialUrl={previewUrl || ""}
                  isMaximized={isPreviewMaximized}
                  onClose={() => setShowPreview(false)}
                  onUrlChange={setPreviewUrl}
                  onToggleMaximize={() => setIsPreviewMaximized(!isPreviewMaximized)}
                />
              }
              initialSplit={60}
            />
          ) : (
            <div className="flex flex-col flex-1">
              <MessageList
                messages={messages}
                projectPath={projectPath}
                isStreaming={isStreaming}
                onLinkDetected={handleLinkDetected}
                className="flex-1"
              />
              <PromptQueue
                queuedPrompts={queuedPrompts}
                onRemove={(id) => setQueuedPrompts(prev => prev.filter(p => p.id !== id))}
              />
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
          >
            <p className="text-sm text-destructive">{error}</p>
          </motion.div>
        )}

        {/* Floating prompt input */}
        {projectPath && (
          <FloatingPromptInput
            ref={promptInputRef}
            onSend={handleSendPrompt}
            disabled={!projectPath}
            isLoading={isStreaming}
            onCancel={async () => {
              if (claudeSessionId && isStreaming) {
                await api.cancelClaudeExecution(claudeSessionId);
              }
            }}
          />
        )}

        {/* Timeline Navigator */}
        {showTimeline && claudeSessionId && session && (
          <TimelineNavigator
            sessionId={claudeSessionId}
            projectId={session.project_id}
            projectPath={projectPath}
            currentMessageIndex={messages.length}
            onCheckpointSelect={async (checkpoint) => {
              const success = await restoreCheckpoint(checkpoint.id);
              if (success) {
                clearMessages();
                loadMessages(claudeSessionId);
              }
            }}
            onFork={handleFork}
            refreshVersion={timelineVersion}
          />
        )}

        {/* Settings dialogs */}
        {showSettings && claudeSessionId && session && (
          <CheckpointSettings
            sessionId={claudeSessionId}
            projectId={session.project_id}
            projectPath={projectPath}
            onClose={() => setShowSettings(false)}
          />
        )}

        {showSlashCommandsSettings && projectPath && (
          <SlashCommandsManager
            projectPath={projectPath}
          />
        )}

        {/* Fork dialog */}
        <Dialog open={showForkDialog} onOpenChange={setShowForkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Fork Session from Checkpoint</DialogTitle>
              <DialogDescription>
                Create a new session branching from this checkpoint. The original session will remain unchanged.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="fork-name">New Session Name</Label>
                <Input
                  id="fork-name"
                  value={forkSessionName}
                  onChange={(e) => setForkSessionName(e.target.value)}
                  placeholder="Enter a name for the forked session"
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForkDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmFork}
                disabled={!forkSessionName.trim()}
              >
                Fork Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
};