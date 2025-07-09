import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft,
  Terminal,
  FolderOpen,
  Copy,
  ChevronDown,
  GitBranch,
  Settings,
  ChevronUp,
  X,
  Hash,
  Command
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
import { FloatingPromptInput, type FloatingPromptInputRef } from "./FloatingPromptInput";
import { ErrorBoundary } from "./ErrorBoundary";
import { TimelineNavigator } from "./TimelineNavigator";
import { CheckpointSettings } from "./CheckpointSettings";
import { SlashCommandsManager } from "./SlashCommandsManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SplitPane } from "@/components/ui/split-pane";
import { WebviewPreview } from "./WebviewPreview";
import type { ClaudeStreamMessage } from "./AgentExecution";
import { useVirtualizer } from "@tanstack/react-virtual";

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
   * Callback to open hooks configuration
   */
  onProjectSettings?: (projectPath: string) => void;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Callback when streaming state changes
   */
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
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
  onProjectSettings,
  className,
  onStreamingChange,
}) => {
  const [projectPath, setProjectPath] = useState(initialProjectPath || session?.project_path || "");
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawJsonlOutput, setRawJsonlOutput] = useState<string[]>([]);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  const [isFirstPrompt, setIsFirstPrompt] = useState(!session);
  const [totalTokens, setTotalTokens] = useState(0);
  const [extractedSessionInfo, setExtractedSessionInfo] = useState<{ sessionId: string; projectId: string } | null>(null);
  const [claudeSessionId, setClaudeSessionId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showForkDialog, setShowForkDialog] = useState(false);
  const [showSlashCommandsSettings, setShowSlashCommandsSettings] = useState(false);
  const [forkCheckpointId, setForkCheckpointId] = useState<string | null>(null);
  const [forkSessionName, setForkSessionName] = useState("");
  
  // Queued prompts state
  const [queuedPrompts, setQueuedPrompts] = useState<Array<{ id: string; prompt: string; model: "sonnet" | "opus" }>>([]);
  
  // New state for preview feature
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showPreviewPrompt, setShowPreviewPrompt] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);
  
  // Add collapsed state for queued prompts
  const [queuedPromptsCollapsed, setQueuedPromptsCollapsed] = useState(false);
  
  const parentRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const hasActiveSessionRef = useRef(false);
  const floatingPromptRef = useRef<FloatingPromptInputRef>(null);
  const queuedPromptsRef = useRef<Array<{ id: string; prompt: string; model: "sonnet" | "opus" }>>([]);
  const isMountedRef = useRef(true);
  const isListeningRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    queuedPromptsRef.current = queuedPrompts;
  }, [queuedPrompts]);

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

  // Filter out messages that shouldn't be displayed
  const displayableMessages = useMemo(() => {
    return messages.filter((message, index) => {
      // Skip meta messages that don't have meaningful content
      if (message.isMeta && !message.leafUuid && !message.summary) {
        return false;
      }

      // Skip user messages that only contain tool results that are already displayed
      if (message.type === "user" && message.message) {
        if (message.isMeta) return false;

        const msg = message.message;
        if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) {
          return false;
        }

        if (Array.isArray(msg.content)) {
          let hasVisibleContent = false;
          for (const content of msg.content) {
            if (content.type === "text") {
              hasVisibleContent = true;
              break;
            }
            if (content.type === "tool_result") {
              let willBeSkipped = false;
              if (content.tool_use_id) {
                // Look for the matching tool_use in previous assistant messages
                for (let i = index - 1; i >= 0; i--) {
                  const prevMsg = messages[i];
                  if (prevMsg.type === 'assistant' && prevMsg.message?.content && Array.isArray(prevMsg.message.content)) {
                    const toolUse = prevMsg.message.content.find((c: any) => 
                      c.type === 'tool_use' && c.id === content.tool_use_id
                    );
                    if (toolUse) {
                      const toolName = toolUse.name?.toLowerCase();
                      const toolsWithWidgets = [
                        'task', 'edit', 'multiedit', 'todowrite', 'ls', 'read', 
                        'glob', 'bash', 'write', 'grep'
                      ];
                      if (toolsWithWidgets.includes(toolName) || toolUse.name?.startsWith('mcp__')) {
                        willBeSkipped = true;
                      }
                      break;
                    }
                  }
                }
              }
              if (!willBeSkipped) {
                hasVisibleContent = true;
                break;
              }
            }
          }
          if (!hasVisibleContent) {
            return false;
          }
        }
      }
      return true;
    });
  }, [messages]);

  const rowVirtualizer = useVirtualizer({
    count: displayableMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150, // Estimate, will be dynamically measured
    overscan: 5,
  });

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
      // Set the claudeSessionId immediately when we have a session
      setClaudeSessionId(session.id);
      
      // Load session history first, then check for active session
      const initializeSession = async () => {
        await loadSessionHistory();
        // After loading history, check if the session is still active
        if (isMountedRef.current) {
          await checkForActiveSession();
        }
      };
      
      initializeSession();
    }
  }, [session]); // Remove hasLoadedSession dependency to ensure it runs on mount

  // Report streaming state changes
  useEffect(() => {
    onStreamingChange?.(isLoading, claudeSessionId);
  }, [isLoading, claudeSessionId, onStreamingChange]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (displayableMessages.length > 0) {
      rowVirtualizer.scrollToIndex(displayableMessages.length - 1, { align: 'end', behavior: 'smooth' });
    }
  }, [displayableMessages.length, rowVirtualizer]);

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

  const checkForActiveSession = async () => {
    // If we have a session prop, check if it's still active
    if (session) {
      try {
        const activeSessions = await api.listRunningClaudeSessions();
        const activeSession = activeSessions.find((s: any) => {
          if ('process_type' in s && s.process_type && 'ClaudeSession' in s.process_type) {
            return (s.process_type as any).ClaudeSession.session_id === session.id;
          }
          return false;
        });
        
        if (activeSession) {
          // Session is still active, reconnect to its stream
          console.log('[ClaudeCodeSession] Found active session, reconnecting:', session.id);
          // IMPORTANT: Set claudeSessionId before reconnecting
          setClaudeSessionId(session.id);
          
          // Don't add buffered messages here - they've already been loaded by loadSessionHistory
          // Just set up listeners for new messages
          
          // Set up listeners for the active session
          reconnectToSession(session.id);
        }
      } catch (err) {
        console.error('Failed to check for active sessions:', err);
      }
    }
  };

  const reconnectToSession = async (sessionId: string) => {
    console.log('[ClaudeCodeSession] Reconnecting to session:', sessionId);
    
    // Prevent duplicate listeners
    if (isListeningRef.current) {
      console.log('[ClaudeCodeSession] Already listening to session, skipping reconnect');
      return;
    }
    
    // Clean up previous listeners
    unlistenRefs.current.forEach(unlisten => unlisten());
    unlistenRefs.current = [];
    
    // IMPORTANT: Set the session ID before setting up listeners
    setClaudeSessionId(sessionId);
    
    // Mark as listening
    isListeningRef.current = true;
    
    // Set up session-specific listeners
    const outputUnlisten = await listen<string>(`claude-output:${sessionId}`, async (event) => {
      try {
        console.log('[ClaudeCodeSession] Received claude-output on reconnect:', event.payload);
        
        if (!isMountedRef.current) return;
        
        // Store raw JSONL
        setRawJsonlOutput(prev => [...prev, event.payload]);
        
        // Parse and display
        const message = JSON.parse(event.payload) as ClaudeStreamMessage;
        setMessages(prev => [...prev, message]);
      } catch (err) {
        console.error("Failed to parse message:", err, event.payload);
      }
    });

    const errorUnlisten = await listen<string>(`claude-error:${sessionId}`, (event) => {
      console.error("Claude error:", event.payload);
      if (isMountedRef.current) {
        setError(event.payload);
      }
    });

    const completeUnlisten = await listen<boolean>(`claude-complete:${sessionId}`, async (event) => {
      console.log('[ClaudeCodeSession] Received claude-complete on reconnect:', event.payload);
      if (isMountedRef.current) {
        setIsLoading(false);
        hasActiveSessionRef.current = false;
      }
    });

    unlistenRefs.current = [outputUnlisten, errorUnlisten, completeUnlisten];
    
    // Mark as loading to show the session is active
    if (isMountedRef.current) {
      setIsLoading(true);
      hasActiveSessionRef.current = true;
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
    console.log('[ClaudeCodeSession] handleSendPrompt called with:', { prompt, model, projectPath, claudeSessionId, effectiveSession });
    
    if (!projectPath) {
      setError("Please select a project directory first");
      return;
    }

    // If already loading, queue the prompt
    if (isLoading) {
      const newPrompt = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        prompt,
        model
      };
      setQueuedPrompts(prev => [...prev, newPrompt]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      hasActiveSessionRef.current = true;
      
      // For resuming sessions, ensure we have the session ID
      if (effectiveSession && !claudeSessionId) {
        setClaudeSessionId(effectiveSession.id);
      }
      
      // Only clean up and set up new listeners if not already listening
      if (!isListeningRef.current) {
        // Clean up previous listeners
        unlistenRefs.current.forEach(unlisten => unlisten());
        unlistenRefs.current = [];
        
        // Mark as setting up listeners
        isListeningRef.current = true;
        
        // --------------------------------------------------------------------
        // 1️⃣  Event Listener Setup Strategy
        // --------------------------------------------------------------------
        // Claude Code may emit a *new* session_id even when we pass --resume. If
        // we listen only on the old session-scoped channel we will miss the
        // stream until the user navigates away & back. To avoid this we:
        //   • Always start with GENERIC listeners (no suffix) so we catch the
        //     very first "system:init" message regardless of the session id.
        //   • Once that init message provides the *actual* session_id, we
        //     dynamically switch to session-scoped listeners and stop the
        //     generic ones to prevent duplicate handling.
        // --------------------------------------------------------------------

        console.log('[ClaudeCodeSession] Setting up generic event listeners first');

        let currentSessionId: string | null = claudeSessionId || effectiveSession?.id || null;

        // Helper to attach session-specific listeners **once we are sure**
        const attachSessionSpecificListeners = async (sid: string) => {
          console.log('[ClaudeCodeSession] Attaching session-specific listeners for', sid);

          const specificOutputUnlisten = await listen<string>(`claude-output:${sid}`, (evt) => {
            handleStreamMessage(evt.payload);
          });

          const specificErrorUnlisten = await listen<string>(`claude-error:${sid}`, (evt) => {
            console.error('Claude error (scoped):', evt.payload);
            setError(evt.payload);
          });

          const specificCompleteUnlisten = await listen<boolean>(`claude-complete:${sid}`, (evt) => {
            console.log('[ClaudeCodeSession] Received claude-complete (scoped):', evt.payload);
            processComplete(evt.payload);
          });

          // Replace existing unlisten refs with these new ones (after cleaning up)
          unlistenRefs.current.forEach((u) => u());
          unlistenRefs.current = [specificOutputUnlisten, specificErrorUnlisten, specificCompleteUnlisten];
        };

        // Generic listeners (catch-all)
        const genericOutputUnlisten = await listen<string>('claude-output', async (event) => {
          handleStreamMessage(event.payload);

          // Attempt to extract session_id on the fly (for the very first init)
          try {
            const msg = JSON.parse(event.payload) as ClaudeStreamMessage;
            if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
              if (!currentSessionId || currentSessionId !== msg.session_id) {
                console.log('[ClaudeCodeSession] Detected new session_id from generic listener:', msg.session_id);
                currentSessionId = msg.session_id;
                setClaudeSessionId(msg.session_id);

                // If we haven't extracted session info before, do it now
                if (!extractedSessionInfo) {
                  const projectId = projectPath.replace(/[^a-zA-Z0-9]/g, '-');
                  setExtractedSessionInfo({ sessionId: msg.session_id, projectId });
                }

                // Switch to session-specific listeners
                await attachSessionSpecificListeners(msg.session_id);
              }
            }
          } catch {
            /* ignore parse errors */
          }
        });

        // Helper to process any JSONL stream message string
        function handleStreamMessage(payload: string) {
          try {
            // Don't process if component unmounted
            if (!isMountedRef.current) return;
            
            // Store raw JSONL
            setRawJsonlOutput((prev) => [...prev, payload]);

            const message = JSON.parse(payload) as ClaudeStreamMessage;
            setMessages((prev) => [...prev, message]);
          } catch (err) {
            console.error('Failed to parse message:', err, payload);
          }
        }

        // Helper to handle completion events (both generic and scoped)
        const processComplete = async (success: boolean) => {
          setIsLoading(false);
          hasActiveSessionRef.current = false;
          isListeningRef.current = false; // Reset listening state

          if (effectiveSession && success) {
            try {
              const settings = await api.getCheckpointSettings(
                effectiveSession.id,
                effectiveSession.project_id,
                projectPath
              );

              if (settings.auto_checkpoint_enabled) {
                await api.checkAutoCheckpoint(
                  effectiveSession.id,
                  effectiveSession.project_id,
                  projectPath,
                  prompt
                );
                // Reload timeline to show new checkpoint
                setTimelineVersion((v) => v + 1);
              }
            } catch (err) {
              console.error('Failed to check auto checkpoint:', err);
            }
          }

          // Process queued prompts after completion
          if (queuedPromptsRef.current.length > 0) {
            const [nextPrompt, ...remainingPrompts] = queuedPromptsRef.current;
            setQueuedPrompts(remainingPrompts);
            
            // Small delay to ensure UI updates
            setTimeout(() => {
              handleSendPrompt(nextPrompt.prompt, nextPrompt.model);
            }, 100);
          }
        };

        const genericErrorUnlisten = await listen<string>('claude-error', (evt) => {
          console.error('Claude error:', evt.payload);
          setError(evt.payload);
        });

        const genericCompleteUnlisten = await listen<boolean>('claude-complete', (evt) => {
          console.log('[ClaudeCodeSession] Received claude-complete (generic):', evt.payload);
          processComplete(evt.payload);
        });

        // Store the generic unlisteners for now; they may be replaced later.
        unlistenRefs.current = [genericOutputUnlisten, genericErrorUnlisten, genericCompleteUnlisten];

        // --------------------------------------------------------------------
        // 2️⃣  Auto-checkpoint logic moved after listener setup (unchanged)
        // --------------------------------------------------------------------

        // Add the user message immediately to the UI (after setting up listeners)
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

        // Execute the appropriate command
        if (effectiveSession && !isFirstPrompt) {
          console.log('[ClaudeCodeSession] Resuming session:', effectiveSession.id);
          await api.resumeClaudeCode(projectPath, effectiveSession.id, prompt, model);
        } else {
          console.log('[ClaudeCodeSession] Starting new session');
          setIsFirstPrompt(false);
          await api.executeClaudeCode(projectPath, prompt, model);
        }
      }
    } catch (err) {
      console.error("Failed to send prompt:", err);
      setError("Failed to send prompt");
      setIsLoading(false);
      hasActiveSessionRef.current = false;
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

  const handleCancelExecution = async () => {
    if (!claudeSessionId || !isLoading) return;
    
    try {
      await api.cancelClaudeExecution(claudeSessionId);
      
      // Clean up listeners
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
      
      // Reset states
      setIsLoading(false);
      hasActiveSessionRef.current = false;
      isListeningRef.current = false;
      setError(null);
      
      // Clear queued prompts
      setQueuedPrompts([]);
      
      // Add a message indicating the session was cancelled
      const cancelMessage: ClaudeStreamMessage = {
        type: "system",
        subtype: "info",
        result: "Session cancelled by user",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, cancelMessage]);
    } catch (err) {
      console.error("Failed to cancel execution:", err);
      
      // Even if backend fails, we should update UI to reflect stopped state
      // Add error message but still stop the UI loading state
      const errorMessage: ClaudeStreamMessage = {
        type: "system",
        subtype: "error",
        result: `Failed to cancel execution: ${err instanceof Error ? err.message : 'Unknown error'}. The process may still be running in the background.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Clean up listeners anyway
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
      
      // Reset states to allow user to continue
      setIsLoading(false);
      hasActiveSessionRef.current = false;
      isListeningRef.current = false;
      setError(null);
    }
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

  // Handle URL detection from terminal output
  const handleLinkDetected = (url: string) => {
    if (!showPreview && !showPreviewPrompt) {
      setPreviewUrl(url);
      setShowPreviewPrompt(true);
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setIsPreviewMaximized(false);
    // Keep the previewUrl so it can be restored when reopening
  };

  const handlePreviewUrlChange = (url: string) => {
    console.log('[ClaudeCodeSession] Preview URL changed to:', url);
    setPreviewUrl(url);
  };

  const handleTogglePreviewMaximize = () => {
    setIsPreviewMaximized(!isPreviewMaximized);
    // Reset split position when toggling maximize
    if (isPreviewMaximized) {
      setSplitPosition(50);
    }
  };

  // Cleanup event listeners and track mount state
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      console.log('[ClaudeCodeSession] Component unmounting, cleaning up listeners');
      isMountedRef.current = false;
      isListeningRef.current = false;
      
      // Clean up listeners
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
      
      // Clear checkpoint manager when session ends
      if (effectiveSession) {
        api.clearCheckpointManager(effectiveSession.id).catch(err => {
          console.error("Failed to clear checkpoint manager:", err);
        });
      }
    };
  }, [effectiveSession, projectPath]);

  const messagesList = (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto relative pb-40"
      style={{
        contain: 'strict',
      }}
    >
      <div
        className="relative w-full max-w-5xl mx-auto px-4 pt-8 pb-4"
        style={{
          height: `${Math.max(rowVirtualizer.getTotalSize(), 100)}px`,
          minHeight: '100px',
        }}
      >
        <AnimatePresence>
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const message = displayableMessages[virtualItem.index];
            return (
              <motion.div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={(el) => el && rowVirtualizer.measureElement(el)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-x-4 pb-4"
                style={{
                  top: virtualItem.start,
                }}
              >
                <StreamMessage 
                  message={message} 
                  streamMessages={messages}
                  onLinkDetected={handleLinkDetected}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Loading indicator under the latest message */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-4 mb-40"
        >
          <div className="rotating-symbol text-primary" />
        </motion.div>
      )}

      {/* Error indicator */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive mb-40 w-full max-w-5xl mx-auto"
        >
          {error}
        </motion.div>
      )}
    </div>
  );

  const projectPathInput = !session && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="p-4 border-b border-border flex-shrink-0"
    >
      <Label htmlFor="project-path" className="text-sm font-medium">
        Project Directory
      </Label>
      <div className="flex items-center gap-2 mt-1">
        <Input
          id="project-path"
          value={projectPath}
          onChange={(e) => setProjectPath(e.target.value)}
          placeholder="/path/to/your/project"
          className="flex-1"
          disabled={isLoading}
        />
        <Button
          onClick={handleSelectPath}
          size="icon"
          variant="outline"
          disabled={isLoading}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );

  // If preview is maximized, render only the WebviewPreview in full screen
  if (showPreview && isPreviewMaximized) {
    return (
      <AnimatePresence>
        <motion.div 
          className="fixed inset-0 z-50 bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <WebviewPreview
            initialUrl={previewUrl}
            onClose={handleClosePreview}
            isMaximized={isPreviewMaximized}
            onToggleMaximize={handleTogglePreviewMaximize}
            onUrlChange={handlePreviewUrlChange}
            className="h-full"
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="w-full h-full flex flex-col">
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
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <h1 className="text-xl font-bold">Claude Code Session</h1>
                <p className="text-sm text-muted-foreground">
                  {projectPath ? `${projectPath}` : "No project selected"}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {projectPath && onProjectSettings && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onProjectSettings(projectPath)}
                disabled={isLoading}
              >
                <Settings className="h-4 w-4 mr-2" />
                Hooks
              </Button>
            )}
            {projectPath && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSlashCommandsSettings(true)}
                disabled={isLoading}
              >
                <Command className="h-4 w-4 mr-2" />
                Commands
              </Button>
            )}
            <div className="flex items-center gap-2">
              {showSettings && (
                <CheckpointSettings
                  sessionId={effectiveSession?.id || ''}
                  projectId={effectiveSession?.project_id || ''}
                  projectPath={projectPath}
                />
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSettings(!showSettings)}
                      className="h-8 w-8"
                    >
                      <Settings className={cn("h-4 w-4", showSettings && "text-primary")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Checkpoint Settings</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {effectiveSession && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowTimeline(!showTimeline)}
                        className="h-8 w-8"
                      >
                        <GitBranch className={cn("h-4 w-4", showTimeline && "text-primary")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Timeline Navigator</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                        onClick={handleCopyAsMarkdown}
                        className="w-full justify-start"
                      >
                        Copy as Markdown
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyAsJsonl}
                        className="w-full justify-start"
                      >
                        Copy as JSONL
                      </Button>
                    </div>
                  }
                  open={copyPopoverOpen}
                  onOpenChange={setCopyPopoverOpen}
                />
              )}
            </div>
          </div>
        </motion.div>

        {/* Main Content Area */}
        <div className={cn(
          "flex-1 overflow-hidden transition-all duration-300",
          showTimeline && "sm:mr-96"
        )}>
          {showPreview ? (
            // Split pane layout when preview is active
            <SplitPane
              left={
                <div className="h-full flex flex-col">
                  {projectPathInput}
                  {messagesList}
                </div>
              }
              right={
                <WebviewPreview
                  initialUrl={previewUrl}
                  onClose={handleClosePreview}
                  isMaximized={isPreviewMaximized}
                  onToggleMaximize={handleTogglePreviewMaximize}
                  onUrlChange={handlePreviewUrlChange}
                />
              }
              initialSplit={splitPosition}
              onSplitChange={setSplitPosition}
              minLeftWidth={400}
              minRightWidth={400}
              className="h-full"
            />
          ) : (
            // Original layout when no preview
            <div className="h-full flex flex-col max-w-5xl mx-auto">
              {projectPathInput}
              {messagesList}
              
              {isLoading && messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3">
                    <div className="rotating-symbol text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {session ? "Loading session history..." : "Initializing Claude Code..."}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Prompt Input - Always visible */}
        <ErrorBoundary>
          {/* Queued Prompts Display */}
          <AnimatePresence>
            {queuedPrompts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 w-full max-w-3xl px-4"
              >
                <div className="bg-background/95 backdrop-blur-md border rounded-lg shadow-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Queued Prompts ({queuedPrompts.length})
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setQueuedPromptsCollapsed(prev => !prev)}>
                      {queuedPromptsCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </div>
                  {!queuedPromptsCollapsed && queuedPrompts.map((queuedPrompt, index) => (
                    <motion.div
                      key={queuedPrompt.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-2 bg-muted/50 rounded-md p-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                            {queuedPrompt.model === "opus" ? "Opus" : "Sonnet"}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2 break-words">{queuedPrompt.prompt}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => setQueuedPrompts(prev => prev.filter(p => p.id !== queuedPrompt.id))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Arrows - positioned above prompt bar with spacing */}
          {displayableMessages.length > 5 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.5 }}
              className="fixed bottom-32 right-6 z-50"
            >
              <div className="flex items-center bg-background/95 backdrop-blur-md border rounded-full shadow-lg overflow-hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Use virtualizer to scroll to the first item
                    if (displayableMessages.length > 0) {
                      // Scroll to top of the container
                      parentRef.current?.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                      });
                      
                      // After smooth scroll completes, trigger a small scroll to ensure rendering
                      setTimeout(() => {
                        if (parentRef.current) {
                          // Scroll down 1px then back to 0 to trigger virtualizer update
                          parentRef.current.scrollTop = 1;
                          requestAnimationFrame(() => {
                            if (parentRef.current) {
                              parentRef.current.scrollTop = 0;
                            }
                          });
                        }
                      }, 500); // Wait for smooth scroll to complete
                    }
                  }}
                  className="px-3 py-2 hover:bg-accent rounded-none"
                  title="Scroll to top"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-border" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Use virtualizer to scroll to the last item
                    if (displayableMessages.length > 0) {
                      // Scroll to bottom of the container
                      const scrollElement = parentRef.current;
                      if (scrollElement) {
                        scrollElement.scrollTo({
                          top: scrollElement.scrollHeight,
                          behavior: 'smooth'
                        });
                      }
                    }
                  }}
                  className="px-3 py-2 hover:bg-accent rounded-none"
                  title="Scroll to bottom"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          <div className={cn(
            "fixed bottom-0 left-0 right-0 transition-all duration-300 z-50",
            showTimeline && "sm:right-96"
          )}>
            <FloatingPromptInput
              ref={floatingPromptRef}
              onSend={handleSendPrompt}
              onCancel={handleCancelExecution}
              isLoading={isLoading}
              disabled={!projectPath}
              projectPath={projectPath}
            />
          </div>

          {/* Token Counter - positioned under the Send button */}
          {totalTokens > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
              <div className="max-w-5xl mx-auto">
                <div className="flex justify-end px-4 pb-2">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="bg-background/95 backdrop-blur-md border rounded-full px-3 py-1 shadow-lg pointer-events-auto"
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono">{totalTokens.toLocaleString()}</span>
                      <span className="text-muted-foreground">tokens</span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          )}
        </ErrorBoundary>

        {/* Timeline */}
        <AnimatePresence>
          {showTimeline && effectiveSession && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full sm:w-96 bg-background border-l border-border shadow-xl z-30 overflow-hidden"
            >
              <div className="h-full flex flex-col">
                {/* Timeline Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="text-lg font-semibold">Session Timeline</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowTimeline(false)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Timeline Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  <TimelineNavigator
                    sessionId={effectiveSession.id}
                    projectId={effectiveSession.project_id}
                    projectPath={projectPath}
                    currentMessageIndex={messages.length - 1}
                    onCheckpointSelect={handleCheckpointSelect}
                    onFork={handleFork}
                    refreshVersion={timelineVersion}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

      {/* Slash Commands Settings Dialog */}
      {showSlashCommandsSettings && (
        <Dialog open={showSlashCommandsSettings} onOpenChange={setShowSlashCommandsSettings}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Slash Commands</DialogTitle>
              <DialogDescription>
                Manage project-specific slash commands for {projectPath}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <SlashCommandsManager projectPath={projectPath} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
