import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Play, 
  StopCircle, 
  Terminal,
  AlertCircle,
  Loader2,
  Copy,
  ChevronDown,
  Maximize2,
  X,
  Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api, type Agent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { StreamMessage } from "./StreamMessage";
import { ExecutionControlBar } from "./ExecutionControlBar";
import { ErrorBoundary } from "./ErrorBoundary";
import { useVirtualizer } from "@tanstack/react-virtual";
import { HooksEditor } from "./HooksEditor";
import { useTrackEvent, useComponentMetrics, useFeatureAdoptionTracking } from "@/hooks";
import { useTabState } from "@/hooks/useTabState";

interface AgentExecutionProps {
  /**
   * The agent to execute
   */
  agent: Agent;
  /**
   * Optional initial project path
   */
  projectPath?: string;
  /**
   * Optional tab ID for updating tab status
   */
  tabId?: string;
  /**
   * Callback to go back to the agents list
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

export interface ClaudeStreamMessage {
  type: "system" | "assistant" | "user" | "result";
  subtype?: string;
  message?: {
    content?: any[];
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  [key: string]: any;
}

/**
 * AgentExecution component for running CC agents
 * 
 * @example
 * <AgentExecution agent={agent} onBack={() => setView('list')} />
 */
export const AgentExecution: React.FC<AgentExecutionProps> = ({
  agent,
  projectPath: initialProjectPath,
  tabId,
  onBack,
  className,
}) => {
  const [projectPath] = useState(initialProjectPath || "");
  const [task, setTask] = useState(agent.default_task || "");
  const [model, setModel] = useState(agent.model || "sonnet");
  const [isRunning, setIsRunning] = useState(false);
  
  // Get tab state functions
  const { updateTabStatus } = useTabState();
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [rawJsonlOutput, setRawJsonlOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  
  // Analytics tracking
  const trackEvent = useTrackEvent();
  useComponentMetrics('AgentExecution');
  const agentFeatureTracking = useFeatureAdoptionTracking(`agent_${agent.name || 'custom'}`);
  
  // Hooks configuration state
  const [isHooksDialogOpen, setIsHooksDialogOpen] = useState(false);

  // IME composition state
  const isIMEComposingRef = useRef(false);
  const [activeHooksTab, setActiveHooksTab] = useState("project");

  // Execution stats
  const [executionStartTime, setExecutionStartTime] = useState<number | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenScrollRef = useRef<HTMLDivElement>(null);
  const fullscreenMessagesEndRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const elapsedTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [runId, setRunId] = useState<number | null>(null);

  // Filter out messages that shouldn't be displayed
  const displayableMessages = React.useMemo(() => {
    return messages.filter((message, index) => {
      // Skip meta messages that don't have meaningful content
      if (message.isMeta && !message.leafUuid && !message.summary) {
        return false;
      }

      // Skip empty user messages
      if (message.type === "user" && message.message) {
        if (message.isMeta) return false;
        
        const msg = message.message;
        if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) {
          return false;
        }
        
        // Check if user message has visible content by checking its parts
        if (Array.isArray(msg.content)) {
          let hasVisibleContent = false;
          for (const content of msg.content) {
            if (content.type === "text") {
              hasVisibleContent = true;
              break;
            } else if (content.type === "tool_result") {
              // Check if this tool result will be skipped by a widget
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

  // Virtualizers for efficient, smooth scrolling of potentially very long outputs
  const rowVirtualizer = useVirtualizer({
    count: displayableMessages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 150, // fallback estimate; dynamically measured afterwards
    overscan: 5,
  });

  const fullscreenRowVirtualizer = useVirtualizer({
    count: displayableMessages.length,
    getScrollElement: () => fullscreenScrollRef.current,
    estimateSize: () => 150,
    overscan: 5,
  });

  useEffect(() => {
    // Clean up listeners on unmount
    return () => {
      unlistenRefs.current.forEach(unlisten => unlisten());
      if (elapsedTimeIntervalRef.current) {
        clearInterval(elapsedTimeIntervalRef.current);
      }
    };
  }, []);

  // Check if user is at the very bottom of the scrollable container
  const isAtBottom = () => {
    const container = isFullscreenModalOpen ? fullscreenScrollRef.current : scrollContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      return distanceFromBottom < 1;
    }
    return true;
  };

  useEffect(() => {
    if (displayableMessages.length === 0) return;

    // Auto-scroll only if the user has not manually scrolled OR they are still at the bottom
    const shouldAutoScroll = !hasUserScrolled || isAtBottom();

    if (shouldAutoScroll) {
      if (isFullscreenModalOpen) {
        fullscreenRowVirtualizer.scrollToIndex(displayableMessages.length - 1, { align: "end", behavior: "smooth" });
      } else {
        rowVirtualizer.scrollToIndex(displayableMessages.length - 1, { align: "end", behavior: "smooth" });
      }
    }
  }, [displayableMessages.length, hasUserScrolled, isFullscreenModalOpen, rowVirtualizer, fullscreenRowVirtualizer]);

  // Update elapsed time while running
  useEffect(() => {
    if (isRunning && executionStartTime) {
      elapsedTimeIntervalRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - executionStartTime) / 1000));
      }, 100);
    } else {
      if (elapsedTimeIntervalRef.current) {
        clearInterval(elapsedTimeIntervalRef.current);
      }
    }
    
    return () => {
      if (elapsedTimeIntervalRef.current) {
        clearInterval(elapsedTimeIntervalRef.current);
      }
    };
  }, [isRunning, executionStartTime]);

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


  // Project path selection is handled upstream when opening an execution tab

  const handleOpenHooksDialog = async () => {
    setIsHooksDialogOpen(true);
  };

  const handleExecute = async () => {
    try {
      setIsRunning(true);
      // Update tab status to running
      console.log('Setting tab status to running for tab:', tabId);
      if (tabId) {
        updateTabStatus(tabId, 'running');
      }
      setExecutionStartTime(Date.now());
      setMessages([]);
      setRawJsonlOutput([]);
      setRunId(null);
      
      // Clear any existing listeners
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
      
      // Execute the agent and get the run ID
      const executionRunId = await api.executeAgent(agent.id!, projectPath, task, model);
      console.log("Agent execution started with run ID:", executionRunId);
      setRunId(executionRunId);
      
      // Track agent execution start
      trackEvent.agentStarted({
        agent_type: agent.name || 'custom',
        agent_name: agent.name,
        has_custom_prompt: task !== agent.default_task
      });
      
      // Track feature adoption
      agentFeatureTracking.trackUsage();
      
      // Set up event listeners with run ID isolation
      const outputUnlisten = await listen<string>(`agent-output:${executionRunId}`, (event) => {
        try {
          // Store raw JSONL
          setRawJsonlOutput(prev => [...prev, event.payload]);
          
          // Parse and display
          const message = JSON.parse(event.payload) as ClaudeStreamMessage;
          setMessages(prev => [...prev, message]);
        } catch (err) {
          console.error("Failed to parse message:", err, event.payload);
        }
      });

      const errorUnlisten = await listen<string>(`agent-error:${executionRunId}`, (event) => {
        console.error("Agent error:", event.payload);
        setError(event.payload);
        
        // Track agent error
        trackEvent.agentError({
          error_type: 'runtime_error',
          error_stage: 'execution',
          retry_count: 0,
          agent_type: agent.name || 'custom'
        });
      });

      const completeUnlisten = await listen<boolean>(`agent-complete:${executionRunId}`, (event) => {
        setIsRunning(false);
        const duration = executionStartTime ? Date.now() - executionStartTime : undefined;
        setExecutionStartTime(null);
        if (!event.payload) {
          setError("Agent execution failed");
          // Update tab status to error
          if (tabId) {
            updateTabStatus(tabId, 'error');
          }
          // Track both the old event for compatibility and the new error event
          trackEvent.agentExecuted(agent.name || 'custom', false, agent.name, duration);
          trackEvent.agentError({
            error_type: 'execution_failed',
            error_stage: 'completion',
            retry_count: 0,
            agent_type: agent.name || 'custom'
          });
        } else {
          // Update tab status to complete on success
          if (tabId) {
            updateTabStatus(tabId, 'complete');
          }
          trackEvent.agentExecuted(agent.name || 'custom', true, agent.name, duration);
        }
      });

      const cancelUnlisten = await listen<boolean>(`agent-cancelled:${executionRunId}`, () => {
        setIsRunning(false);
        setExecutionStartTime(null);
        setError("Agent execution was cancelled");
        // Update tab status to idle when cancelled
        if (tabId) {
          updateTabStatus(tabId, 'idle');
        }
      });

      unlistenRefs.current = [outputUnlisten, errorUnlisten, completeUnlisten, cancelUnlisten];
    } catch (err) {
      console.error("Failed to execute agent:", err);
      setIsRunning(false);
      setExecutionStartTime(null);
      setRunId(null);
      // Update tab status to error
      if (tabId) {
        updateTabStatus(tabId, 'error');
      }
      // Show error in messages
      setMessages(prev => [...prev, {
        type: "result",
        subtype: "error",
        is_error: true,
        result: `Failed to execute agent: ${err instanceof Error ? err.message : 'Unknown error'}`,
        duration_ms: 0,
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      }]);
    }
  };

  const handleStop = async () => {
    try {
      if (!runId) {
        console.error("No run ID available to stop");
        return;
      }

      // Call the API to kill the agent session
      const success = await api.killAgentSession(runId);

      if (success) {
        console.log(`Successfully stopped agent session ${runId}`);
      } else {
        console.warn(`Failed to stop agent session ${runId} - it may have already finished`);
      }

      // Update UI state
      setIsRunning(false);
      setExecutionStartTime(null);
    } catch (err) {
      console.error("Failed to stop agent:", err);
    }
  };

  const handleCompositionStart = () => {
    isIMEComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    setTimeout(() => {
      isIMEComposingRef.current = false;
    }, 0);
  };

  const handleBackWithConfirmation = () => {
    if (isRunning) {
      // Show confirmation dialog before navigating away during execution
      const shouldLeave = window.confirm(
        "An agent is currently running. If you navigate away, the agent will continue running in the background. You can view running sessions in the 'Running Sessions' tab within CC Agents.\n\nDo you want to continue?"
      );
      if (!shouldLeave) {
        return;
      }
    }
    
    // Clean up listeners but don't stop the actual agent process
    unlistenRefs.current.forEach(unlisten => unlisten());
    unlistenRefs.current = [];
    
    // Navigate back
    onBack();
  };

  const handleCopyAsJsonl = async () => {
    const jsonl = rawJsonlOutput.join('\n');
    await navigator.clipboard.writeText(jsonl);
    setCopyPopoverOpen(false);
  };

  const handleCopyAsMarkdown = async () => {
    let markdown = `# Agent Execution: ${agent.name}\n\n`;
    markdown += `**Task:** ${task}\n`;
    markdown += `**Model:** ${model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}\n`;
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
            markdown += `${content.text}\n\n`;
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
            markdown += `${content.text}\n\n`;
          } else if (content.type === "tool_result") {
            markdown += `### Tool Result\n\n`;
            markdown += `\`\`\`\n${content.content}\n\`\`\`\n\n`;
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
        if (msg.cost_usd !== undefined) {
          markdown += `- **Cost:** $${msg.cost_usd.toFixed(4)} USD\n`;
        }
        if (msg.duration_ms !== undefined) {
          markdown += `- **Duration:** ${(msg.duration_ms / 1000).toFixed(2)}s\n`;
        }
        if (msg.num_turns !== undefined) {
          markdown += `- **Turns:** ${msg.num_turns}\n`;
        }
        if (msg.usage) {
          const total = msg.usage.input_tokens + msg.usage.output_tokens;
          markdown += `- **Total Tokens:** ${total} (${msg.usage.input_tokens} in, ${msg.usage.output_tokens} out)\n`;
        }
      }
    }

    await navigator.clipboard.writeText(markdown);
    setCopyPopoverOpen(false);
  };


  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Fixed container that takes full height */}
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackWithConfirmation}
                className="h-9 w-9 -ml-2"
                title="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-heading-1">{agent.name}</h1>
                <p className="mt-1 text-body-small text-muted-foreground">
                  {isRunning ? 'Running' : messages.length > 0 ? 'Complete' : 'Ready'} • {model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => setIsFullscreenModalOpen(true)}
                >
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Fullscreen
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Configuration Section */}
        <div className="p-6 border-b border-border">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Error display */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="p-3 rounded-md bg-destructive/10 border border-destructive/50 flex items-center gap-2"
              >
                <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                <span className="text-caption text-destructive">{error}</span>
              </motion.div>
            )}

            {/* Model Selection */}
            <div className="space-y-3">
              <Label className="text-caption text-muted-foreground">Model Selection</Label>
              <div className="flex gap-2">
                <motion.button
                  type="button"
                  onClick={() => !isRunning && setModel("sonnet")}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "flex-1 px-4 py-3 rounded-md border transition-all",
                    model === "sonnet" 
                      ? "border-primary bg-primary/10 text-primary" 
                      : "border-border hover:border-primary/50 hover:bg-accent",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={isRunning}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      model === "sonnet" ? "border-primary" : "border-muted-foreground"
                    )}>
                      {model === "sonnet" && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-body-small font-medium">Claude 4 Sonnet</div>
                      <div className="text-caption text-muted-foreground">Faster, efficient</div>
                    </div>
                  </div>
                </motion.button>
                
                <motion.button
                  type="button"
                  onClick={() => !isRunning && setModel("opus")}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "flex-1 px-4 py-3 rounded-md border transition-all",
                    model === "opus" 
                      ? "border-primary bg-primary/10 text-primary" 
                      : "border-border hover:border-primary/50 hover:bg-accent",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={isRunning}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      model === "opus" ? "border-primary" : "border-muted-foreground"
                    )}>
                      {model === "opus" && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-body-small font-medium">Claude 4 Opus</div>
                      <div className="text-caption text-muted-foreground">More capable</div>
                    </div>
                  </div>
                </motion.button>
              </div>
            </div>

            {/* Task Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-caption text-muted-foreground">Task Description</Label>
                {projectPath && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenHooksDialog}
                    disabled={isRunning}
                    className="h-8 -mr-2"
                  >
                    <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                    <span className="text-caption">Configure Hooks</span>
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="What would you like the agent to do?"
                  disabled={isRunning}
                  className="flex-1 h-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isRunning && projectPath && task.trim()) {
                      if (e.nativeEvent.isComposing || isIMEComposingRef.current) {
                        return;
                      }
                      handleExecute();
                    }
                  }}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                />
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    onClick={isRunning ? handleStop : handleExecute}
                    disabled={!projectPath || !task.trim()}
                    variant={isRunning ? "destructive" : "default"}
                    size="default"
                  >
                    {isRunning ? (
                      <>
                        <StopCircle className="mr-2 h-4 w-4" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Execute
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
              {projectPath && (
                <p className="text-caption text-muted-foreground">
                  Working in: <span className="font-mono">{projectPath.split('/').pop() || projectPath}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Output Display */}
        <div className="flex-1 overflow-hidden">
          <div className="w-full max-w-5xl mx-auto h-full">
            <div 
              ref={scrollContainerRef}
              className="h-full overflow-y-auto p-6 space-y-8"
              onScroll={() => {
                // Mark that user has scrolled manually
                if (!hasUserScrolled) {
                  setHasUserScrolled(true);
                }
                
                // If user scrolls back to bottom, re-enable auto-scroll
                if (isAtBottom()) {
                  setHasUserScrolled(false);
                }
              }}
            >
              <div ref={messagesContainerRef}>
              {messages.length === 0 && !isRunning && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Terminal className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Ready to Execute</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter a task to run the agent
                  </p>
                </div>
              )}

              {isRunning && messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm text-muted-foreground">Initializing agent...</span>
                  </div>
                </div>
              )}

              <div
                className="relative w-full"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
                <AnimatePresence>
                  {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const message = displayableMessages[virtualItem.index];
                    return (
                      <motion.div
                        key={virtualItem.key}
                        data-index={virtualItem.index}
                        ref={(el) => el && rowVirtualizer.measureElement(el)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-x-4 pb-4"
                        style={{ top: virtualItem.start }}
                      >
                        <ErrorBoundary>
                          <StreamMessage message={message} streamMessages={messages} />
                        </ErrorBoundary>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
              
              <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Execution Control Bar */}
      <ExecutionControlBar
        isExecuting={isRunning}
        onStop={handleStop}
        totalTokens={totalTokens}
        elapsedTime={elapsedTime}
      />

      {/* Fullscreen Modal */}
      {isFullscreenModalOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{agent.name} - Output</h2>
              {isRunning && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600 font-medium">Running</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreenModalOpen(false)}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-hidden p-6">
            <div 
              ref={fullscreenScrollRef}
              className="h-full overflow-y-auto space-y-8"
              onScroll={() => {
                // Mark that user has scrolled manually
                if (!hasUserScrolled) {
                  setHasUserScrolled(true);
                }
                
                // If user scrolls back to bottom, re-enable auto-scroll
                if (isAtBottom()) {
                  setHasUserScrolled(false);
                }
              }}
            >
              {messages.length === 0 && !isRunning && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Terminal className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Ready to Execute</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter a task to run the agent
                  </p>
                </div>
              )}

              {isRunning && messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm text-muted-foreground">Initializing agent...</span>
                  </div>
                </div>
              )}

              <div
                className="relative w-full max-w-5xl mx-auto"
                style={{ height: `${fullscreenRowVirtualizer.getTotalSize()}px` }}
              >
                <AnimatePresence>
                  {fullscreenRowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const message = displayableMessages[virtualItem.index];
                    return (
                      <motion.div
                        key={virtualItem.key}
                        data-index={virtualItem.index}
                        ref={(el) => el && fullscreenRowVirtualizer.measureElement(el)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-x-4 pb-4"
                        style={{ top: virtualItem.start }}
                      >
                        <ErrorBoundary>
                          <StreamMessage message={message} streamMessages={messages} />
                        </ErrorBoundary>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
              
              <div ref={fullscreenMessagesEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Hooks Configuration Dialog */}
      <Dialog 
        open={isHooksDialogOpen} 
        onOpenChange={setIsHooksDialogOpen}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
          <div className="px-6 py-4 border-b border-border">
            <DialogTitle className="text-heading-2">Configure Hooks</DialogTitle>
            <DialogDescription className="mt-1 text-body-small text-muted-foreground">
              Configure hooks that run before, during, and after tool executions
            </DialogDescription>
          </div>
          
          <Tabs value={activeHooksTab} onValueChange={setActiveHooksTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2 h-auto p-1">
                <TabsTrigger value="project" className="py-2.5 px-3 text-body-small">
                  Project Settings
                </TabsTrigger>
                <TabsTrigger value="local" className="py-2.5 px-3 text-body-small">
                  Local Settings
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="project" className="flex-1 overflow-auto px-6 pb-6 mt-0">
              <div className="space-y-4 pt-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-caption text-muted-foreground">
                    Project hooks are stored in <code className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">.claude/settings.json</code> and 
                    are committed to version control, allowing team members to share configurations.
                  </p>
                </div>
                <HooksEditor
                  projectPath={projectPath}
                  scope="project"
                  className="border-0"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="local" className="flex-1 overflow-auto px-6 pb-6 mt-0">
              <div className="space-y-4 pt-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-caption text-muted-foreground">
                    Local hooks are stored in <code className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">.claude/settings.local.json</code> and 
                    are not committed to version control, perfect for personal preferences.
                  </p>
                </div>
                <HooksEditor
                  projectPath={projectPath}
                  scope="local"
                  className="border-0"
                />
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};
