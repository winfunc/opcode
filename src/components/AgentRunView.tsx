import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Copy, 
  ChevronDown, 
  Clock,
  Hash,
  DollarSign,
  Bot,
  StopCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover } from "@/components/ui/popover";
import { api, type AgentRunWithMetrics } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatISOTimestamp } from "@/lib/date-utils";
import { StreamMessage } from "./StreamMessage";
import { AGENT_ICONS } from "./CCAgents";
import type { ClaudeStreamMessage } from "./AgentExecution";
import { ErrorBoundary } from "./ErrorBoundary";

interface AgentRunViewProps {
  /**
   * The run ID to view
   */
  runId: number;
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
 * AgentRunView component for viewing past agent execution details
 * 
 * @example
 * <AgentRunView runId={123} onBack={() => setView('list')} />
 */
export const AgentRunView: React.FC<AgentRunViewProps> = ({
  runId,
  onBack,
  className,
}) => {
  const [run, setRun] = useState<AgentRunWithMetrics | null>(null);
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);

  useEffect(() => {
    loadRun();
  }, [runId]);

  const loadRun = async () => {
    try {
      setLoading(true);
      setError(null);
      const runData = await api.getAgentRunWithRealTimeMetrics(runId);
      setRun(runData);
      
      // If we have a session_id, try to load from JSONL file first
      if (runData.session_id && runData.session_id !== '') {
        try {
          const history = await api.loadAgentSessionHistory(runData.session_id);
          
          // Convert history to messages format
          const loadedMessages: ClaudeStreamMessage[] = history.map(entry => ({
            ...entry,
            type: entry.type || "assistant"
          }));
          
          setMessages(loadedMessages);
          return;
        } catch (err) {
          console.warn('Failed to load from JSONL, falling back to output field:', err);
        }
      }
      
      // Fallback: Parse JSONL output from the output field
      if (runData.output) {
        const parsedMessages: ClaudeStreamMessage[] = [];
        const lines = runData.output.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const msg = JSON.parse(line) as ClaudeStreamMessage;
            parsedMessages.push(msg);
          } catch (err) {
            console.error("Failed to parse line:", line, err);
          }
        }
        
        setMessages(parsedMessages);
      }
    } catch (err) {
      console.error("Failed to load run:", err);
      setError("Failed to load execution details");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAsJsonl = async () => {
    if (!run?.output) return;
    await navigator.clipboard.writeText(run.output);
    setCopyPopoverOpen(false);
  };

  const handleCopyAsMarkdown = async () => {
    if (!run) return;
    
    let markdown = `# Agent Run: ${run.agent_name}\n\n`;
    markdown += `**Task:** ${run.task}\n`;
    markdown += `**Model:** ${run.model}\n`;
    markdown += `**Status:** ${run.status}\n`;
    if (run.metrics) {
      markdown += `**Tokens:** ${run.metrics.total_tokens || 'N/A'}\n`;
      markdown += `**Cost:** $${run.metrics.cost_usd?.toFixed(4) || 'N/A'}\n`;
    }
    markdown += `**Date:** ${new Date(run.created_at).toISOString()}\n\n`;
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
  };

  const handleStop = async () => {
    if (!runId) {
      console.error('[AgentRunView] No run ID available to stop');
      return;
    }

    try {
      // Call the API to kill the agent session
      const success = await api.killAgentSession(runId);
      
      if (success) {
        console.log(`[AgentRunView] Successfully stopped agent session ${runId}`);
        
        // Update the run status locally
        if (run) {
          setRun({ ...run, status: 'cancelled' });
        }
        
        // Add a message indicating execution was stopped
        const stopMessage: ClaudeStreamMessage = {
          type: "result",
          subtype: "error",
          is_error: true,
          result: "Execution stopped by user",
          duration_ms: 0,
          usage: {
            input_tokens: 0,
            output_tokens: 0
          }
        };
        setMessages(prev => [...prev, stopMessage]);
        
        // Reload the run data after a short delay
        setTimeout(() => {
          loadRun();
        }, 1000);
      } else {
        console.warn(`[AgentRunView] Failed to stop agent session ${runId} - it may have already finished`);
      }
    } catch (err) {
      console.error('[AgentRunView] Failed to stop agent:', err);
    }
  };

  const renderIcon = (iconName: string) => {
    const Icon = AGENT_ICONS[iconName as keyof typeof AGENT_ICONS] || Bot;
    return <Icon className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full", className)}>
        <p className="text-destructive mb-4">{error || "Run not found"}</p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

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
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              {renderIcon(run.agent_icon)}
              <div>
                <h2 className="text-lg font-semibold">{run.agent_name}</h2>
                <p className="text-xs text-muted-foreground">Execution History</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {run?.status === 'running' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStop}
                className="text-destructive hover:text-destructive"
              >
                <StopCircle className="h-4 w-4 mr-1" />
                Stop
              </Button>
            )}
            
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
          </div>
        </motion.div>
        
        {/* Run Details */}
        <Card className="m-4">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Task:</h3>
                <p className="text-sm text-muted-foreground flex-1">{run.task}</p>
                <Badge variant="outline" className="text-xs">
                  {run.model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatISOTimestamp(run.created_at)}</span>
                </div>
                
                {run.metrics?.duration_ms && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{(run.metrics.duration_ms / 1000).toFixed(2)}s</span>
                  </div>
                )}
                
                {run.metrics?.total_tokens && (
                  <div className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    <span>{run.metrics.total_tokens} tokens</span>
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
          </CardContent>
        </Card>

        {/* Output Display */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-4 space-y-2">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
              >
                <ErrorBoundary>
                  <StreamMessage message={message} streamMessages={messages} />
                </ErrorBoundary>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 