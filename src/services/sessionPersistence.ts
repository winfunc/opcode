/**
 * Session Persistence Service
 * Handles saving and restoring session data for chat tabs
 */

import { api, type Session } from '@/lib/api';

const STORAGE_KEY_PREFIX = 'opcode_session_';
const SESSION_INDEX_KEY = 'opcode_session_index';

export interface SessionRestoreData {
  sessionId: string;
  projectId: string;
  projectPath: string;
  lastMessageCount?: number;
  scrollPosition?: number;
  timestamp: number;
  // Conversation tracking
  primaryConversationId?: string; // The first session ID in this conversation
  isConversationRoot?: boolean; // True for the first session in a conversation
}

export class SessionPersistenceService {
  /**
   * Save session data for later restoration
   */
  static saveSession(sessionId: string, projectId: string, projectPath: string, messageCount?: number, scrollPosition?: number, primaryConversationId?: string): void {
    try {
      const sessionData: SessionRestoreData = {
        sessionId,
        projectId,
        projectPath,
        lastMessageCount: messageCount,
        scrollPosition,
        timestamp: Date.now(),
        primaryConversationId: primaryConversationId || sessionId, // Use this sessionId as primary if none provided
        isConversationRoot: !primaryConversationId // True if no primary provided (this is the first session)
      };

      // Save individual session data
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${sessionId}`, JSON.stringify(sessionData));

      // Update session index
      const index = this.getSessionIndex();
      if (!index.includes(sessionId)) {
        index.push(sessionId);
        localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(index));
      }
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
  }

  /**
   * Load session data for restoration
   */
  static loadSession(sessionId: string): SessionRestoreData | null {
    try {
      const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
      if (!data) return null;

      const sessionData = JSON.parse(data) as SessionRestoreData;
      
      // Validate the data
      if (!sessionData.sessionId || !sessionData.projectId || !sessionData.projectPath) {
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('Failed to load session data:', error);
      return null;
    }
  }

  /**
   * Remove session data from storage
   */
  static removeSession(sessionId: string): void {
    try {
      // Remove session data
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`);

      // Update session index
      const index = this.getSessionIndex();
      const newIndex = index.filter(id => id !== sessionId);
      localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(newIndex));
    } catch (error) {
      console.error('Failed to remove session data:', error);
    }
  }

  /**
   * Get all saved session IDs
   */
  static getSessionIndex(): string[] {
    try {
      const index = localStorage.getItem(SESSION_INDEX_KEY);
      return index ? JSON.parse(index) : [];
    } catch (error) {
      console.error('Failed to get session index:', error);
      return [];
    }
  }

  /**
   * Clear all session data
   */
  static clearAllSessions(): void {
    try {
      const index = this.getSessionIndex();
      
      // Remove all session data
      index.forEach(sessionId => {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
      });

      // Clear the index
      localStorage.removeItem(SESSION_INDEX_KEY);
    } catch (error) {
      console.error('Failed to clear session data:', error);
    }
  }

  /**
   * Clean up old session data (older than 30 days)
   */
  static cleanupOldSessions(): void {
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const index = this.getSessionIndex();
      const activeIndex: string[] = [];

      index.forEach(sessionId => {
        const data = this.loadSession(sessionId);
        if (data && data.timestamp > thirtyDaysAgo) {
          activeIndex.push(sessionId);
        } else {
          localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
        }
      });

      localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(activeIndex));
    } catch (error) {
      console.error('Failed to cleanup old sessions:', error);
    }
  }

  /**
   * Check if session exists on disk and is restorable
   */
  static async isSessionRestorable(sessionId: string, projectId: string): Promise<boolean> {
    try {
      // First check if we have the session metadata
      const sessionData = this.loadSession(sessionId);
      if (!sessionData) return false;

      // Try to verify the session exists on disk by loading its history
      const history = await api.loadSessionHistory(sessionId, projectId);
      return history && history.length > 0;
    } catch (error) {
      console.error('Failed to check session restorability:', error);
      return false;
    }
  }

  /**
   * Create Session object from restore data
   */
  static createSessionFromRestoreData(data: SessionRestoreData): Session {
    return {
      id: data.sessionId,
      project_id: data.projectId,
      project_path: data.projectPath,
      created_at: data.timestamp / 1000, // Convert to seconds
      first_message: "Restored session"
    };
  }

  /**
   * Get only the primary conversation sessions (filter out continuation sessions)
   */
  static getPrimaryConversationSessions(): string[] {
    try {
      const index = this.getSessionIndex();
      const primarySessions: string[] = [];

      index.forEach(sessionId => {
        const data = this.loadSession(sessionId);
        if (data && data.isConversationRoot) {
          primarySessions.push(sessionId);
        }
      });

      return primarySessions;
    } catch (error) {
      console.error('Failed to get primary conversation sessions:', error);
      return [];
    }
  }

  /**
   * Get all sessions that belong to a specific conversation
   */
  static getConversationSessions(primaryConversationId: string): string[] {
    try {
      const index = this.getSessionIndex();
      const conversationSessions: string[] = [];

      index.forEach(sessionId => {
        const data = this.loadSession(sessionId);
        if (data && data.primaryConversationId === primaryConversationId) {
          conversationSessions.push(sessionId);
        }
      });

      return conversationSessions.sort((a, b) => {
        const dataA = this.loadSession(a);
        const dataB = this.loadSession(b);
        if (!dataA || !dataB) return 0;
        return dataA.timestamp - dataB.timestamp; // Sort by timestamp
      });
    } catch (error) {
      console.error('Failed to get conversation sessions:', error);
      return [];
    }
  }
}
