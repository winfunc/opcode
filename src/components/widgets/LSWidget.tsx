import React, { useState } from "react";
import { FolderOpen, Folder, FileCode, FileText, Terminal, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props interface for the LSWidget component
 */
interface LSWidgetProps {
  /** The file system path to list */
  path: string;
  /** Optional result object containing directory listing data */
  result?: unknown;
}

/**
 * LSWidget component for displaying directory listings
 *
 * A file explorer widget that shows directory contents with file/folder icons
 * and interactive features. Can display both the command and its results.
 *
 * @param path - The file system path to display
 * @param result - Result object containing directory listing data
 *
 * @example
 * ```tsx
 * <LSWidget
 *   path="/home/user/projects"
 *   result={{ content: "folder1/\nfile1.txt\nfile2.js" }}
 * />
 * ```
 */
export const LSWidget: React.FC<LSWidgetProps> = ({ path, result }) => {
  // If we have a result, show it using the LSResultWidget
  if (result) {
    let resultContent = "";
    const resultObj = result as { content?: unknown };
    if (typeof resultObj.content === "string") {
      resultContent = resultObj.content;
    } else if (resultObj.content && typeof resultObj.content === "object") {
      const contentObj = resultObj.content as { text?: string } | unknown[];
      if ("text" in contentObj && typeof contentObj.text === "string") {
        resultContent = contentObj.text;
      } else if (Array.isArray(contentObj)) {
        resultContent = contentObj
          .map((c: unknown) =>
            typeof c === "string" ? c : (c as Record<string, unknown>).text || JSON.stringify(c)
          )
          .join("\n");
      } else {
        resultContent = JSON.stringify(resultObj.content, null, 2);
      }
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          <FolderOpen className="h-4 w-4 text-primary" />
          <span className="text-sm">Directory contents for:</span>
          <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">{path}</code>
        </div>
        {resultContent && <LSResultWidget content={resultContent} />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
      <FolderOpen className="h-4 w-4 text-primary" />
      <span className="text-sm">Listing directory:</span>
      <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">{path}</code>
      {!result && (
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
          <span>Loading...</span>
        </div>
      )}
    </div>
  );
};

interface LSResultWidgetProps {
  content: string;
}

export const LSResultWidget: React.FC<LSResultWidgetProps> = ({ content }) => {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Parse the directory tree structure
  /**
   * Parse raw directory listing content into structured tree data
   *
   * @param rawContent - Raw text content from directory listing command
   * @returns Array of directory entry objects with path, name, level, and type
   */
  const parseDirectoryTree = (rawContent: string) => {
    const lines = rawContent.split("\n");
    const entries: Array<{
      path: string;
      name: string;
      type: "file" | "directory";
      level: number;
    }> = [];

    let currentPath: string[] = [];

    for (const line of lines) {
      // Skip NOTE section and everything after it
      if (line.startsWith("NOTE:")) {
        break;
      }

      // Skip empty lines
      if (!line.trim()) continue;

      // Calculate indentation level
      const indent = line.match(/^(\s*)/)?.[1] || "";
      const level = Math.floor(indent.length / 2);

      // Extract the entry name
      const entryMatch = line.match(/^\s*-\s+(.+?)(\/$)?$/);
      if (!entryMatch) continue;

      const fullName = entryMatch[1];
      const isDirectory = line.trim().endsWith("/");
      const name = isDirectory ? fullName : fullName;

      // Update current path based on level
      currentPath = currentPath.slice(0, level);
      currentPath.push(name);

      entries.push({
        path: currentPath.join("/"),
        name,
        type: isDirectory ? "directory" : "file",
        level,
      });
    }

    return entries;
  };

  const entries = parseDirectoryTree(content);

  /**
   * Toggle the expanded state of a directory
   *
   * @param path - Path of the directory to toggle
   */
  const toggleDirectory = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Group entries by parent for collapsible display
  /**
   * Get child entries for a given parent directory
   *
   * @param parentPath - Path of the parent directory
   * @param parentLevel - Nesting level of the parent directory
   * @returns Array of child directory entries
   */
  const getChildren = (parentPath: string, parentLevel: number) => {
    return entries.filter((e) => {
      if (e.level !== parentLevel + 1) return false;
      const parentParts = parentPath.split("/").filter(Boolean);
      const entryParts = e.path.split("/").filter(Boolean);

      // Check if this entry is a direct child of the parent
      if (entryParts.length !== parentParts.length + 1) return false;

      // Check if all parent parts match
      for (let i = 0; i < parentParts.length; i++) {
        if (parentParts[i] !== entryParts[i]) return false;
      }

      return true;
    });
  };

  /**
   * Render a single directory entry with appropriate icon and styling
   *
   * @param entry - Directory entry object to render
   * @param isRoot - Whether this is a root-level entry
   * @returns JSX element for the directory entry
   */
  const renderEntry = (entry: (typeof entries)[0], isRoot = false) => {
    const hasChildren =
      entry.type === "directory" &&
      entries.some((e) => e.path.startsWith(`${entry.path}/`) && e.level === entry.level + 1);
    const isExpanded = expandedDirs.has(entry.path) || isRoot;

    /**
     * Get appropriate icon for file or directory entry
     *
     * @returns Lucide icon component based on entry type and file extension
     */
    const getIcon = () => {
      if (entry.type === "directory") {
        return isExpanded ? (
          <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
        ) : (
          <Folder className="h-3.5 w-3.5 text-blue-500" />
        );
      }

      // File type icons based on extension
      const ext = entry.name.split(".").pop()?.toLowerCase();
      switch (ext) {
        case "rs":
          return <FileCode className="h-3.5 w-3.5 text-orange-500" />;
        case "toml":
        case "yaml":
        case "yml":
        case "json":
          return <FileText className="h-3.5 w-3.5 text-yellow-500" />;
        case "md":
          return <FileText className="h-3.5 w-3.5 text-blue-400" />;
        case "js":
        case "jsx":
        case "ts":
        case "tsx":
          return <FileCode className="h-3.5 w-3.5 text-yellow-400" />;
        case "py":
          return <FileCode className="h-3.5 w-3.5 text-blue-500" />;
        case "go":
          return <FileCode className="h-3.5 w-3.5 text-cyan-500" />;
        case "sh":
        case "bash":
          return <Terminal className="h-3.5 w-3.5 text-green-500" />;
        default:
          return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
      }
    };

    return (
      <div key={entry.path}>
        <div
          className={cn(
            "flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 transition-colors cursor-pointer",
            !isRoot && "ml-4"
          )}
          onClick={() => entry.type === "directory" && hasChildren && toggleDirectory(entry.path)}
        >
          {entry.type === "directory" && hasChildren && (
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          )}
          {(!hasChildren || entry.type !== "directory") && <div className="w-3" />}
          {getIcon()}
          <span className="text-sm font-mono">{entry.name}</span>
        </div>

        {entry.type === "directory" && hasChildren && isExpanded && (
          <div className="ml-2">
            {getChildren(entry.path, entry.level).map((child) => renderEntry(child))}
          </div>
        )}
      </div>
    );
  };

  // Get root entries
  const rootEntries = entries.filter((e) => e.level === 0);

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="space-y-1">{rootEntries.map((entry) => renderEntry(entry, true))}</div>
    </div>
  );
};
