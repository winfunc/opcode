export interface StoredSession {
  sessionId: string;
  projectPath: string;
  messages: any[];
  timestamp: number;
}

const SESSION_STORAGE_KEY = 'claudia_active_sessions';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const sessionStorage = {
  saveSession(sessionId: string, projectPath: string, messages: any[]): void {
    try {
      const sessions = this.getAllSessions();
      sessions[sessionId] = {
        sessionId,
        projectPath,
        messages,
        timestamp: Date.now(),
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
    } catch (err) {
      console.error('Failed to save session to storage:', err);
    }
  },

  getSession(sessionId: string): StoredSession | null {
    try {
      const sessions = this.getAllSessions();
      const session = sessions[sessionId];
      
      if (!session) return null;
      
      // Check if session is expired
      if (Date.now() - session.timestamp > SESSION_EXPIRY_MS) {
        this.removeSession(sessionId);
        return null;
      }
      
      return session;
    } catch (err) {
      console.error('Failed to get session from storage:', err);
      return null;
    }
  },

  getAllSessions(): Record<string, StoredSession> {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return {};
      
      const sessions = JSON.parse(stored);
      
      // Clean up expired sessions
      const now = Date.now();
      Object.keys(sessions).forEach(id => {
        if (now - sessions[id].timestamp > SESSION_EXPIRY_MS) {
          delete sessions[id];
        }
      });
      
      return sessions;
    } catch (err) {
      console.error('Failed to parse sessions from storage:', err);
      return {};
    }
  },

  removeSession(sessionId: string): void {
    try {
      const sessions = this.getAllSessions();
      delete sessions[sessionId];
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
    } catch (err) {
      console.error('Failed to remove session from storage:', err);
    }
  },

  getActiveSessions(): StoredSession[] {
    const sessions = this.getAllSessions();
    return Object.values(sessions).filter(s => 
      Date.now() - s.timestamp < SESSION_EXPIRY_MS
    );
  },

  clearAllSessions(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear sessions from storage:', err);
    }
  }
};