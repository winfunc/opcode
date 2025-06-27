import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface NavigationConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const NavigationConfirmDialog: React.FC<NavigationConfirmDialogProps> = ({
  open,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Active Claude Session
          </DialogTitle>
          <DialogDescription className="pt-3">
            You have an active Claude Code session that is currently running. 
            Navigating away will interrupt the conversation and may lose any ongoing work.
            <br /><br />
            Are you sure you want to leave this page?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Stay on Page
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Leave Page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};