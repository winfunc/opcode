import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/hooks/useSettingsStore";
import { useFolderStore } from "@/hooks/useFolderStore";
import { useContextFilesStore } from "@/hooks/useContextFilesStore";
import { useFileTokens } from "@/hooks/useFileTokens";
import { FileTreeHeader } from "./FileTreeHeader";
import { FileTreeItem } from "./FileTreeItem";

interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size?: number;
  extension?: string;
}

interface FileTreeProps {
  currentFolder?: string;
  onAddToChat?: (path: string) => void;
  onFileClick?: (path: string) => void;
}

export function FileTree({
  currentFolder,
  onAddToChat,
  onFileClick,
}: FileTreeProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const { excludeFolders } = useSettingsStore();
  const { setCurrentFolder } = useFolderStore();
  const { addFile, clearFiles } = useContextFilesStore();
  const { calculateTokens } = useFileTokens();

  const loadDirectory = async (path?: string) => {
    setLoading(true);
    setError(null);

    try {
      let targetPath = path || currentFolder;
      if (!targetPath) {
        const defaultDirs = await invoke<string[]>("get_default_directories");
        targetPath = defaultDirs[0];
        setCurrentFolder(targetPath);
      }

      const result = await invoke<FileEntry[]>("read_directory", {
        path: targetPath,
      });
      setEntries(result);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };


  const toggleFolder = async (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (expandedFolders.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const handleAddToChat = (path: string) => {
    addFile(path);
    if (onAddToChat) {
      onAddToChat(path);
    }
  };

  const handleFileClick = (path: string, isDirectory: boolean) => {
    if (!isDirectory) {
      clearFiles();
      addFile(path);
      if (onFileClick) {
        onFileClick(path);
      }
    }
  };


  const isFiltered = (entry: FileEntry): boolean => {
    if (
      filterText &&
      !entry.name.toLowerCase().includes(filterText.toLowerCase())
    ) {
      return true;
    }

    if (entry.is_directory && excludeFolders.includes(entry.name)) {
      return true;
    }

    return false;
  };

  useEffect(() => {
    loadDirectory();
  }, [currentFolder]);

  if (loading && entries.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">Loading files...</div>
    );
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <FileTreeHeader
        currentFolder={currentFolder}
        filterText={filterText}
        onFilterTextChange={setFilterText}
        showFilter={showFilter}
        onToggleFilter={() => setShowFilter(!showFilter)}
        onRefresh={() => loadDirectory()}
        excludeFolders={excludeFolders}
      />

      <div className="flex-1 overflow-y-auto">
        {entries.map((entry) => (
          <FileTreeItem
            key={entry.path}
            entry={entry}
            expandedFolders={expandedFolders}
            onToggleFolder={toggleFolder}
            onAddToChat={handleAddToChat}
            onFileClick={handleFileClick}
            onCalculateTokens={calculateTokens}
            isFiltered={isFiltered}
          />
        ))}
      </div>
    </div>
  );
}