import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { getFileIcon } from "./fileIcons";
import { SubFolderContent } from "./SubFolderContent";

interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size?: number;
  extension?: string;
}

interface FileTreeItemProps {
  entry: FileEntry;
  level?: number;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onAddToChat: (path: string) => void;
  onFileClick: (path: string, isDirectory: boolean) => void;
  onCalculateTokens: (path: string) => Promise<number | null>;
  isFiltered: (entry: FileEntry) => boolean;
}

export function FileTreeItem({
  entry,
  level = 0,
  expandedFolders,
  onToggleFolder,
  onAddToChat,
  onFileClick,
  onCalculateTokens,
  isFiltered,
}: FileTreeItemProps) {
  const [tokens, setTokens] = useState<number | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(false);

  const handleMouseEnter = async () => {
    if (!entry.is_directory && tokens === null && !loadingTokens) {
      setLoadingTokens(true);
      const calculatedTokens = await onCalculateTokens(entry.path);
      setTokens(calculatedTokens);
      setLoadingTokens(false);
    }
  };

  if (isFiltered(entry)) return null;

  return (
    <div
      className="group"
      style={{ marginLeft: `${level * 2}px` }}
      onMouseEnter={handleMouseEnter}
    >
      <div className="flex items-center gap-0.5 py-1 px-1 hover:bg-gray-100 rounded">
        {entry.is_directory && (
          <Button
            variant="ghost"
            size="icon"
            className="p-0.5 w-4 h-4"
            onClick={() => onToggleFolder(entry.path)}
          >
            {expandedFolders.has(entry.path) ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </Button>
        )}

        {getFileIcon(entry)}

        <span
          className="flex-1 text-sm cursor-pointer hover:text-blue-600"
          onClick={() => {
            if (entry.is_directory) {
              onToggleFolder(entry.path);
            } else {
              onFileClick(entry.path, entry.is_directory);
            }
          }}
        >
          {entry.name}
        </span>

        {tokens !== null && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="text-xs">
                  {tokens}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tokens} tokens</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}


        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 p-1 h-auto"
          onClick={() => onAddToChat(entry.path)}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {entry.is_directory && expandedFolders.has(entry.path) && (
        <SubFolderContent
          folderPath={entry.path}
          level={level + 1}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          onAddToChat={onAddToChat}
          onFileClick={onFileClick}
          onCalculateTokens={onCalculateTokens}
          isFiltered={isFiltered}
        />
      )}
    </div>
  );
}