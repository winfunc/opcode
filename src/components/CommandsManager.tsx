import React, { useState, useEffect, useCallback } from 'react';
import { api, ClaudeCommand, CommandsExport, ImportResult } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Toast, ToastContainer, ToastType } from './ui/toast';
import { CommandCard } from './CommandCard';
import { CommandEditor } from './CommandEditor';
import { ImportConflictDialog } from './ImportConflictDialog';
import { Search, Plus, Upload, Download, Loader2, ChevronLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface CommandsManagerProps {
  onBack?: () => void;
  projectPath?: string;
}

export const CommandsManager: React.FC<CommandsManagerProps> = ({ onBack, projectPath }) => {
  const [commands, setCommands] = useState<ClaudeCommand[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<ClaudeCommand | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [commandToDelete, setCommandToDelete] = useState<string | null>(null);
  const [importConflictOpen, setImportConflictOpen] = useState(false);
  const [importConflicts, setImportConflicts] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [pendingImportData, setPendingImportData] = useState<CommandsExport | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: ToastType }>({
    show: false,
    message: '',
    type: 'info'
  });

  // Helper function to show toast
  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
  };

  // Load commands on mount
  const loadCommands = useCallback(async () => {
    setIsLoading(true);
    try {
      const cmds = await api.listClaudeCommands(projectPath);
      setCommands(cmds);
    } catch (error) {
      showToast('Failed to load commands', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadCommands();
  }, [loadCommands]);

  // Clear cache when project context changes
  useEffect(() => {
    if (projectPath !== undefined) {
      api.clearCommandsCache().catch((err: unknown) => {
        console.error('[CommandsManager] Failed to clear commands cache:', err);
      });
    }
  }, [projectPath]);

  // Search commands
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      loadCommands();
      return;
    }

    setIsLoading(true);
    try {
      const results = await api.searchClaudeCommands(searchQuery, projectPath);
      setCommands(results);
    } catch (error) {
      showToast('Failed to search commands', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, projectPath, loadCommands]);

  // Create new command
  const handleCreateCommand = useCallback(() => {
    setSelectedCommand(null);
    setEditorOpen(true);
  }, []);

  // Edit command
  const handleEditCommand = useCallback((command: ClaudeCommand) => {
    setSelectedCommand(command);
    setEditorOpen(true);
  }, []);

  // Duplicate command
  const handleDuplicateCommand = useCallback(async (command: ClaudeCommand) => {
    const duplicateName = `${command.name}-copy`;
    try {
      await api.createClaudeCommand(duplicateName, command.content);
      showToast(`Command duplicated as '${duplicateName}'`, 'success');
      await loadCommands();
    } catch (error) {
      showToast(`Failed to duplicate command: ${error}`, 'error');
    }
  }, [loadCommands]);

  // Open delete confirmation dialog
  const handleDeleteCommand = useCallback((name: string) => {
    setCommandToDelete(name);
    setDeleteConfirmOpen(true);
  }, []);

  // Confirm and execute deletion
  const confirmDelete = useCallback(async () => {
    if (!commandToDelete) return;
    
    try {
      await api.deleteClaudeCommand(commandToDelete);
      showToast(`Command '${commandToDelete}' deleted successfully`, 'success');
      await loadCommands();
      // Close dialog after successful deletion
      setDeleteConfirmOpen(false);
    } catch (error) {
      showToast(`Failed to delete command: ${error}`, 'error');
      // Keep dialog open on error so user can retry
    }
  }, [commandToDelete, loadCommands]);

  // Save command (create or update)
  const handleSaveCommand = useCallback(async (name: string, content: string) => {
    try {
      if (selectedCommand) {
        // Check if name changed - if so, we need to rename
        if (name !== selectedCommand.name) {
          // First update the content
          await api.updateClaudeCommand(selectedCommand.name, content);
          // Then rename the command
          await api.renameClaudeCommand(selectedCommand.name, name);
          showToast(`Command renamed to '${name}' and updated successfully`, 'success');
        } else {
          // Just update content
          await api.updateClaudeCommand(selectedCommand.name, content);
          showToast(`Command '${selectedCommand.name}' updated successfully`, 'success');
        }
      } else {
        await api.createClaudeCommand(name, content);
        showToast(`Command '${name}' created successfully`, 'success');
      }
      // First close the dialog
      setEditorOpen(false);
      // Clear selected command to ensure create works next time
      setSelectedCommand(null);
      // Add a small delay to ensure backend cache invalidation has completed
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadCommands();
    } catch (error) {
      showToast(`Failed to save command: ${error}`, 'error');
      throw error; // Re-throw to let CommandEditor know the save failed
    }
  }, [selectedCommand, loadCommands]);

  // Export commands
  const handleExport = useCallback(async () => {
    try {
      const exportData = await api.exportCommands();
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Use Tauri's native file save
      const savedPath = await api.exportCommandsToFile(jsonString);
      
      if (savedPath) {
        const filename = savedPath.split('/').pop() || 'commands.json';
        showToast(`Exported ${exportData.commands.length} commands to ${filename}`, 'success');
      }
      
    } catch (error) {
      // Only show error if it's not a cancellation
      if (error !== 'Save cancelled' && error !== 'Error: Save cancelled') {
        console.error('Export error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Failed to export commands: ${errorMessage}`, 'error');
      }
    }
  }, []);

  // Import commands with conflict detection
  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data: CommandsExport = JSON.parse(text);
        const result = await api.importCommands(data);
        
        // Check if there are conflicts
        if (result.conflicts && result.conflicts.length > 0) {
          // Store the data and result for later use
          setPendingImportData(data);
          setImportResult(result);
          setImportConflicts(result.conflicts);
          setImportConflictOpen(true);
        } else {
          // No conflicts, show success message
          const importedCount = result.imported.length;
          const skippedCount = result.skipped.length;
          const failedCount = result.failed.length;
          
          let message = `Imported ${importedCount} command${importedCount !== 1 ? 's' : ''}`;
          if (skippedCount > 0) {
            message += `, skipped ${skippedCount} identical`;
          }
          if (failedCount > 0) {
            message += `, ${failedCount} failed`;
          }
          
          showToast(message, 'success');
          await loadCommands();
        }
      } catch (error) {
        showToast('Failed to import commands', 'error');
      }
    };
    input.click();
  }, [loadCommands]);

  // Handle conflict resolution
  const handleResolveConflicts = useCallback(async (overwriteList: string[]) => {
    if (!pendingImportData || !importResult) return;
    
    try {
      if (overwriteList.length > 0) {
        // Import with overwrite
        const result = await api.importCommandsWithOverwrite(pendingImportData, overwriteList);
        
        const totalImported = result.imported.length;
        const skippedCount = result.skipped.length;
        const failedCount = result.failed.length;
        
        let message = `Imported ${totalImported} command${totalImported !== 1 ? 's' : ''}`;
        if (skippedCount > 0) {
          message += `, skipped ${skippedCount}`;
        }
        if (failedCount > 0) {
          message += `, ${failedCount} failed`;
        }
        
        showToast(message, 'success');
      } else {
        // User chose to skip conflicts
        const importedCount = importResult.imported.length;
        const skippedCount = importResult.skipped.length + importResult.conflicts.length;
        
        let message = `Imported ${importedCount} command${importedCount !== 1 ? 's' : ''}`;
        if (skippedCount > 0) {
          message += `, skipped ${skippedCount}`;
        }
        
        showToast(message, 'info');
      }
      
      await loadCommands();
    } catch (error) {
      showToast('Failed to resolve conflicts', 'error');
    } finally {
      // Clean up
      setPendingImportData(null);
      setImportResult(null);
      setImportConflicts([]);
    }
  }, [pendingImportData, importResult, loadCommands]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - Fixed height */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button onClick={onBack} variant="ghost" size="icon">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-2xl font-bold">Commands</h1>
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search commands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleImport} variant="outline" size="icon" title="Import commands">
              <Upload className="h-4 w-4" />
            </Button>
            <Button onClick={handleExport} variant="outline" size="icon" title="Export commands">
              <Download className="h-4 w-4" />
            </Button>
            <Button onClick={handleCreateCommand}>
              <Plus className="h-4 w-4 mr-2" />
              New Command
            </Button>
          </div>
        </div>
      </div>

      {/* Commands List - Scrollable */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : commands.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              {searchQuery ? 'No commands found matching your search.' : 'No commands yet. Create your first command!'}
            </Card>
          ) : (
            <div className="grid gap-4 pb-4">
              {commands.map((command) => (
                <CommandCard
                  key={command.name}
                  command={command}
                  onEdit={() => handleEditCommand(command)}
                  onDelete={() => handleDeleteCommand(command.name)}
                  onDuplicate={() => handleDuplicateCommand(command)}
                />
              ))}
            </div>
          )}
        </div>
        </ScrollArea>
      </div>

      {/* Command Editor */}
      <CommandEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          // Clear selected command when dialog closes
          if (!open) {
            setSelectedCommand(null);
          }
        }}
        command={selectedCommand}
        onSave={handleSaveCommand}
      />

      {/* Toast Notifications */}
      {toast.show && (
        <ToastContainer>
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast({ ...toast, show: false })}
          />
        </ToastContainer>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteConfirmOpen} 
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          // Only clear the command name when dialog is fully closed
          if (!open) {
            setCommandToDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Command</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the command "{commandToDelete}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Conflict Dialog */}
      {importResult && (
        <ImportConflictDialog
          open={importConflictOpen}
          onOpenChange={setImportConflictOpen}
          conflicts={importConflicts}
          onResolve={handleResolveConflicts}
          initialResult={importResult}
        />
      )}

    </div>
  );
};