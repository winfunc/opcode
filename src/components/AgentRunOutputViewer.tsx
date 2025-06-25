import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  Copy, 
  RefreshCw, 
  RotateCcw, 
  ChevronDown,
  Bot,
  Clock,
  Hash,
  DollarSign,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Toast, ToastContainer } from '@/components/ui/toast';
import { Popover } from '@/components/ui/popover';
import { api, type AgentRunWithMetrics } from '@/lib/api';
import { useOutputCache } from '@/lib/outputCache';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { StreamMessage } from './StreamMessage';
import { ErrorBoundary } from './ErrorBoundary';
import { formatISOTimestamp } from '@/lib/date-utils';
import { AGENT_ICONS } from './CCAgents';
import type { ClaudeStreamMessage } from './AgentExecution';

interface AgentRunOutputViewerProps {
  /**
   * The agent run to display
   */
  run: AgentRunWithMetrics;
  /**
   * Callback when the viewer is closed
   */
  onClose: () => void;
  /**
   * Optional callback to open full view
   */
  onOpenFullView?: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * AgentRunOutputViewer - Modal component for viewing agent execution output
 * 
 * @example
 * <AgentRunOutputViewer
 *   run={agentRun}
 *   onClose={() => setSelectedRun(null)}
 * />
 */
export function AgentRunOutputViewer({ 
  run, 
  onClose, 
  onOpenFullView,
  className 
}: AgentRunOutputViewerProps) {
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [rawJsonlOutput, setRawJsonlOutput] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const fullscreenScrollRef = useRef<HTMLDivElement>(null);
  const fullscreenMessagesEndRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const { getCachedOutput, setCachedOutput } = useOutputCache();

  // Auto-scroll logic
  const isAtBottom = () => {
    const container = isFullscreen ? fullscreenScrollRef.current : scrollAreaRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      return distanceFromBottom < 1;
    }
    return true;
  };

  const scrollToBottom = () => {
    if (!hasUserScrolled) {
      const endRef = isFullscreen ? fullscreenMessagesEndRef.current : outputEndRef.current;
      if (endRef) {
        endRef.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      unlistenRefs.current.forEach(unlisten => unlisten());
    };
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    const shouldAutoScroll = !hasUserScrolled || isAtBottom();
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [messages, hasUserScrolled, isFullscreen]);

  const loadOutput = async (skipCache = false) => {
    if (!run.id) return;

    try {
      // Check cache first if not skipping cache
      if (!skipCache) {
        const cached = getCachedOutput(run.id);
        if (cached) {
          const cachedJsonlLines = cached.output.split('\n').filter(line => line.trim());
          setRawJsonlOutput(cachedJsonlLines);
          setMessages(cached.messages);
          // If cache is recent (less than 5 seconds old) and session isn't running, use cache only
          if (Date.now() - cached.lastUpdated < 5000 && run.status !== 'running') {
            return;
          }
        }
      }

      setLoading(true);
      const rawOutput = await api.getSessionOutput(run.id);
      
      // Parse JSONL output into messages
      const jsonlLines = rawOutput.split('\n').filter(line => line.trim());
      setRawJsonlOutput(jsonlLines);
      
      const parsedMessages: ClaudeStreamMessage[] = [];
      for (const line of jsonlLines) {
        try {
          const message = JSON.parse(line) as ClaudeStreamMessage;
          parsedMessages.push(message);
        } catch (err) {
          console.error("Failed to parse message:", err, line);
        }
      }
      setMessages(parsedMessages);
      
      // Update cache
      setCachedOutput(run.id, {
        output: rawOutput,
        messages: parsedMessages,
        lastUpdated: Date.now(),
        status: run.status
      });
      
      // Set up live event listeners for running sessions
      if (run.status === 'running') {
        setupLiveEventListeners();
        
        try {
          await api.streamSessionOutput(run.id);
        } catch (streamError) {
          console.warn('Failed to start streaming, will poll instead:', streamError);
        }
      }
    } catch (error) {
      console.error('Failed to load agent output:', error);
      setToast({ message: 'Failed to load agent output', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const setupLiveEventListeners = async () => {
    if (!run.id) return;
    
    try {
      // Clean up existing listeners
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];

      // Set up live event listeners with run ID isolation
      const outputUnlisten = await listen<string>(`agent-output:${run.id}`, (event) => {
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

      const errorUnlisten = await listen<string>(`agent-error:${run.id}`, (event) => {
        console.error("Agent error:", event.payload);
        setToast({ message: event.payload, type: 'error' });
      });

      const completeUnlisten = await listen<boolean>(`agent-complete:${run.id}`, () => {
        setToast({ message: 'Agent execution completed', type: 'success' });
      });

      const cancelUnlisten = await listen<boolean>(`agent-cancelled:${run.id}`, () => {
        setToast({ message: 'Agent execution was cancelled', type: 'error' });
      });

      unlistenRefs.current = [outputUnlisten, errorUnlisten, completeUnlisten, cancelUnlisten];
    } catch (error) {
      console.error('Failed to set up live event listeners:', error);
    }
  };

  // Copy functionality
  const handleCopyAsJsonl = async () => {
    const jsonl = rawJsonlOutput.join('\n');
    await navigator.clipboard.writeText(jsonl);
    setCopyPopoverOpen(false);
    setToast({ message: 'Output copied as JSONL', type: 'success' });
  };

  const handleCopyAsMarkdown = async () => {
    let markdown = `# Agent Execution: ${run.agent_name}\n\n`;
    markdown += `**Task:** ${run.task}\n`;
    markdown += `**Model:** ${run.model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}\n`;
    markdown += `**Date:** ${formatISOTimestamp(run.created_at)}\n`;
    if (run.metrics?.duration_ms) markdown += `**Duration:** ${(run.metrics.duration_ms / 1000).toFixed(2)}s\n`;
    if (run.metrics?.total_tokens) markdown += `**Total Tokens:** ${run.metrics.total_tokens}\n`;
    if (run.metrics?.cost_usd) markdown += `**Cost:** $${run.metrics.cost_usd.toFixed(4)} USD\n`;
    markdown += `\n---\n\n`;

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
      }
    }

    await navigator.clipboard.writeText(markdown);
    setCopyPopoverOpen(false);
    setToast({ message: 'Output copied as Markdown', type: 'success' });
  };

  const refreshOutput = async () => {
    setRefreshing(true);
    await loadOutput(true); // Skip cache
    setRefreshing(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setHasUserScrolled(distanceFromBottom > 50);
  };

  // Load output on mount
  useEffect(() => {
    if (!run.id) return;
    
    // Check cache immediately for instant display
    const cached = getCachedOutput(run.id);
    if (cached) {
      const cachedJsonlLines = cached.output.split('\n').filter(line => line.trim());
      setRawJsonlOutput(cachedJsonlLines);
      setMessages(cached.messages);
    }
    
    // Then load fresh data
    loadOutput();
  }, [run.id]);

  const displayableMessages = useMemo(() => {
    return messages.filter((message) => {
      if (message.isMeta && !message.leafUuid && !message.summary) return false;

      if (message.type === "user" && message.message) {
        if (message.isMeta) return false;

        const msg = message.message;
        if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) return false;

        if (Array.isArray(msg.content)) {
          let hasVisibleContent = false;
          for (const content of msg.content) {
            if (content.type === "text") { hasVisibleContent = true; break; }
            if (content.type === "tool_result") {
              // Check if this tool result will be displayed as a widget
              let willBeSkipped = false;
              if (content.tool_use_id) {
                // Find the corresponding tool use
                for (let i = messages.indexOf(message) - 1; i >= 0; i--) {
                  const prevMsg = messages[i];
                  if (prevMsg.type === 'assistant' && prevMsg.message?.content && Array.isArray(prevMsg.message.content)) {
                    const toolUse = prevMsg.message.content.find((c: any) => c.type === 'tool_use' && c.id === content.tool_use_id);
                    if (toolUse) {
                      const toolName = toolUse.name?.toLowerCase();
                      const toolsWithWidgets = ['task','edit','multiedit','todowrite','ls','read','glob','bash','write','grep'];
                      if (toolsWithWidgets.includes(toolName) || toolUse.name?.startsWith('mcp__')) {
                        willBeSkipped = true;
                      }
                      break;
                    }
                  }
                }
              }
              if (!willBeSkipped) { hasVisibleContent = true; break; }
            }
          }
          if (!hasVisibleContent) return false;
        }
      }
      return true;
    });
  }, [messages]);

  const renderIcon = (iconName: string) => {
    const Icon = AGENT_ICONS[iconName as keyof typeof AGENT_ICONS] || Bot;
    return <Icon className="h-5 w-5" />;
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "N/A";
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatTokens = (tokens?: number) => {
    if (!tokens) return "0";
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`fixed inset-x-4 top-[10%] bottom-[10%] z-50 max-w-4xl mx-auto ${className}`}
      >
        <Card className="h-full flex flex-col shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5">
                  {renderIcon(run.agent_icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {run.agent_name}
                    {run.status === 'running' && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-600 font-medium">Running</span>
                      </div>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {run.task}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                    <Badge variant="outline" className="text-xs">
                      {run.model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatISOTimestamp(run.created_at)}</span>
                    </div>
                    {run.metrics?.duration_ms && (
                      <span>{formatDuration(run.metrics.duration_ms)}</span>
                    )}
                    {run.metrics?.total_tokens && (
                      <div className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        <span>{formatTokens(run.metrics.total_tokens)}</span>
                      </div>
                    )}
                    {run.metrics?.cost_usd && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        <span>${run.metrics.cost_usd.toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Popover
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                      <ChevronDown className="h-3 w-3 ml-1" />
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
                {onOpenFullView && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onOpenFullView}
                    title="Open in full view"
                    className="h-8 px-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  className="h-8 px-2"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshOutput}
                  disabled={refreshing}
                  title="Refresh output"
                  className="h-8 px-2"
                >
                  <RotateCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClose}
                  className="h-8 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className={`${isFullscreen ? 'h-[calc(100vh-120px)]' : 'flex-1'} p-0 overflow-hidden`}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading output...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No output available yet</p>
              </div>
            ) : (
              <div 
                ref={scrollAreaRef}
                className="h-full overflow-y-auto p-4 space-y-2"
                onScroll={handleScroll}
              >
                <AnimatePresence>
                  {displayableMessages.map((message: ClaudeStreamMessage, index: number) => (
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
                <div ref={outputEndRef} />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-background z-[60] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              {renderIcon(run.agent_icon)}
              <div>
                <h3 className="font-semibold text-lg">{run.agent_name}</h3>
                <p className="text-sm text-muted-foreground">{run.task}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Popover
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Output
                    <ChevronDown className="h-3 w-3 ml-2" />
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
                align="end"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={refreshOutput}
                disabled={refreshing}
              >
                <RotateCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(false)}
              >
                <Minimize2 className="h-4 w-4 mr-2" />
                Exit Fullscreen
              </Button>
            </div>
          </div>
          <div 
            ref={fullscreenScrollRef}
            className="flex-1 overflow-y-auto p-6"
            onScroll={handleScroll}
          >
            <div className="max-w-4xl mx-auto space-y-2">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No output available yet
                </div>
              ) : (
                <>
                  <AnimatePresence>
                    {displayableMessages.map((message: ClaudeStreamMessage, index: number) => (
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
                  <div ref={fullscreenMessagesEndRef} />
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
    </>
  );
} 