import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { AlertTriangle, FileText } from 'lucide-react';
import { ImportResult } from '../lib/api';

interface ImportConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: string[];
  onResolve: (overwriteList: string[]) => void;
  initialResult: ImportResult;
}

export const ImportConflictDialog: React.FC<ImportConflictDialogProps> = ({
  open,
  onOpenChange,
  conflicts,
  onResolve,
  initialResult,
}) => {
  const [selectedConflicts, setSelectedConflicts] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedConflicts(new Set(conflicts));
    } else {
      setSelectedConflicts(new Set());
    }
  };

  const handleToggleConflict = (name: string) => {
    const newSelected = new Set(selectedConflicts);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedConflicts(newSelected);
    setSelectAll(newSelected.size === conflicts.length);
  };

  const handleSkip = () => {
    onResolve([]);
    onOpenChange(false);
  };

  const handleOverwrite = () => {
    onResolve(Array.from(selectedConflicts));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Import Conflicts Detected
          </DialogTitle>
          <DialogDescription>
            {conflicts.length} command{conflicts.length !== 1 ? 's' : ''} already exist with different content.
            Select which ones you want to overwrite.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <div className="mb-2 text-sm text-muted-foreground">
            <div>✓ Imported: {initialResult.imported.length}</div>
            <div>⏭ Skipped (identical): {initialResult.skipped.length}</div>
            <div>⚠️ Conflicts: {conflicts.length}</div>
            {initialResult.failed.length > 0 && (
              <div>✗ Failed: {initialResult.failed.length}</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              id="select-all"
              checked={selectAll}
              onCheckedChange={handleSelectAll}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Select all conflicts
            </label>
          </div>

          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-2">
              {conflicts.map((name) => (
                <div key={name} className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id={`conflict-${name}`}
                    checked={selectedConflicts.has(name)}
                    onCheckedChange={() => handleToggleConflict(name)}
                  />
                  <label
                    htmlFor={`conflict-${name}`}
                    className="flex items-center gap-2 text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{name}</span>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleSkip}>
            Skip Conflicts
          </Button>
          <Button
            onClick={handleOverwrite}
            disabled={selectedConflicts.size === 0}
          >
            Overwrite Selected ({selectedConflicts.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};