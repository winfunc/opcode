import React, { useState } from 'react';
import { ClaudeCommand } from '../lib/api';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Pencil, 
  Trash2, 
  Terminal, 
  Clock, 
  HardDrive,
  FileCode,
  Copy,
  CopyPlus
} from 'lucide-react';
import { Toast, ToastContainer } from './ui/toast';

interface CommandCardProps {
  command: ClaudeCommand;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
}

export const CommandCard: React.FC<CommandCardProps> = ({ command, onEdit, onDelete, onDuplicate }) => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    else return Math.round(bytes / 1048576) + ' MB';
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(command.content);
    setToastMessage('Command content copied to clipboard');
    setShowToast(true);
  };

  const handleDelete = () => {
    onDelete();
  };

  return (
    <>
    <Card className="p-4 hover:shadow-lg transition-shadow overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-lg truncate">{command.name}</h3>
            {command.is_executable && (
              <Badge variant="secondary" className="shrink-0">
                <FileCode className="h-3 w-3 mr-1" />
                Executable
              </Badge>
            )}
          </div>
          
          {command.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{command.description}</p>
          )}
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Modified: {formatDate(command.modified_at)}</span>
            </div>
            <div className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              <span>{formatFileSize(command.file_size)}</span>
            </div>
          </div>

          {/* Command preview */}
          <div className="mt-3 p-2 bg-muted rounded-md overflow-hidden">
            <pre className="text-xs font-mono text-muted-foreground line-clamp-2 whitespace-pre-wrap break-all">
              {command.content}
            </pre>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            title="Copy command"
          >
            <Copy className="h-4 w-4" />
          </Button>
          {onDuplicate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDuplicate}
              title="Duplicate command"
            >
              <CopyPlus className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            title="Edit command"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            title="Delete command"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
    
    {showToast && (
      <ToastContainer>
        <Toast
          message={toastMessage}
          type="success"
          onDismiss={() => setShowToast(false)}
        />
      </ToastContainer>
    )}
  </>
  );
};