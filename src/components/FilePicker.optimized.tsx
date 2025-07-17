import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { 
  X, 
  Folder, 
  File, 
  ArrowLeft,
  FileCode,
  FileText,
  FileImage,
  Search,
  ChevronRight
} from "lucide-react";
import type { FileEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

// Global caches that persist across component instances
const globalDirectoryCache = new Map<string, FileEntry[]>();
const globalSearchCache = new Map<string, FileEntry[]>();

interface FilePickerProps {
  basePath: string;
  onSelect: (entry: FileEntry) => void;
  onClose: () => void;
  initialQuery?: string;
  className?: string;
  allowDirectorySelection?: boolean;
}

// Memoized file icon selector
const getFileIcon = (entry: FileEntry) => {
  if (entry.is_directory) return Folder;
  
  const ext = entry.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'py':
    case 'java':
    case 'cpp':
    case 'c':
    case 'go':
    case 'rs':
      return FileCode;
    case 'md':
    case 'txt':
    case 'json':
    case 'xml':
    case 'yaml':
    case 'yml':
      return FileText;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return FileImage;
    default:
      return File;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export const FilePicker: React.FC<FilePickerProps> = React.memo(({
  basePath,
  onSelect,
  onClose,
  initialQuery = "",
  className,
  allowDirectorySelection = false
}) => {
  const [currentPath, setCurrentPath] = useState(basePath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout>();

  // Filter and sort entries
  const displayEntries = useMemo(() => {
    const filtered = searchQuery.trim()
      ? entries.filter(entry => 
          entry.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : entries;
    
    return filtered.sort((a, b) => {
      if (a.is_directory !== b.is_directory) {
        return a.is_directory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [entries, searchQuery]);

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: displayEntries.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 32, // Height of each item
    overscan: 10, // Number of items to render outside viewport
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Load directory contents
  const loadDirectory = useCallback(async (path: string) => {
    const cacheKey = path;
    
    // Check cache first
    if (globalDirectoryCache.has(cacheKey)) {
      setEntries(globalDirectoryCache.get(cacheKey)!);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.listDirectoryContents(path);
      globalDirectoryCache.set(cacheKey, result);
      setEntries(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search functionality
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      loadDirectory(currentPath);
      return;
    }

    const cacheKey = `${currentPath}:${query}`;
    
    if (globalSearchCache.has(cacheKey)) {
      setEntries(globalSearchCache.get(cacheKey)!);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.searchFiles(currentPath, query);
      globalSearchCache.set(cacheKey, result);
      setEntries(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, loadDirectory]);

  // Handle entry click
  const handleEntryClick = useCallback((entry: FileEntry) => {
    if (!entry.is_directory || allowDirectorySelection) {
      onSelect(entry);
    }
  }, [onSelect, allowDirectorySelection]);

  // Handle entry double click
  const handleEntryDoubleClick = useCallback((entry: FileEntry) => {
    if (entry.is_directory) {
      setCurrentPath(entry.path);
      setSearchQuery("");
      setSelectedIndex(0);
    } else {
      onSelect(entry);
    }
  }, [onSelect]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (displayEntries.length === 0) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(displayEntries.length - 1, prev + 1));
        break;
      case 'Enter':
        e.preventDefault();
        const selectedEntry = displayEntries[selectedIndex];
        if (selectedEntry) {
          if (e.shiftKey || !selectedEntry.is_directory) {
            handleEntryClick(selectedEntry);
          } else {
            handleEntryDoubleClick(selectedEntry);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [displayEntries, selectedIndex, handleEntryClick, handleEntryDoubleClick, onClose]);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // Load initial directory
  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const item = virtualizer.getVirtualItems().find(
      vItem => vItem.index === selectedIndex
    );
    if (item) {
      virtualizer.scrollToIndex(selectedIndex, { align: 'center' });
    }
  }, [selectedIndex, virtualizer]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn("flex flex-col bg-background rounded-lg shadow-lg", className)}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
            setCurrentPath(parentPath);
            setSearchQuery("");
          }}
          disabled={currentPath === '/' || currentPath === basePath}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Current path */}
      <div className="px-4 py-2 border-b">
        <div className="text-xs text-muted-foreground truncate">
          {currentPath}
        </div>
      </div>

      {/* File list with virtual scrolling */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
        style={{ height: '400px' }}
      >
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-destructive">{error}</div>
          </div>
        )}

        {!isLoading && !error && displayEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <Search className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              {searchQuery.trim() ? 'No files found' : 'Empty directory'}
            </span>
          </div>
        )}

        {displayEntries.length > 0 && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualRow) => {
              const entry = displayEntries[virtualRow.index];
              const Icon = getFileIcon(entry);
              const isSelected = virtualRow.index === selectedIndex;
              
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <button
                    onClick={() => handleEntryClick(entry)}
                    onDoubleClick={() => handleEntryDoubleClick(entry)}
                    onMouseEnter={() => setSelectedIndex(virtualRow.index)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5",
                      "hover:bg-accent transition-colors",
                      "text-left text-sm h-8",
                      isSelected && "bg-accent"
                    )}
                    title={entry.is_directory ? "Click to select • Double-click to enter" : "Click to select"}
                  >
                    <Icon className={cn(
                      "h-4 w-4 flex-shrink-0",
                      entry.is_directory ? "text-blue-500" : "text-muted-foreground"
                    )} />
                    
                    <span className="flex-1 truncate">
                      {entry.name}
                    </span>
                    
                    {!entry.is_directory && entry.size > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(entry.size)}
                      </span>
                    )}
                    
                    {entry.is_directory && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t">
        <div className="text-xs text-muted-foreground">
          {displayEntries.length} {displayEntries.length === 1 ? 'item' : 'items'}
        </div>
        {allowDirectorySelection && (
          <div className="text-xs text-muted-foreground">
            Shift+Enter to select directory
          </div>
        )}
      </div>
    </motion.div>
  );
});