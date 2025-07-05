import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { api, ClaudeCommand } from '../lib/api';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Terminal, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface CommandAutocompleteProps {
  trigger: React.ReactNode;
  onSelect: (command: ClaudeCommand) => void;
  searchQuery?: string;
  open?: boolean;
  projectPath?: string;
}

export interface CommandAutocompleteRef {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

export const CommandAutocomplete = forwardRef<CommandAutocompleteRef, CommandAutocompleteProps>(({
  onSelect,
  searchQuery = '',
  open: externalOpen,
  projectPath,
}, ref) => {
  const [commands, setCommands] = useState<ClaudeCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
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
      setSelectedIndex(0); // Reset selection when opening
    }
  }, [open, searchQuery, loadCommands]);

  const handleSelect = (command: ClaudeCommand) => {
    onSelect(command);
    setOpen(false);
  };

  // Expose keyboard handling method
  useImperativeHandle(ref, () => ({
    handleKeyDown: (e: React.KeyboardEvent) => {
      if (!open || commands.length === 0) return false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % commands.length);
          return true;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + commands.length) % commands.length);
          return true;
        case 'Enter':
          e.preventDefault();
          if (commands[selectedIndex]) {
            handleSelect(commands[selectedIndex]);
          }
          return true;
        case 'Tab':
          e.preventDefault();
          if (commands[selectedIndex]) {
            handleSelect(commands[selectedIndex]);
          }
          return true;
        default:
          return false;
      }
    }
  }), [open, commands, selectedIndex, handleSelect]);

  // Scroll selected item into view
  useEffect(() => {
    if (open && scrollAreaRef.current) {
      const selectedElement = scrollAreaRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, open]);

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
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full mb-2 left-0 z-50 w-[500px]"
        >
          <div className="bg-background border border-border rounded-lg shadow-lg">
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
            
            <ScrollArea className="max-h-[300px]" ref={scrollAreaRef}>
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
                  {commands.map((command, index) => (
                    <button
                      key={command.name}
                      data-index={index}
                      onClick={() => handleSelect(command)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full text-left p-3 rounded-md transition-colors",
                        selectedIndex === index ? "bg-accent" : "hover:bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium">{command.name}</div>
                        {command.scope === 'project' && (
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});