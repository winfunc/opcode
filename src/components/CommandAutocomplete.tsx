import React, { useState, useEffect, useCallback } from 'react';
import { api, ClaudeCommand } from '../lib/api';
import { Popover } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Terminal, Clock } from 'lucide-react';

interface CommandAutocompleteProps {
  trigger: React.ReactNode;
  onSelect: (command: ClaudeCommand) => void;
  searchQuery?: string;
  open?: boolean;
  projectPath?: string;
}

export const CommandAutocomplete: React.FC<CommandAutocompleteProps> = ({
  trigger,
  onSelect,
  searchQuery = '',
  open: externalOpen,
  projectPath,
}) => {
  const [commands, setCommands] = useState<ClaudeCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Use external open prop if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOpen !== undefined ? () => {} : setInternalOpen;

  // Load/search commands
  const loadCommands = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const results = query 
        ? await api.searchClaudeCommands(query, projectPath)
        : await api.listClaudeCommands(projectPath);
      setCommands(results);
    } catch (error) {
      console.error('Failed to load commands:', error);
      setCommands([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    if (open) {
      loadCommands(searchQuery);
    }
  }, [open, searchQuery, loadCommands]);

  const handleSelect = (command: ClaudeCommand) => {
    onSelect(command);
    setOpen(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <Popover
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      align="start"
      side="top"
      className="w-96 p-0"
      content={
        <>
          <div className="p-3 border-b">
            <h4 className="font-medium flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Available Commands
              {searchQuery && (
                <Badge variant="secondary" className="ml-auto">
                  {commands.length} results
                </Badge>
              )}
            </h4>
          </div>
          
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Loading commands...
              </div>
            ) : commands.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No commands found
              </div>
            ) : (
              <div className="p-1">
                {commands.map((command) => (
                  <button
                    key={command.name}
                    onClick={() => handleSelect(command)}
                    className="w-full text-left p-3 hover:bg-accent rounded-md transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium">{command.name.replace(/^project:/, '')}</div>
                      {command.name.startsWith('project:') && (
                        <Badge variant="outline" className="text-xs">project</Badge>
                      )}
                    </div>
                    {command.description && (
                      <div className="text-sm text-muted-foreground mb-1 line-clamp-1">
                        {command.description}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(command.modified_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      }
    />
  );
};