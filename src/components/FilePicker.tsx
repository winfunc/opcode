import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
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
  ChevronRight,
} from "lucide-react";
import type { FileEntry } from "@/lib/api";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

import { handleError } from "@/lib/errorHandler";
// Global caches that persist across component instances
const globalDirectoryCache = new Map<string, FileEntry[]>();
const globalSearchCache = new Map<string, FileEntry[]>();

// Note: These caches persist for the lifetime of the application.
// In a production app, you might want to:
// 1. Add TTL (time-to-live) to expire old entries
// 2. Implement LRU (least recently used) eviction
// 3. Clear caches when the working directory changes
// 4. Add a maximum cache size limit

/**
 * Props interface for the FilePicker component
 */
interface FilePickerProps {
  /**
   * The base directory path to browse
   */
  basePath: string;
  /**
   * Callback when a file/directory is selected
   */
  onSelect: (entry: FileEntry) => void;
  /**
   * Callback to close the picker
   */
  onClose: () => void;
  /**
   * Initial search query
   */
  initialQuery?: string;
  /**
   * Optional className for styling
   */
  className?: string;
}

// File icon mapping based on extension
/**
 * Get appropriate icon for file type
 *
 * @param entry - File entry to get icon for
 * @returns React icon component
 */
const getFileIcon = (entry: FileEntry) => {
  if (entry.is_directory) return Folder;

  const ext = entry.extension?.toLowerCase();
  if (!ext) return File;

  // Code files
  if (["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "cpp", "c", "h"].includes(ext)) {
    return FileCode;
  }

  // Text/Markdown files
  if (["md", "txt", "json", "yaml", "yml", "toml", "xml", "html", "css"].includes(ext)) {
    return FileText;
  }

  // Image files
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"].includes(ext)) {
    return FileImage;
  }

  return File;
};

// Format file size to human readable
/**
 * Format file size in human-readable format
 *
 * @param bytes - File size in bytes
 * @returns Formatted size string (e.g., "1.2 MB", "345 KB")
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * FilePicker component - File browser with fuzzy search
 *
 * @example
 * <FilePicker
 *   basePath="/Users/example/project"
 *   onSelect={(entry) => logger.debug('Selected:', entry)}
 *   onClose={() => setShowPicker(false)}
 * />
 */
/**
 * FilePicker component for browsing and selecting files/directories
 *
 * A comprehensive file browser with search functionality, directory navigation,
 * caching for performance, and support for both files and directories.
 * Features include breadcrumb navigation, file type icons, and size display.
 *
 * @param basePath - The base directory path to browse
 * @param onSelect - Callback when a file/directory is selected
 * @param onClose - Callback to close the picker
 * @param initialQuery - Initial search query
 * @param allowDirectories - Whether to allow directory selection (default: true)
 * @param fileExtensions - Array of allowed file extensions (optional)
 *
 * @example
 * ```tsx
 * <FilePicker
 *   basePath="/home/user/projects"
 *   onSelect={(entry) => {
 *     console.log('Selected:', entry.path);
 *     if (entry.isDirectory) {
 *       // Handle directory selection
 *     } else {
 *       // Handle file selection
 *     }
 *   }}
 *   onClose={() => setShowPicker(false)}
 *   allowDirectories={false}
 *   fileExtensions={['.ts', '.tsx', '.js', '.jsx']}
 * />
 * ```
 */
export const FilePicker: React.FC<FilePickerProps> = ({
  basePath,
  onSelect,
  onClose,
  initialQuery = "",
  className,
}) => {
  const searchQuery = initialQuery;

  const [currentPath, setCurrentPath] = useState(basePath);
  const [entries, setEntries] = useState<FileEntry[]>(() =>
    searchQuery.trim() ? [] : globalDirectoryCache.get(basePath) || []
  );
  const [searchResults, setSearchResults] = useState<FileEntry[]>(() => {
    if (searchQuery.trim()) {
      const cacheKey = `${basePath}:${searchQuery}`;
      return globalSearchCache.get(cacheKey) || [];
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>([basePath]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isShowingCached, setIsShowingCached] = useState(() => {
    // Check if we're showing cached data on mount
    if (searchQuery.trim()) {
      const cacheKey = `${basePath}:${searchQuery}`;
      return globalSearchCache.has(cacheKey);
    }
    return globalDirectoryCache.has(basePath);
  });

  const searchDebounceRef = useRef<globalThis.NodeJS.Timeout | null>(null);
  const fileListRef = useRef<globalThis.HTMLDivElement>(null);

  // Computed values
  const displayEntries = searchQuery.trim() ? searchResults : entries;
  const canGoBack = pathHistory.length > 1;

  // Get relative path for display
  const relativePath = currentPath.startsWith(basePath)
    ? currentPath.slice(basePath.length) || "/"
    : currentPath;

  // Load directory contents
  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      globalThis.clearTimeout(searchDebounceRef.current);
    }

    if (searchQuery.trim()) {
      const cacheKey = `${basePath}:${searchQuery}`;

      // Immediately show cached results if available
      if (globalSearchCache.has(cacheKey)) {
        logger.debug("[FilePicker] Immediately showing cached search results for:", searchQuery);
        setSearchResults(globalSearchCache.get(cacheKey) || []);
        setIsShowingCached(true);
        setError(null);
      }

      // Schedule fresh search after debounce
      searchDebounceRef.current = globalThis.setTimeout(() => {
        performSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
      setIsShowingCached(false);
    }

    return () => {
      if (searchDebounceRef.current) {
        globalThis.clearTimeout(searchDebounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, basePath]);

  // Reset selected index when entries change
  useEffect(() => {
    setSelectedIndex(0);
  }, [entries, searchResults]);

  // Keyboard navigation

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const displayEntries = searchQuery.trim() ? searchResults : entries;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;

        case "Enter":
          e.preventDefault();
          // Enter always selects the current item (file or directory)
          if (displayEntries.length > 0 && selectedIndex < displayEntries.length) {
            onSelect(displayEntries[selectedIndex]);
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          break;

        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(displayEntries.length - 1, prev + 1));
          break;

        case "ArrowRight":
          e.preventDefault();
          // Right arrow enters directories
          if (displayEntries.length > 0 && selectedIndex < displayEntries.length) {
            const entry = displayEntries[selectedIndex];
            if (entry.is_directory) {
              navigateToDirectory(entry.path);
            }
          }
          break;

        case "ArrowLeft":
          e.preventDefault();
          // Left arrow goes back to parent directory
          if (canGoBack) {
            navigateBack();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, searchResults, selectedIndex, searchQuery, canGoBack, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (fileListRef.current) {
      const selectedElement = fileListRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  const loadDirectory = async (path: string) => {
    try {
      logger.debug("[FilePicker] Loading directory:", path);

      // Check cache first and show immediately
      if (globalDirectoryCache.has(path)) {
        logger.debug("[FilePicker] Showing cached contents for:", path);
        setEntries(globalDirectoryCache.get(path) || []);
        setIsShowingCached(true);
        setError(null);
      } else {
        // Only show loading if we don't have cached data
        setIsLoading(true);
      }

      // Always fetch fresh data in background
      const contents = await api.listDirectoryContents(path);
      logger.debug("[FilePicker] Loaded fresh contents:", contents.length, "items");

      // Cache the results
      globalDirectoryCache.set(path, contents);

      // Update with fresh data
      setEntries(contents);
      setIsShowingCached(false);
      setError(null);
    } catch (err) {
      await handleError("[FilePicker] Failed to load directory:", { context: path, err });
      await handleError("[FilePicker] Error details:", { context: err });
      // Only set error if we don't have cached data to show
      if (!globalDirectoryCache.has(path)) {
        setError(err instanceof Error ? err.message : "Failed to load directory");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const performSearch = useCallback(
    async (query: string) => {
      try {
        logger.debug("[FilePicker] Searching for:", query, "in:", basePath);

        // Create cache key that includes both query and basePath
        const cacheKey = `${basePath}:${query}`;

        // Check cache first and show immediately
        if (globalSearchCache.has(cacheKey)) {
          logger.debug("[FilePicker] Showing cached search results for:", query);
          setSearchResults(globalSearchCache.get(cacheKey) || []);
          setIsShowingCached(true);
          setError(null);
        } else {
          // Only show loading if we don't have cached data
          setIsLoading(true);
        }

        // Always fetch fresh results in background
        const results = await api.searchFiles(basePath, query);
        logger.debug("[FilePicker] Fresh search results:", results.length, "items");

        // Cache the results
        globalSearchCache.set(cacheKey, results);

        // Update with fresh results
        setSearchResults(results);
        setIsShowingCached(false);
        setError(null);
      } catch (err) {
        await handleError("[FilePicker] Search failed:", { context: query, err });
        // Only set error if we don't have cached data to show
        const cacheKey = `${basePath}:${query}`;
        if (!globalSearchCache.has(cacheKey)) {
          setError(err instanceof Error ? err.message : "Search failed");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [basePath]
  );

  const navigateToDirectory = (path: string) => {
    setCurrentPath(path);
    setPathHistory((prev) => [...prev, path]);
  };

  const navigateBack = useCallback(() => {
    if (pathHistory.length > 1) {
      const newHistory = [...pathHistory];
      newHistory.pop(); // Remove current
      const previousPath = newHistory[newHistory.length - 1];

      // Don't go beyond the base path
      if (previousPath.startsWith(basePath) || previousPath === basePath) {
        setCurrentPath(previousPath);
        setPathHistory(newHistory);
      }
    }
  }, [pathHistory, basePath]);

  const handleEntryClick = (entry: FileEntry) => {
    // Single click always selects (file or directory)
    onSelect(entry);
  };

  const handleEntryDoubleClick = (entry: FileEntry) => {
    // Double click navigates into directories
    if (entry.is_directory) {
      navigateToDirectory(entry.path);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "absolute bottom-full mb-2 left-0 z-50",
        "w-[500px] h-[400px]",
        "bg-background border border-border rounded-lg shadow-lg",
        "flex flex-col overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="border-b border-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={navigateBack}
              disabled={!canGoBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono text-muted-foreground truncate max-w-[300px]">
              {relativePath}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Show loading only if no cached data */}
        {isLoading && displayEntries.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}

        {/* Show subtle indicator when displaying cached data while fetching fresh */}
        {isShowingCached && isLoading && displayEntries.length > 0 && (
          <div className="absolute top-1 right-2 text-xs text-muted-foreground/50 italic">
            updating...
          </div>
        )}

        {error && displayEntries.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {!isLoading && !error && displayEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <Search className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              {searchQuery.trim() ? "No files found" : "Empty directory"}
            </span>
          </div>
        )}

        {displayEntries.length > 0 && (
          <div className="p-2 space-y-0.5" ref={fileListRef}>
            {displayEntries.map((entry, index) => {
              const Icon = getFileIcon(entry);
              const isSearching = searchQuery.trim() !== "";
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={entry.path}
                  data-index={index}
                  onClick={() => handleEntryClick(entry)}
                  onDoubleClick={() => handleEntryDoubleClick(entry)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md",
                    "hover:bg-accent transition-colors",
                    "text-left text-sm",
                    isSelected && "bg-accent"
                  )}
                  title={
                    entry.is_directory
                      ? "Click to select • Double-click to enter"
                      : "Click to select"
                  }
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      entry.is_directory ? "text-blue-500" : "text-muted-foreground"
                    )}
                  />

                  <span className="flex-1 truncate">{entry.name}</span>

                  {!entry.is_directory && entry.size > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(entry.size)}
                    </span>
                  )}

                  {entry.is_directory && <ChevronRight className="h-4 w-4 text-muted-foreground" />}

                  {isSearching && (
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                      {entry.path.replace(basePath, "").replace(/^\//, "")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-2">
        <p className="text-xs text-muted-foreground text-center">
          ↑↓ Navigate • Enter Select • → Enter Directory • ← Go Back • Esc Close
        </p>
      </div>
    </motion.div>
  );
};
