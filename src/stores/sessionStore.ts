import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import { api } from '@/lib/api';
import { handleApiError } from "@/lib/errorHandler";
import type { Session, Project } from '@/lib/api';

/**
 * Session store state interface
 *
 * Manages the global state for projects, sessions, and their outputs.
 * Provides actions for fetching, updating, and managing session data.
 */
interface SessionState {
  // Projects and sessions data
  /** Array of all available projects */
  projects: Project[];
  /** Sessions grouped by project ID */
  sessions: Record<string, Session[]>; // Keyed by projectId
  /** ID of the currently selected session */
  currentSessionId: string | null;
  /** Currently selected session object */
  currentSession: Session | null;
  /** Session outputs cached by session ID */
  sessionOutputs: Record<string, string>; // Keyed by sessionId

  // UI state
  /** Whether projects are currently being loaded */
  isLoadingProjects: boolean;
  /** Whether sessions are currently being loaded */
  isLoadingSessions: boolean;
  /** Whether session outputs are currently being loaded */
  isLoadingOutputs: boolean;
  /** Current error message, if any */
  error: string | null;

  // Actions
  /** Fetch all available projects */
  fetchProjects: () => Promise<void>;
  /** Fetch sessions for a specific project */
  fetchProjectSessions: (projectId: string) => Promise<void>;
  /** Set the currently selected session */
  setCurrentSession: (sessionId: string | null) => void;
  /** Fetch output for a specific session */
  fetchSessionOutput: (sessionId: string) => Promise<void>;
  /** Delete a session and update local state */
  deleteSession: (sessionId: string, projectId: string) => Promise<void>;
  /** Clear any current error */
  clearError: () => void;

  // Real-time updates
  /** Handle real-time session updates */
  handleSessionUpdate: (session: Session) => void;
  /** Handle real-time output updates */
  handleOutputUpdate: (sessionId: string, output: string) => void;
}

const sessionStore: StateCreator<
  SessionState,
  [],
  [['zustand/subscribeWithSelector', never]],
  SessionState
> = (set, get) => ({
    // Initial state
    projects: [],
    sessions: {},
    currentSessionId: null,
    currentSession: null,
    sessionOutputs: {},
    isLoadingProjects: false,
    isLoadingSessions: false,
    isLoadingOutputs: false,
    error: null,

    // Fetch all projects
    fetchProjects: async () => {
      set({ isLoadingProjects: true, error: null });
      try {
        const projects = await api.listProjects();
        set({ projects, isLoadingProjects: false });
      } catch (error) {
        await handleApiError(error as Error, { operation: "fetchProjects" });
        set({
          error: error instanceof Error ? error.message : "Failed to fetch projects",
          isLoadingProjects: false,
        });
      }
    },

    // Fetch sessions for a specific project
    fetchProjectSessions: async (projectId: string) => {
      set({ isLoadingSessions: true, error: null });
      try {
        const projectSessions = await api.getProjectSessions(projectId);
        set((state) => ({
          sessions: {
            ...state.sessions,
            [projectId]: projectSessions,
          },
          isLoadingSessions: false,
        }));
      } catch (error) {
        await handleApiError(error as Error, { operation: "fetchProjectSessions", projectId });
        set({
          error: error instanceof Error ? error.message : "Failed to fetch sessions",
          isLoadingSessions: false,
        });
      }
    },

    // Set current session
    setCurrentSession: (sessionId: string | null) => {
      const { sessions } = get();
      let currentSession: Session | null = null;

      if (sessionId) {
        // Find session across all projects
        for (const projectSessions of Object.values(sessions)) {
          const found = projectSessions.find((s) => s.id === sessionId);
          if (found) {
            currentSession = found;
            break;
          }
        }
      }

      set({ currentSessionId: sessionId, currentSession });
    },

    // Fetch session output
    fetchSessionOutput: async (sessionId: string) => {
      set({ isLoadingOutputs: true, error: null });
      try {
        const output = await api.getClaudeSessionOutput(sessionId);
        set((state) => ({
          sessionOutputs: {
            ...state.sessionOutputs,
            [sessionId]: output,
          },
          isLoadingOutputs: false,
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to fetch session output",
          isLoadingOutputs: false,
        });
      }
    },

    // Delete session
    deleteSession: async (sessionId: string, projectId: string) => {
      try {
        // Call the actual API to delete the session
        await api.deleteSession(sessionId, projectId);

        // Update local state
        set((state) => ({
          sessions: {
            ...state.sessions,
            [projectId]: state.sessions[projectId]?.filter((s) => s.id !== sessionId) || []
          },
          currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
          currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
          sessionOutputs: Object.fromEntries(
            Object.entries(state.sessionOutputs).filter(([id]) => id !== sessionId)
          ),
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to delete session",
        });
        throw error;
      }
    },

    // Clear error
    clearError: () => set({ error: null }),

    // Handle session update
    handleSessionUpdate: (session: Session) => {
      set((state) => {
        const projectId = session.project_id;
        const projectSessions = state.sessions[projectId] || [];
        const existingIndex = projectSessions.findIndex((s) => s.id === session.id);

        let updatedSessions;
        if (existingIndex >= 0) {
          updatedSessions = [...projectSessions];
          updatedSessions[existingIndex] = session;
        } else {
          updatedSessions = [session, ...projectSessions];
        }

        return {
          sessions: {
            ...state.sessions,
            [projectId]: updatedSessions,
          },
          currentSession: state.currentSessionId === session.id ? session : state.currentSession,
        };
      });
    },

    // Handle output update
    handleOutputUpdate: (sessionId: string, output: string) => {
      set((state) => ({
        sessionOutputs: {
          ...state.sessionOutputs,
          [sessionId]: output,
        },
      }));
    }
  });

export const useSessionStore = create<SessionState>()(
  subscribeWithSelector(sessionStore)
);
