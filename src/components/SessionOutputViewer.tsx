import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Minimize2, Copy, RefreshCw, RotateCcw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Toast, ToastContainer } from '@/components/ui/toast';
import { Popover } from '@/components/ui/popover';
import { api } from '@/lib/api';
import { useOutputCache } from '@/lib/outputCache';
import type { AgentRun } from '@/lib/api';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { StreamMessage } from './StreamMessage';
import { ErrorBoundary } from './ErrorBoundary';

interface SessionOutputViewerProps {
  session: AgentRun;
  onClose: () => void;
  className?: string;
}

// Use the same message interface as AgentExecution for consistency
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

export function SessionOutputViewer({ session, onClose, className }: SessionOutputViewerProps) {
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

  // Auto-scroll logic similar to AgentExecution
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
    if (!session.id) return;

    try {
      // Check cache first if not skipping cache
      if (!skipCache) {
        const cached = getCachedOutput(session.id);
        if (cached) {
          const cachedJsonlLines = cached.output.split('\n').filter(line => line.trim());
          setRawJsonlOutput(cachedJsonlLines);
          setMessages(cached.messages);
          // If cache is recent (less than 5 seconds old) and session isn't running, use cache only
          if (Date.now() - cached.lastUpdated < 5000 && session.status !== 'running') {
            return;
          }
        }
      }

      setLoading(true);

      // If we have a session_id, try to load from JSONL file first
      if (session.session_id && session.session_id !== '') {
        try {
          const history = await api.loadAgentSessionHistory(session.session_id);
          
          // Convert history to messages format using AgentExecution style
          const loadedMessages: ClaudeStreamMessage[] = history.map(entry => ({
            ...entry,
            type: entry.type || "assistant"
          }));
          
          setMessages(loadedMessages);
          setRawJsonlOutput(history.map(h => JSON.stringify(h)));
          
          // Update cache
          setCachedOutput(session.id, {
            output: history.map(h => JSON.stringify(h)).join('\n'),
            messages: loadedMessages,
            lastUpdated: Date.now(),
            status: session.status
          });
          
          // Set up live event listeners for running sessions
          if (session.status === 'running') {
            setupLiveEventListeners();
            
            try {
              await api.streamSessionOutput(session.id);
            } catch (streamError) {
              console.warn('Failed to start streaming, will poll instead:', streamError);
            }
          }
          
          return;
        } catch (err) {
          console.warn('Failed to load from JSONL, falling back to regular output:', err);
        }
      }

      // Fallback to the original method if JSONL loading fails or no session_id
      const rawOutput = await api.getSessionOutput(session.id);
      
      // Parse JSONL output into messages using AgentExecution style
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
      setCachedOutput(session.id, {
        output: rawOutput,
        messages: parsedMessages,
        lastUpdated: Date.now(),
        status: session.status
      });
      
      // Set up live event listeners for running sessions
      if (session.status === 'running') {
        setupLiveEventListeners();
        
        try {
          await api.streamSessionOutput(session.id);
        } catch (streamError) {
          console.warn('Failed to start streaming, will poll instead:', streamError);
        }
      }
    } catch (error) {
      console.error('Failed to load session output:', error);
      setToast({ message: 'Failed to load session output', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const setupLiveEventListeners = async () => {
    if (!session.id) return;
    
    try {
      // Clean up existing listeners
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];

      // Set up live event listeners with run ID isolation
      const outputUnlisten = await listen<string>(`agent-output:${session.id}`, (event) => {
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

      const errorUnlisten = await listen<string>(`agent-error:${session.id}`, (event) => {
        console.error("Agent error:", event.payload);
        setToast({ message: event.payload, type: 'error' });
      });

      const completeUnlisten = await listen<boolean>(`agent-complete:${session.id}`, () => {
        setToast({ message: 'Agent execution completed', type: 'success' });
        // Don't set status here as the parent component should handle it
      });

      const cancelUnlisten = await listen<boolean>(`agent-cancelled:${session.id}`, () => {
        setToast({ message: 'Agent execution was cancelled', type: 'error' });
      });

      unlistenRefs.current = [outputUnlisten, errorUnlisten, completeUnlisten, cancelUnlisten];
    } catch (error) {
      console.error('Failed to set up live event listeners:', error);
    }
  };

  // Copy functionality similar to AgentExecution
  const handleCopyAsJsonl = async () => {
    const jsonl = rawJsonlOutput.join('\n');
    await navigator.clipboard.writeText(jsonl);
    setCopyPopoverOpen(false);
    setToast({ message: 'Output copied as JSONL', type: 'success' });
  };

  const handleCopyAsMarkdown = async () => {
    let markdown = `# Agent Session: ${session.agent_name}\n\n`;
    markdown += `**Status:** ${session.status}\n`;
    if (session.task) markdown += `**Task:** ${session.task}\n`;
    if (session.model) markdown += `**Model:** ${session.model}\n`;
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
      }
    }

    await navigator.clipboard.writeText(markdown);
    setCopyPopoverOpen(false);
    setToast({ message: 'Output copied as Markdown', type: 'success' });
  };


  const refreshOutput = async () => {
    setRefreshing(true);
    try {
      await loadOutput(true); // Skip cache when manually refreshing
      setToast({ message: 'Output refreshed', type: 'success' });
    } catch (error) {
      console.error('Failed to refresh output:', error);
      setToast({ message: 'Failed to refresh output', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };


  // Load output on mount and check cache first
  useEffect(() => {
    if (!session.id) return;
    
    // Check cache immediately for instant display
    const cached = getCachedOutput(session.id);
    if (cached) {
      const cachedJsonlLines = cached.output.split('\n').filter(line => line.trim());
      setRawJsonlOutput(cachedJsonlLines);
      setMessages(cached.messages);
    }
    
    // Then load fresh data
    loadOutput();
  }, [session.id]);

  const displayableMessages = useMemo(() => {
    return messages.filter((message, index) => {
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
              let willBeSkipped = false;
              if (content.tool_use_id) {
                for (let i = index - 1; i >= 0; i--) {
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''} ${className}`}
      >
        <Card className={`h-full ${isFullscreen ? 'rounded-none border-0' : ''}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">{session.agent_icon}</div>
                <div>
                  <CardTitle className="text-base">{session.agent_name} - Output</CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant={session.status === 'running' ? 'default' : 'secondary'}>
                      {session.status}
                    </Badge>
                    {session.status === 'running' && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse mr-1"></div>
                        Live
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {messages.length} messages
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {messages.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      title="Fullscreen"
                    >
                      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                    <Popover
                      trigger={
                        <Button
                          variant="outline"
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
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshOutput}
                  disabled={refreshing}
                  title="Refresh output"
                >
                  <RotateCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className={`${isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-96'} p-0`}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading output...</span>
                </div>
              </div>
            ) : (
              <div 
                className="h-full overflow-y-auto p-6 space-y-3" 
                ref={scrollAreaRef}
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
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    {session.status === 'running' ? (
                      <>
                        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Waiting for output...</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Agent is running but no output received yet
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground">No output available</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={refreshOutput}
                          className="mt-2"
                          disabled={refreshing}
                        >
                          {refreshing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                          Refresh
                        </Button>
                      </>
                    )}
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
                    <div ref={outputEndRef} />
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="text-2xl">{session.agent_icon}</div>
              <h2 className="text-lg font-semibold">{session.agent_name} - Output</h2>
              {session.status === 'running' && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600 font-medium">Running</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(false)}
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
              className="h-full overflow-y-auto space-y-3"
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
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  {session.status === 'running' ? (
                    <>
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Waiting for output...</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Agent is running but no output received yet
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground">No output available</p>
                    </>
                  )}
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
