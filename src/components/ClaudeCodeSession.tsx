import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft,
  Terminal,
  Loader2,
  FolderOpen,
  Copy,
  ChevronDown,
  GitBranch,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover } from "@/components/ui/popover";
import { api, type Session } from "@/lib/api";
import { cn } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { StreamMessage } from "./StreamMessage";
import { FloatingPromptInput } from "./FloatingPromptInput";
import { ErrorBoundary } from "./ErrorBoundary";
import { TokenCounter } from "./TokenCounter";
import { TimelineNavigator } from "./TimelineNavigator";
import { CheckpointSettings } from "./CheckpointSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { ClaudeStreamMessage } from "./AgentExecution";

interface ClaudeCodeSessionProps {
  /**
   * Optional session to resume (when clicking from SessionList)
   */
  session?: Session;
  /**
   * Initial project path (for new sessions)
   */
  initialProjectPath?: string;
  /**
   * Callback to go back
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * ClaudeCodeSession component for interactive Claude Code sessions
 * 
 * @example
 * <ClaudeCodeSession onBack={() => setView('projects')} />
 */
export const ClaudeCodeSession: React.FC<ClaudeCodeSessionProps> = ({
  session,
  initialProjectPath = "",
  onBack,
  className,
}) => {
  const [projectPath, setProjectPath] = useState(initialProjectPath || session?.project_path || "");
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawJsonlOutput, setRawJsonlOutput] = useState<string[]>([]);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  const [isFirstPrompt, setIsFirstPrompt] = useState(!session);
  const [currentModel, setCurrentModel] = useState<"sonnet" | "opus">("sonnet");
  const [totalTokens, setTotalTokens] = useState(0);
  const [extractedSessionInfo, setExtractedSessionInfo] = useState<{
    sessionId: string;
    projectId: string;
  } | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showForkDialog, setShowForkDialog] = useState(false);
  const [forkCheckpointId, setForkCheckpointId] = useState<string | null>(null);
  const [forkSessionName, setForkSessionName] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const hasActiveSessionRef = useRef(false);

  // Get effective session info (from prop or extracted) - use useMemo to ensure it updates
  const effectiveSession = useMemo(() => {
    if (session) return session;
    if (extractedSessionInfo) {
      return {
        id: extractedSessionInfo.sessionId,
        project_id: extractedSessionInfo.projectId,
        project_path: projectPath,
        created_at: Date.now(),
      } as Session;
    }
    return null;
  }, [session, extractedSessionInfo, projectPath]);

  // Debug logging
  useEffect(() => {
    console.log('[ClaudeCodeSession] State update:', {
      projectPath,
      session,
      extractedSessionInfo,
      effectiveSession,
      messagesCount: messages.length,
      isLoading
    });
  }, [projectPath, session, extractedSessionInfo, effectiveSession, messages.length, isLoading]);

  // Load session history if resuming
  useEffect(() => {
    if (session) {
      loadSessionHistory();
    }
  }, [session]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Calculate total tokens from messages
  useEffect(() => {
    const tokens = messages.reduce((total, msg) => {
      if (msg.message?.usage) {
        return total + msg.message.usage.input_tokens + msg.message.usage.output_tokens;
      }
      if (msg.usage) {
        return total + msg.usage.input_tokens + msg.usage.output_tokens;
      }
      return total;
    }, 0);
    setTotalTokens(tokens);
  }, [messages]);

  const loadSessionHistory = async () => {
    if (!session) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const history = await api.loadSessionHistory(session.id, session.project_id);
      
      // Convert history to messages format
      const loadedMessages: ClaudeStreamMessage[] = history.map(entry => ({
        ...entry,
        type: entry.type || "assistant"
      }));
      
      setMessages(loadedMessages);
      setRawJsonlOutput(history.map(h => JSON.stringify(h)));
      
      // After loading history, we're continuing a conversation
      setIsFirstPrompt(false);
    } catch (err) {
      console.error("Failed to load session history:", err);
      setError("Failed to load session history");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory"
      });
      
      if (selected) {
        setProjectPath(selected as string);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to select directory: ${errorMessage}`);
    }
  };

  const handleSendPrompt = async (prompt: string, model: "sonnet" | "opus") => {
    if (!projectPath || !prompt.trim() || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);
      setCurrentModel(model);
      hasActiveSessionRef.current = true;

      // Add the user message immediately to the UI
      const userMessage: ClaudeStreamMessage = {
        type: "user",
        message: {
          content: [
            {
              type: "text",
              text: prompt
            }
          ]
        }
      };
      setMessages(prev => [...prev, userMessage]);

      // Clean up any existing listeners before creating new ones
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];

      // Set up event listeners
      const outputUnlisten = await listen<string>("claude-output", async (event) => {
        try {
          console.log('[ClaudeCodeSession] Received claude-output:', event.payload);
          
          // Store raw JSONL
          setRawJsonlOutput(prev => [...prev, event.payload]);
          
          // Parse and display
          const message = JSON.parse(event.payload) as ClaudeStreamMessage;
          console.log('[ClaudeCodeSession] Parsed message:', message);
          
          setMessages(prev => {
            console.log('[ClaudeCodeSession] Adding message to state. Previous count:', prev.length);
            return [...prev, message];
          });
          
          // Extract session info from system init message
          if (message.type === "system" && message.subtype === "init" && message.session_id && !extractedSessionInfo) {
            console.log('[ClaudeCodeSession] Extracting session info from init message');
            // Extract project ID from the project path
            const projectId = projectPath.replace(/[^a-zA-Z0-9]/g, '-');
            setExtractedSessionInfo({
              sessionId: message.session_id,
              projectId: projectId
            });
          }
        } catch (err) {
          console.error("Failed to parse message:", err, event.payload);
        }
      });

      const errorUnlisten = await listen<string>("claude-error", (event) => {
        console.error("Claude error:", event.payload);
        setError(event.payload);
      });

      const cancelledUnlisten = await listen<boolean>("claude-cancelled", (event) => {
        console.log('[ClaudeCodeSession] Received claude-cancelled:', event.payload);
        setIsLoading(false);
        hasActiveSessionRef.current = false;
        setError("Execution cancelled by user");
      });

      const completeUnlisten = await listen<boolean>("claude-complete", async (event) => {
        console.log('[ClaudeCodeSession] Received claude-complete:', event.payload);
        setIsLoading(false);
        hasActiveSessionRef.current = false;
        if (!event.payload) {
          setError("Claude execution failed");
        }
        
        // Track all messages at once after completion (batch operation)
        if (effectiveSession && rawJsonlOutput.length > 0) {
          console.log('[ClaudeCodeSession] Tracking all messages in batch:', rawJsonlOutput.length);
          api.trackSessionMessages(
            effectiveSession.id,
            effectiveSession.project_id,
            projectPath,
            rawJsonlOutput
          ).catch(err => {
            console.error("Failed to track session messages:", err);
          });
        }
        
        // Check if we should auto-checkpoint
        if (effectiveSession && messages.length > 0) {
          try {
            const lastMessage = messages[messages.length - 1];
            const shouldCheckpoint = await api.checkAutoCheckpoint(
              effectiveSession.id,
              effectiveSession.project_id,
              projectPath,
              JSON.stringify(lastMessage)
            );
            
            if (shouldCheckpoint) {
              await api.createCheckpoint(
                effectiveSession.id,
                effectiveSession.project_id,
                projectPath,
                messages.length - 1,
                "Auto-checkpoint after tool use"
              );
              console.log("Auto-checkpoint created");
              // Trigger timeline reload if it's currently visible
              setTimelineVersion((v) => v + 1);
            }
          } catch (err) {
            console.error("Failed to check/create auto-checkpoint:", err);
          }
        }
        
        // Clean up listeners after completion
        unlistenRefs.current.forEach(unlisten => unlisten());
        unlistenRefs.current = [];
      });

      unlistenRefs.current = [outputUnlisten, errorUnlisten, cancelledUnlisten, completeUnlisten];

      // Execute the appropriate command
      if (isFirstPrompt && !session) {
        // New session
        await api.executeClaudeCode(projectPath, prompt, model);
        setIsFirstPrompt(false);
      } else if (session && isFirstPrompt) {
        // Resuming a session
        await api.resumeClaudeCode(projectPath, session.id, prompt, model);
        setIsFirstPrompt(false);
      } else {
        // Continuing conversation
        await api.continueClaudeCode(projectPath, prompt, model);
      }
    } catch (err) {
      console.error("Failed to send prompt:", err);
      setError("Failed to execute Claude Code");
      setIsLoading(false);
      hasActiveSessionRef.current = false;
    }
  };

  const handleCancel = async () => {
    try {
      console.log('[ClaudeCodeSession] Cancelling Claude Code process');
      const result = await api.cancelClaudeCode();
      console.log('[ClaudeCodeSession] Cancel result:', result);
    } catch (err) {
      console.error('[ClaudeCodeSession] Error cancelling:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel process');
    }
  };

  const handleCopyAsJsonl = async () => {
    const jsonl = rawJsonlOutput.join('\n');
    await navigator.clipboard.writeText(jsonl);
    setCopyPopoverOpen(false);
  };

  const handleCopyAsMarkdown = async () => {
    let markdown = `# Claude Code Session\n\n`;
    markdown += `**Project:** ${projectPath}\n`;
    markdown += `**Date:** ${new Date().toISOString()}\n\n`;
    markdown += `---\n\n`;

    for (const msg of messages) {
      if (msg.type === "system" && msg.subtype === "init") {
        markdown += `## System Initialization\n\n`;
        markdown += `- Session ID: \`${msg.session_id || 'N/A'}\`\n`;
        markdown += `- Model: \`${msg.model || 'default'}\`\n`;
        if (msg.cwd) markdown += `- Working Directory: \`${msg.cwd}\`\n`;
        if (msg.tools?.length) markdown += `- Tools: ${msg.tools.join(', ')}\n`;
        markdown += `\n`;
      } else if (msg.type === "assistant" && msg.message) {
        markdown += `## Assistant\n\n`;
        for (const content of msg.message.content || []) {
          if (content.type === "text") {
            const textContent = typeof content.text === 'string' 
              ? content.text 
              : (content.text?.text || JSON.stringify(content.text || content));
            markdown += `${textContent}\n\n`;
          } else if (content.type === "tool_use") {
            markdown += `### Tool: ${content.name}\n\n`;
            markdown += `\`\`\`json\n${JSON.stringify(content.input, null, 2)}\n\`\`\`\n\n`;
          }
        }
        if (msg.message.usage) {
          markdown += `*Tokens: ${msg.message.usage.input_tokens} in, ${msg.message.usage.output_tokens} out*\n\n`;
        }
      } else if (msg.type === "user" && msg.message) {
        markdown += `## User\n\n`;
        for (const content of msg.message.content || []) {
          if (content.type === "text") {
            const textContent = typeof content.text === 'string' 
              ? content.text 
              : (content.text?.text || JSON.stringify(content.text));
            markdown += `${textContent}\n\n`;
          } else if (content.type === "tool_result") {
            markdown += `### Tool Result\n\n`;
            let contentText = '';
            if (typeof content.content === 'string') {
              contentText = content.content;
            } else if (content.content && typeof content.content === 'object') {
              if (content.content.text) {
                contentText = content.content.text;
              } else if (Array.isArray(content.content)) {
                contentText = content.content
                  .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
                  .join('\n');
              } else {
                contentText = JSON.stringify(content.content, null, 2);
              }
            }
            markdown += `\`\`\`\n${contentText}\n\`\`\`\n\n`;
          }
        }
      } else if (msg.type === "result") {
        markdown += `## Execution Result\n\n`;
        if (msg.result) {
          markdown += `${msg.result}\n\n`;
        }
        if (msg.error) {
          markdown += `**Error:** ${msg.error}\n\n`;
        }
      }
    }

    await navigator.clipboard.writeText(markdown);
    setCopyPopoverOpen(false);
  };

  const handleCheckpointSelect = async () => {
    // Reload messages from the checkpoint
    await loadSessionHistory();
    // Ensure timeline reloads to highlight current checkpoint
    setTimelineVersion((v) => v + 1);
  };

  const handleFork = (checkpointId: string) => {
    setForkCheckpointId(checkpointId);
    setForkSessionName(`Fork-${new Date().toISOString().slice(0, 10)}`);
    setShowForkDialog(true);
  };

  const handleConfirmFork = async () => {
    if (!forkCheckpointId || !forkSessionName.trim() || !effectiveSession) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const newSessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await api.forkFromCheckpoint(
        forkCheckpointId,
        effectiveSession.id,
        effectiveSession.project_id,
        projectPath,
        newSessionId,
        forkSessionName
      );
      
      // Open the new forked session
      // You would need to implement navigation to the new session
      console.log("Forked to new session:", newSessionId);
      
      setShowForkDialog(false);
      setForkCheckpointId(null);
      setForkSessionName("");
    } catch (err) {
      console.error("Failed to fork checkpoint:", err);
      setError("Failed to fork checkpoint");
    } finally {
      setIsLoading(false);
    }
  };

  // Clean up listeners on component unmount
  useEffect(() => {
    return () => {
      unlistenRefs.current.forEach(unlisten => unlisten());
      // Clear checkpoint manager when session ends
      if (effectiveSession) {
        api.clearCheckpointManager(effectiveSession.id).catch(err => {
          console.error("Failed to clear checkpoint manager:", err);
        });
      }
    };
  }, []);

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="w-full max-w-5xl mx-auto h-full flex flex-col">
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
              onClick={onBack}
              className="h-8 w-8"
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              <div>
                <h2 className="text-lg font-semibold">Claude Code Session</h2>
                <p className="text-xs text-muted-foreground">
                  {session ? `Resuming session ${session.id.slice(0, 8)}...` : 'Interactive session'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {effectiveSession && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTimeline(!showTimeline)}
                  className="flex items-center gap-2"
                >
                  <GitBranch className="h-4 w-4" />
                  Timeline
                </Button>
              </>
            )}
            
            {messages.length > 0 && (
              <Popover
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Output
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                }
                content={
                  <div className="w-44 p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleCopyAsJsonl}
                    >
                      Copy as JSONL
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleCopyAsMarkdown}
                    >
                      Copy as Markdown
                    </Button>
                  </div>
                }
                open={copyPopoverOpen}
                onOpenChange={setCopyPopoverOpen}
                align="end"
              />
            )}
          </div>
        </motion.div>

        {/* Timeline Navigator */}
        {showTimeline && effectiveSession && (
          <div className="border-b border-border">
            <div className="p-4">
              <TimelineNavigator
                sessionId={effectiveSession.id}
                projectId={effectiveSession.project_id}
                projectPath={projectPath}
                currentMessageIndex={messages.length - 1}
                onCheckpointSelect={handleCheckpointSelect}
                refreshVersion={timelineVersion}
                onFork={handleFork}
              />
            </div>
          </div>
        )}

        {/* Project Path Selection (only for new sessions) */}
        {!session && (
          <div className="p-4 border-b border-border space-y-4">
            {/* Error display */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
              >
                {error}
              </motion.div>
            )}

            {/* Project Path */}
            <div className="space-y-2">
              <Label>Project Path</Label>
              <div className="flex gap-2">
                <Input
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="Select or enter project path"
                  disabled={hasActiveSessionRef.current}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSelectPath}
                  disabled={hasActiveSessionRef.current}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Messages Display */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-40">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Terminal className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Ready to Start</h3>
              <p className="text-sm text-muted-foreground">
                {session 
                  ? "Send a message to continue this conversation" 
                  : "Select a project path and send your first prompt"
                }
              </p>
            </div>
          )}

          {isLoading && messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  {session ? "Loading session history..." : "Initializing Claude Code..."}
                </span>
              </div>
            </div>
          )}

          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ErrorBoundary>
                  <StreamMessage message={message} streamMessages={messages} />
                </ErrorBoundary>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {/* Show loading indicator when processing, even if there are messages */}
          {isLoading && messages.length > 0 && (
            <div className="flex items-center gap-2 p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Processing...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Prompt Input */}
      <FloatingPromptInput
        onSend={handleSendPrompt}
        isLoading={isLoading}
        disabled={!projectPath && !session}
        defaultModel={currentModel}
        projectPath={projectPath}
        onCancel={handleCancel}
      />
      
      {/* Token Counter */}
      <TokenCounter tokens={totalTokens} />

      {/* Fork Dialog */}
      <Dialog open={showForkDialog} onOpenChange={setShowForkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fork Session</DialogTitle>
            <DialogDescription>
              Create a new session branch from the selected checkpoint.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fork-name">New Session Name</Label>
              <Input
                id="fork-name"
                placeholder="e.g., Alternative approach"
                value={forkSessionName}
                onChange={(e) => setForkSessionName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !isLoading) {
                    handleConfirmFork();
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForkDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmFork}
              disabled={isLoading || !forkSessionName.trim()}
            >
              Create Fork
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      {showSettings && effectiveSession && (
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-2xl">
            <CheckpointSettings
              sessionId={effectiveSession.id}
              projectId={effectiveSession.project_id}
              projectPath={projectPath}
              onClose={() => setShowSettings(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}; 