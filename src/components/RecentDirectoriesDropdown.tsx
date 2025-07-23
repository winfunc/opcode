import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Clock, Folder, X, Trash2 } from 'lucide-react';
import { useRecentDirectories } from '@/hooks/useRecentDirectories';
import { cn } from '@/lib/utils';

interface RecentDirectoriesDropdownProps {
  onSelectDirectory: (path: string) => void;
  currentPath?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Dropdown component for selecting from recently used directories
 * Shows up to 10 most recently used working directories with timestamps
 */
export function RecentDirectoriesDropdown({ 
  onSelectDirectory, 
  currentPath, 
  disabled = false,
  className 
}: RecentDirectoriesDropdownProps) {
  const { 
    recentDirectories, 
    isLoading, 
    removeRecentDirectory, 
    clearRecentDirectories 
  } = useRecentDirectories();

  const handleSelectDirectory = (path: string) => {
    onSelectDirectory(path);
  };

  const handleRemoveDirectory = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeRecentDirectory(path);
  };

  const handleClearAll = () => {
    clearRecentDirectories();
  };

  const formatLastUsed = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={true}
        className={cn("flex items-center gap-2", className)}
      >
        <Clock className="w-4 h-4" />
        Loading...
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || recentDirectories.length === 0}
          className={cn("flex items-center gap-2", className)}
          title={recentDirectories.length === 0 ? "No recent directories" : "Select from recent directories"}
        >
          <Clock className="w-4 h-4" />
          Recent ({recentDirectories.length})
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-96 max-h-96 overflow-y-auto" align="start">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Folder className="w-4 h-4" />
          Recent Directories
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {recentDirectories.length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No recent directories yet
          </div>
        ) : (
          <>
            {recentDirectories.map((directory) => (
              <DropdownMenuItem
                key={directory.path}
                className={cn(
                  "flex items-center justify-between gap-2 py-2 cursor-pointer group",
                  directory.path === currentPath && "bg-accent"
                )}
                onClick={() => handleSelectDirectory(directory.path)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate" title={directory.displayName}>
                        {directory.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate" title={directory.path}>
                        {directory.path}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatLastUsed(directory.lastUsed)}
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={(e) => handleRemoveDirectory(e, directory.path)}
                  title="Remove from recent directories"
                >
                  <X className="w-3 h-3" />
                </Button>
              </DropdownMenuItem>
            ))}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem
              className="flex items-center gap-2 text-muted-foreground hover:text-destructive cursor-pointer"
              onClick={handleClearAll}
            >
              <Trash2 className="w-4 h-4" />
              Clear all recent directories
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}