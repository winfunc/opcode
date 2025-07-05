import React, { useState, useEffect } from 'react';
import { ClaudeCommand } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Terminal, Info } from 'lucide-react';

interface CommandEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: ClaudeCommand | null;
  onSave: (name: string, content: string) => Promise<void>;
}

export const CommandEditor: React.FC<CommandEditorProps> = ({
  open,
  onOpenChange,
  command,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (command) {
      setName(command.name);
      setContent(command.content);
    } else {
      setName('');
      setContent('');
    }
    setError('');
  }, [command, open]);

  const handleSave = async () => {
    // Validate inputs
    if (!name.trim()) {
      setError('Command name is required');
      return;
    }

    if (!content.trim()) {
      setError('Command content is required');
      return;
    }

    // Clear error and save
    setError('');
    setIsSaving(true);
    
    try {
      await onSave(name.trim(), content);
      // onSave will handle closing the dialog if successful
    } catch (error) {
      // If save fails, keep dialog open and show error
      setError(error instanceof Error ? error.message : 'Failed to save command');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {command ? 'Edit Command' : 'Create New Command'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-4">
            {/* Command Name */}
            <div className="space-y-2">
              <Label htmlFor="command-name">Command Name</Label>
              <Input
                id="command-name"
                placeholder="my-awesome-command"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!!command}
                className={command ? 'opacity-50' : ''}
              />
              {command && (
                <p className="text-xs text-muted-foreground">
                  Command names cannot be changed after creation
                </p>
              )}
            </div>

            {/* Command Content */}
            <div className="space-y-2">
              <Label htmlFor="command-content">Command Content</Label>
              <Textarea
                id="command-content"
                placeholder="# Refactor code to use modern patterns&#10;&#10;Please refactor the selected code to use modern JavaScript patterns including:&#10;- Convert functions to arrow functions where appropriate&#10;- Use destructuring for objects and arrays&#10;- Replace var with const/let&#10;- Use template literals instead of string concatenation&#10;- Add proper error handling with try/catch&#10;&#10;Maintain the original functionality while improving code quality."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="font-mono text-sm min-h-[300px]"
              />
              <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Tips:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Start with a comment (#) to add a description</li>
                    <li>Commands are saved in ~/.claude/commands/</li>
                    <li>Use descriptive names for easy searching</li>
                    <li>Press {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to save</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : (command ? 'Update' : 'Create')} Command
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};