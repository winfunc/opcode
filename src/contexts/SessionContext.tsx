import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { sessionStorage, type StoredSession } from '@/services/sessionStorage';

interface ActiveSession {
  sessionId: string;
  projectPath: string;
  isActive: boolean;
  hasUnsavedChanges: boolean;
}

interface SessionContextType {
  activeSession: ActiveSession | null;
  setActiveSession: (session: ActiveSession | null) => void;
  checkNavigationAllowed: () => Promise<boolean>;
  isNavigationBlocked: boolean;
  activeSessions: StoredSession[];
  resumeSession: (sessionId: string) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
};

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activeSessions, setActiveSessions] = useState<StoredSession[]>([]);
  const [sessionToResume, setSessionToResume] = useState<string | null>(null);

  const isNavigationBlocked = activeSession?.isActive || false;
  
  // Load active sessions on mount
  useEffect(() => {
    const sessions = sessionStorage.getActiveSessions();
    setActiveSessions(sessions);
  }, []);
  
  // Save session periodically when active
  useEffect(() => {
    if (!activeSession?.isActive) return;
    
    const saveInterval = setInterval(() => {
      // This would need to be enhanced to get actual messages from ClaudeCodeSession
      // For now, just update timestamp to keep session alive
      const sessions = sessionStorage.getAllSessions();
      if (sessions[activeSession.sessionId]) {
        sessionStorage.saveSession(
          activeSession.sessionId,
          activeSession.projectPath,
          sessions[activeSession.sessionId].messages
        );
      }
    }, 5000); // Save every 5 seconds
    
    return () => clearInterval(saveInterval);
  }, [activeSession]);

  const checkNavigationAllowed = useCallback(async (): Promise<boolean> => {
    if (!activeSession?.isActive) {
      return true;
    }

    return new Promise((resolve) => {
      const confirmed = window.confirm(
        'You have an active Claude Code session. Are you sure you want to navigate away? This will interrupt the current conversation.'
      );
      resolve(confirmed);
    });
  }, [activeSession]);
  
  const resumeSession = useCallback((sessionId: string) => {
    const session = sessionStorage.getSession(sessionId);
    if (session) {
      // This will trigger navigation to the session
      window.dispatchEvent(new CustomEvent('claude-session-selected', {
        detail: { 
          session: {
            id: session.sessionId,
            project_id: session.projectPath,
            project_path: session.projectPath,
          }
        }
      }));
    }
  }, []);

  return (
    <SessionContext.Provider
      value={{
        activeSession,
        setActiveSession,
        checkNavigationAllowed,
        isNavigationBlocked,
        activeSessions,
        resumeSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};