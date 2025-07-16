import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { api } from '@/lib/api';
import type { Session, Project } from '@/lib/api';

interface SessionState {
  // Projects and sessions data
  projects: Project[];
  sessions: Record<string, Session[]>; // Keyed by projectId
  currentSessionId: string | null;
  currentSession: Session | null;
  sessionOutputs: Record<string, string>; // Keyed by sessionId
  
  // UI state
  isLoadingProjects: boolean;
  isLoadingSessions: boolean;
  isLoadingOutputs: boolean;
  error: string | null;
  
  // Actions
  fetchProjects: () => Promise<void>;
  fetchProjectSessions: (projectId: string) => Promise<void>;
  setCurrentSession: (sessionId: string | null) => void;
  fetchSessionOutput: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string, projectId: string) => Promise<void>;
  clearError: () => void;
  
  // Real-time updates
  handleSessionUpdate: (session: Session) => void;
  handleOutputUpdate: (sessionId: string, output: string) => void;
}

export const useSessionStore = create<SessionState>()(
  subscribeWithSelector((set, get) => ({
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
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch projects',
          isLoadingProjects: false 
        });
      }
    },
    
    // Fetch sessions for a specific project
    fetchProjectSessions: async (projectId: string) => {
      set({ isLoadingSessions: true, error: null });
      try {
        const projectSessions = await api.getProjectSessions(projectId);
        set(state => ({
          sessions: {
            ...state.sessions,
            [projectId]: projectSessions
          },
          isLoadingSessions: false
        }));
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch sessions',
          isLoadingSessions: false 
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
          const found = projectSessions.find(s => s.id === sessionId);
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
        set(state => ({
          sessionOutputs: {
            ...state.sessionOutputs,
            [sessionId]: output
          },
          isLoadingOutputs: false
        }));
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch session output',
          isLoadingOutputs: false 
        });
      }
    },
    
    // Delete session
    deleteSession: async (sessionId: string, projectId: string) => {
      try {
        // Note: API doesn't have a deleteSession method, so this is a placeholder
        console.warn('deleteSession not implemented in API');
        
        // Update local state
        set(state => ({
          sessions: {
            ...state.sessions,
            [projectId]: state.sessions[projectId]?.filter(s => s.id !== sessionId) || []
          },
          currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
          currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
          sessionOutputs: Object.fromEntries(
            Object.entries(state.sessionOutputs).filter(([id]) => id !== sessionId)
          )
        }));
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to delete session'
        });
        throw error;
      }
    },
    
    // Clear error
    clearError: () => set({ error: null }),
    
    // Handle session update
    handleSessionUpdate: (session: Session) => {
      set(state => {
        const projectId = session.project_id;
        const projectSessions = state.sessions[projectId] || [];
        const existingIndex = projectSessions.findIndex(s => s.id === session.id);
        
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
            [projectId]: updatedSessions
          },
          currentSession: state.currentSessionId === session.id ? session : state.currentSession
        };
      });
    },
    
    // Handle output update
    handleOutputUpdate: (sessionId: string, output: string) => {
      set(state => ({
        sessionOutputs: {
          ...state.sessionOutputs,
          [sessionId]: output
        }
      }));
    }
  }))
);