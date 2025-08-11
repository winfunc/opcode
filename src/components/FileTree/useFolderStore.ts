import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FolderHistory {
  path: string;
  name: string;
  lastVisited: number;
}

interface FolderStore {
  currentFolder: string | null;
  folderHistory: FolderHistory[];
  setCurrentFolder: (folder: string) => void;
  addToHistory: (path: string, name: string) => void;
  clearHistory: () => void;
  removeFromHistory: (path: string) => void;
}

export const useFolderStore = create<FolderStore>()(
  persist(
    (set, get) => ({
      currentFolder: null,
      folderHistory: [],
      setCurrentFolder: (folder: string) => {
        const folderName = folder.split("/").pop() || folder;
        get().addToHistory(folder, folderName);
        set({ currentFolder: folder });
      },
      addToHistory: (path: string, name: string) =>
        set((state) => {
          const existingIndex = state.folderHistory.findIndex(
            (h) => h.path === path,
          );
          const newEntry = { path, name, lastVisited: Date.now() };

          if (existingIndex >= 0) {
            const updated = [...state.folderHistory];
            updated[existingIndex] = newEntry;
            return { folderHistory: updated };
          } else {
            return {
              folderHistory: [newEntry, ...state.folderHistory].slice(0, 20), // Keep last 20 entries
            };
          }
        }),
      clearHistory: () => set({ folderHistory: [] }),
      removeFromHistory: (path: string) =>
        set((state) => ({
          folderHistory: state.folderHistory.filter((h) => h.path !== path),
        })),
    }),
    {
      name: "folder-storage",
    },
  ),
);
