import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  isFavorited?: boolean;
}

interface NoteStore {
  notes: Note[];
  currentNoteId: string | null;
  
  // Actions
  createNote: (title?: string, content?: string) => Note;
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) => void;
  deleteNote: (id: string) => void;
  setCurrentNote: (id: string | null) => void;
  addContentToNote: (id: string, content: string, source?: string) => void;
  createNoteFromContent: (content: string, source?: string) => Note;
  toggleFavorite: (id: string) => void;
  
  // Getters
  getCurrentNote: () => Note | null;
  getNoteById: (id: string) => Note | null;
}

const generateId = () => `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const generateTitle = (content: string): string => {
  if (!content.trim()) return "New Note";
  
  // Take first line or first 50 characters as title
  const firstLine = content.split('\n')[0].trim();
  if (firstLine.length > 0 && firstLine.length <= 50) {
    return firstLine;
  }
  
  const truncated = content.trim().substring(0, 50);
  return truncated.length < content.trim().length ? `${truncated}...` : truncated;
};

export const useNoteStore = create<NoteStore>()(
  persist(
    (set, get) => ({
      notes: [],
      currentNoteId: null,

      createNote: (title, content = "") => {
        const now = Date.now();
        const note: Note = {
          id: generateId(),
          title: title || generateTitle(content) || "New Note",
          content,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          notes: [note, ...state.notes],
          currentNoteId: note.id,
        }));

        return note;
      },

      updateNote: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  ...updates,
                  title: updates.title || (updates.content ? generateTitle(updates.content) : note.title),
                  updatedAt: Date.now(),
                }
              : note
          ),
        }));
      },

      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
          currentNoteId: state.currentNoteId === id ? null : state.currentNoteId,
        }));
      },

      setCurrentNote: (id) => {
        set({ currentNoteId: id });
      },

      addContentToNote: (id, content, source) => {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = source ? `[${source} - ${timestamp}]\n` : `[${timestamp}]\n`;
        
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  content: note.content ? `${note.content}\n\n${prefix}${content}` : `${prefix}${content}`,
                  updatedAt: Date.now(),
                }
              : note
          ),
        }));
      },

      createNoteFromContent: (content, source) => {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = source ? `[${source} - ${timestamp}]\n` : `[${timestamp}]\n`;
        const noteContent = `${prefix}${content}`;
        
        return get().createNote(undefined, noteContent);
      },

      getCurrentNote: () => {
        const { notes, currentNoteId } = get();
        return currentNoteId ? notes.find((note) => note.id === currentNoteId) || null : null;
      },

      getNoteById: (id) => {
        const { notes } = get();
        return notes.find((note) => note.id === id) || null;
      },

      toggleFavorite: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? { ...note, isFavorited: !note.isFavorited }
              : note
          ),
        }));
      },
    }),
    {
      name: "plux-notes-storage",
      version: 1,
    }
  )
);