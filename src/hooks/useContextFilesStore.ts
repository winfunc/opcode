import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ContextFile {
  path: string;
  name: string;
  addedAt: number;
}

interface ContextFilesState {
  contextFiles: ContextFile[];
  addFile: (path: string) => void;
  removeFile: (path: string) => void;
  clearFiles: () => void;
  getFileName: (path: string) => string;
}

export const useContextFilesStore = create<ContextFilesState>()(
  persist(
    (set, get) => ({
      contextFiles: [],

      addFile: (path: string) => {
        const fileName = get().getFileName(path);
        const newFile: ContextFile = {
          path,
          name: fileName,
          addedAt: Date.now(),
        };

        set((state) => ({
          contextFiles: state.contextFiles.some((f) => f.path === path)
            ? state.contextFiles
            : [...state.contextFiles, newFile],
        }));
      },

      removeFile: (path: string) => {
        set((state) => ({
          contextFiles: state.contextFiles.filter((f) => f.path !== path),
        }));
      },

      clearFiles: () => {
        set({ contextFiles: [] });
      },

      getFileName: (path: string) => {
        return path.split("/").pop() || path;
      },
    }),
    {
      name: "context-files-storage",
    },
  ),
);
