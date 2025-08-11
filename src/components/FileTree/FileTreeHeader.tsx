import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Folder, Filter, RefreshCw } from "lucide-react";

interface FileTreeHeaderProps {
  currentFolder?: string;
  filterText: string;
  onFilterTextChange: (text: string) => void;
  showFilter: boolean;
  onToggleFilter: () => void;
  onRefresh: () => void;
  excludeFolders: string[];
}

export function FileTreeHeader({
  currentFolder,
  filterText,
  onFilterTextChange,
  showFilter,
  onToggleFilter,
  onRefresh,
  excludeFolders,
}: FileTreeHeaderProps) {
  const getCurrentDirectoryName = () => {
    if (!currentFolder) return "Home";
    return currentFolder.split("/").pop() || currentFolder;
  };

  return (
    <div className="p-2 border-b space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
        <Folder className="w-4 h-4 text-blue-500" />
          <span
            className="text-sm font-medium text-gray-700 truncate"
            title={currentFolder || "Home"}
          >
            {getCurrentDirectoryName()}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          title="Refresh directory"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleFilter}
        >
          <Filter className="w-4 h-4" />
        </Button>
        <Input
          placeholder="Filter files..."
          value={filterText}
          onChange={(e) => onFilterTextChange(e.target.value)}
          className="text-sm"
        />
      </div>

      {showFilter && (
        <div className="text-xs">
          <div className="mb-2 font-medium">Excluded folders:</div>
          <div className="flex flex-wrap gap-1">
            {excludeFolders.map((folder) => (
              <Badge key={folder} variant="outline" className="text-xs">
                {folder}
              </Badge>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Go to Settings to manage excluded folders
          </div>
        </div>
      )}
    </div>
  );
}