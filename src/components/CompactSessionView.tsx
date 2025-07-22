import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Filter, 
  Eye, 
  EyeOff, 
  Zap, 
  DollarSign,
  Layers,
  Settings,
  Brain,
  User,
  FileEdit,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClaudeStreamMessage } from './SessionOutputViewer';

interface CompactSessionViewProps {
  messages: ClaudeStreamMessage[];
  filters: MessageFilters;
  onFilterChange: (filters: MessageFilters) => void;
  tokenUsage: TokenUsage;
}

export interface MessageFilters {
  showThinking: boolean;
  showSystemMessages: boolean;
  showUserMessages: boolean;
  showEdits: boolean;
  showResults: boolean;
}

interface TokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
}

// 格式化token数量 - 移到组件外部以便共享
const formatTokens = (tokens: number) => {
  if (tokens > 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
  if (tokens > 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
};

/**
 * 压缩视图组件 - 专注于Claude的思考过程
 * 减少垂直空间占用，提高信息密度
 */
export function CompactSessionView({
  messages,
  filters,
  onFilterChange,
  tokenUsage
}: CompactSessionViewProps) {
  
  // 过滤消息
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      // Assistant消息（包含思考）
      if (msg.type === 'assistant') {
        // 检查是否是思考消息
        const isThinking = msg.message?.content?.some((c: any) => 
          c.type === 'thinking' || c.thinking === true
        );
        
        if (isThinking) {
          return filters.showThinking;
        }
        return true; // 其他assistant消息总是显示
      }
      
      // 系统消息
      if (msg.type === 'system') {
        return filters.showSystemMessages;
      }
      
      // 用户消息
      if (msg.type === 'user') {
        return filters.showUserMessages;
      }
      
      // 结果消息（包括编辑）
      if (msg.type === 'result') {
        if (msg.subtype === 'edit' || msg.tool_name?.includes('edit')) {
          return filters.showEdits;
        }
        return filters.showResults;
      }
      
      return true;
    });
  }, [messages, filters]);

  return (
    <div className="flex h-full">
      {/* 侧边栏 - Token使用和过滤器 */}
      <aside className="w-64 border-r bg-muted/30 p-4 space-y-4">
        {/* Token使用统计 */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Token Usage
          </h3>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Input</span>
              <Badge variant="secondary" className="text-xs">
                {formatTokens(tokenUsage.totalInputTokens)}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Output</span>
              <Badge variant="secondary" className="text-xs">
                {formatTokens(tokenUsage.totalOutputTokens)}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Cost
              </span>
              <Badge className="text-xs">
                ${tokenUsage.totalCost.toFixed(4)}
              </Badge>
            </div>
          </div>
        </Card>

        {/* 消息过滤器 */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Message Filters
          </h3>
          
          <div className="space-y-2">
            <FilterToggle
              icon={<Brain className="h-3.5 w-3.5" />}
              label="Thinking"
              enabled={filters.showThinking}
              onChange={(enabled) => onFilterChange({ ...filters, showThinking: enabled })}
              count={messages.filter(m => 
                m.type === 'assistant' && 
                m.message?.content?.some((c: any) => c.type === 'thinking')
              ).length}
            />
            
            <FilterToggle
              icon={<Settings className="h-3.5 w-3.5" />}
              label="System"
              enabled={filters.showSystemMessages}
              onChange={(enabled) => onFilterChange({ ...filters, showSystemMessages: enabled })}
              count={messages.filter(m => m.type === 'system').length}
            />
            
            <FilterToggle
              icon={<User className="h-3.5 w-3.5" />}
              label="User"
              enabled={filters.showUserMessages}
              onChange={(enabled) => onFilterChange({ ...filters, showUserMessages: enabled })}
              count={messages.filter(m => m.type === 'user').length}
            />
            
            <FilterToggle
              icon={<FileEdit className="h-3.5 w-3.5" />}
              label="Edits"
              enabled={filters.showEdits}
              onChange={(enabled) => onFilterChange({ ...filters, showEdits: enabled })}
              count={messages.filter(m => 
                m.type === 'result' && 
                (m.subtype === 'edit' || m.tool_name?.includes('edit'))
              ).length}
            />
            
            <FilterToggle
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Results"
              enabled={filters.showResults}
              onChange={(enabled) => onFilterChange({ ...filters, showResults: enabled })}
              count={messages.filter(m => 
                m.type === 'result' && 
                m.subtype !== 'edit' && 
                !m.tool_name?.includes('edit')
              ).length}
            />
          </div>
        </Card>

        {/* 统计信息 */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Total: {messages.length} messages</p>
          <p>Filtered: {filteredMessages.length} messages</p>
        </div>
      </aside>

      {/* 主内容区 - 紧凑的消息显示 */}
      <main className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No messages match the current filters</p>
              <p className="text-xs mt-1">Try adjusting the filters in the sidebar</p>
            </div>
          </div>
        ) : (
          filteredMessages.map((message, index) => (
            <CompactMessage key={index} message={message} />
          ))
        )}
      </main>
    </div>
  );
}

/**
 * 过滤器开关组件
 */
const FilterToggle: React.FC<{
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  count: number;
}> = ({ icon, label, enabled, onChange, count }) => {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        "w-full flex items-center justify-between p-2 rounded-md transition-colors",
        enabled 
          ? "bg-primary/10 hover:bg-primary/20" 
          : "hover:bg-muted"
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn(
          "transition-colors",
          enabled ? "text-primary" : "text-muted-foreground"
        )}>
          {icon}
        </div>
        <span className={cn(
          "text-xs font-medium",
          enabled ? "text-foreground" : "text-muted-foreground"
        )}>
          {label}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <Badge 
          variant={enabled ? "default" : "secondary"} 
          className="text-xs h-5 px-1.5"
        >
          {count}
        </Badge>
        {enabled ? (
          <Eye className="h-3.5 w-3.5 text-primary" />
        ) : (
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
    </button>
  );
};

/**
 * 紧凑的消息显示组件
 */
const CompactMessage: React.FC<{ message: ClaudeStreamMessage }> = ({ message }) => {
  // 获取消息图标和颜色
  const getMessageStyle = () => {
    switch (message.type) {
      case 'assistant':
        const isThinking = message.message?.content?.some((c: any) => 
          c.type === 'thinking' || c.thinking === true
        );
        return {
          icon: isThinking ? <Brain className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />,
          color: isThinking ? 'text-purple-500' : 'text-blue-500',
          bgColor: isThinking ? 'bg-purple-500/10' : 'bg-blue-500/10',
          borderColor: isThinking ? 'border-purple-500/20' : 'border-blue-500/20'
        };
      
      case 'user':
        return {
          icon: <User className="h-3.5 w-3.5" />,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/20'
        };
      
      case 'system':
        return {
          icon: <Settings className="h-3.5 w-3.5" />,
          color: 'text-gray-500',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/20'
        };
      
      case 'result':
        return {
          icon: <Layers className="h-3.5 w-3.5" />,
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/20'
        };
      
      default:
        return {
          icon: <Layers className="h-3.5 w-3.5" />,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/10',
          borderColor: 'border-muted/20'
        };
    }
  };

  const style = getMessageStyle();

  // 提取消息内容摘要
  const getMessageSummary = () => {
    if (message.type === 'assistant' && message.message?.content) {
      const textContent = message.message.content
        .filter((c: any) => c.type === 'text' || c.type === 'thinking')
        .map((c: any) => c.text || c.content || '')
        .join(' ')
        .trim();
      
      // 限制长度
      return textContent.length > 200 
        ? textContent.substring(0, 200) + '...'
        : textContent;
    }
    
    if (message.type === 'user' && message.message?.content) {
      const content = Array.isArray(message.message.content) 
        ? message.message.content[0]?.text || ''
        : message.message.content;
      
      return content.length > 150 
        ? content.substring(0, 150) + '...'
        : content;
    }
    
    if (message.type === 'result' && message.tool_name) {
      return `Tool: ${message.tool_name}`;
    }
    
    return message.type;
  };

  return (
    <Card className={cn(
      "p-3 border transition-colors hover:bg-muted/30",
      style.borderColor
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-1.5 rounded-md",
          style.bgColor,
          style.color
        )}>
          {style.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">
            {message.type === 'assistant' && 'Claude'}
            {message.type === 'user' && 'User'}
            {message.type === 'system' && 'System'}
            {message.type === 'result' && message.tool_name}
          </p>
          
          <p className="text-sm text-foreground/90 break-words">
            {getMessageSummary()}
          </p>
          
          {/* Token使用（仅限assistant消息） */}
          {message.type === 'assistant' && message.message?.usage && (
            <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
              <span>In: {formatTokens(message.message.usage.input_tokens)}</span>
              <span>Out: {formatTokens(message.message.usage.output_tokens)}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};