import React from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Terminal, 
  FolderOpen, 
  Copy, 
  GitBranch,
  Settings,
  Hash,
  Command
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SessionHeaderProps {
  projectPath: string;
  claudeSessionId: string | null;
  totalTokens: number;
  isStreaming: boolean;
  hasMessages: boolean;
  showTimeline: boolean;
  copyPopoverOpen: boolean;
  onBack: () => void;
  onSelectPath: () => void;
  onCopyAsJsonl: () => void;
  onCopyAsMarkdown: () => void;
  onToggleTimeline: () => void;
  onProjectSettings?: () => void;
  onSlashCommandsSettings?: () => void;
  setCopyPopoverOpen: (open: boolean) => void;
}

export const SessionHeader: React.FC<SessionHeaderProps> = React.memo(({
  projectPath,
  claudeSessionId,
  totalTokens,
  isStreaming,
  hasMessages,
  showTimeline,
  copyPopoverOpen,
  onBack,
  onSelectPath,
  onCopyAsJsonl,
  onCopyAsMarkdown,
  onToggleTimeline,
  onProjectSettings,
  onSlashCommandsSettings,
  setCopyPopoverOpen
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-background/95 backdrop-blur-sm border-b px-4 py-3 sticky top-0 z-40"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <span className="font-semibold">Claude Code Session</span>
          </div>

          {projectPath && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              <span className="font-mono max-w-md truncate">{projectPath}</span>
            </div>
          )}
          
          {!projectPath && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectPath}
              className="flex items-center gap-2"
            >
              <FolderOpen className="h-4 w-4" />
              Select Project
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {claudeSessionId && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Hash className="h-3 w-3 mr-1" />
                {claudeSessionId.slice(0, 8)}
              </Badge>
              {totalTokens > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalTokens.toLocaleString()} tokens
                </Badge>
              )}
            </div>
          )}

          {hasMessages && !isStreaming && (
            <Popover
              open={copyPopoverOpen}
              onOpenChange={setCopyPopoverOpen}
              trigger={
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Copy className="h-4 w-4" />
                </Button>
              }
              content={
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={onCopyAsJsonl}
                  >
                    Copy as JSONL
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={onCopyAsMarkdown}
                  >
                    Copy as Markdown
                  </Button>
                </div>
              }
              className="w-48 p-2"
            />
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTimeline}
            className={cn(
              "h-8 w-8 transition-colors",
              showTimeline && "bg-accent text-accent-foreground"
            )}
          >
            <GitBranch className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onProjectSettings && projectPath && (
                <DropdownMenuItem onClick={onProjectSettings}>
                  <Settings className="h-4 w-4 mr-2" />
                  Project Settings
                </DropdownMenuItem>
              )}
              {onSlashCommandsSettings && projectPath && (
                <DropdownMenuItem onClick={onSlashCommandsSettings}>
                  <Command className="h-4 w-4 mr-2" />
                  Slash Commands
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
});