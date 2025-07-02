import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Copy, 
  ChevronDown,
  Clock,
  Hash,
  DollarSign,
  Bot
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
import { t } from "@/lib/i18n";

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
      
      // Parse JSONL output into messages
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
      setError(t('failedToLoadExecutionDetails'));
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
    
    let markdown = `# ${t('agentExecution')}: ${run.agent_name}\n\n`;
    markdown += `**${t('task')}:** ${run.task}\n`;
    markdown += `**${t('model')}:** ${run.model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}\n`;
    markdown += `**${t('date')}:** ${formatISOTimestamp(run.created_at)}\n`;
    if (run.metrics?.duration_ms) markdown += `**${t('duration')}:** ${(run.metrics.duration_ms / 1000).toFixed(2)}s\n`;
    if (run.metrics?.total_tokens) markdown += `**${t('tokens')}:** ${run.metrics.total_tokens}\n`;
    if (run.metrics?.cost_usd) markdown += `**${t('cost')}:** $${run.metrics.cost_usd.toFixed(4)} USD\n`;
    markdown += `\n---\n\n`;

    for (const msg of messages) {
      if (msg.type === "system" && msg.subtype === "init") {
        markdown += `## ${t('systemInitialization')}\n\n`;
        markdown += `- ${t('sessionId')}: \`${msg.session_id || 'N/A'}\`\n`;
        markdown += `- ${t('model')}: \`${msg.model || 'default'}\`\n`;
        if (msg.cwd) markdown += `- ${t('workingDirectory')}: \`${msg.cwd}\`\n`;
        if (msg.tools?.length) markdown += `- ${t('tools')}: ${msg.tools.join(', ')}\n`;
        markdown += `\n`;
      } else if (msg.type === "assistant" && msg.message) {
        markdown += `## ${t('assistant')}\n\n`;
        for (const content of msg.message.content || []) {
          if (content.type === "text") {
            markdown += `${content.text}\n\n`;
          } else if (content.type === "tool_use") {
            markdown += `### Tool: ${content.name}\n\n`;
            markdown += `\`\`\`json\n${JSON.stringify(content.input, null, 2)}\n\`\`\`\n\n`;
          }
        }
        if (msg.message.usage) {
          markdown += `*${t('tokens')}: ${msg.message.usage.input_tokens} in, ${msg.message.usage.output_tokens} out*\n\n`;
        }
      } else if (msg.type === "user" && msg.message) {
        markdown += `## ${t('user')}\n\n`;
        for (const content of msg.message.content || []) {
          if (content.type === "text") {
            markdown += `${content.text}\n\n`;
          } else if (content.type === "tool_result") {
            markdown += `### ${t('toolResult')}\n\n`;
            markdown += `\`\`\`\n${content.content}\n\`\`\`\n\n`;
          }
        }
      } else if (msg.type === "result") {
        markdown += `## ${t('executionResult')}\n\n`;
        if (msg.result) {
          markdown += `${msg.result}\n\n`;
        }
        if (msg.error) {
          markdown += `**${t('error')}:** ${msg.error}\n\n`;
        }
      }
    }

    await navigator.clipboard.writeText(markdown);
    setCopyPopoverOpen(false);
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
        <p className="text-destructive mb-4">{error || t('runNotFound')}</p>
        <Button onClick={onBack}>{t('goBack')}</Button>
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
                <p className="text-xs text-muted-foreground">{t('executionHistory')}</p>
              </div>
            </div>
          </div>
          
          <Popover
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setCopyPopoverOpen(!copyPopoverOpen)}
              >
                <Copy className="h-4 w-4" />
                {t('copyOutput')}
                <ChevronDown className="h-3 w-3" />
              </Button>
            }
            content={
              <div className="mt-2 w-48 bg-popover border rounded-md shadow-md">
                <div className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleCopyAsJsonl}
                  >
                    {t('copyAsJsonl')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleCopyAsMarkdown}
                  >
                    {t('copyAsMarkdown')}
                  </Button>
                </div>
              </div>
            }
            open={copyPopoverOpen}
            onOpenChange={setCopyPopoverOpen}
          />
        </motion.div>
        
        {/* Run Details */}
        <Card className="m-4">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">{t('task')}:</h3>
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