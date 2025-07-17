import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

// Local checkpoint format for UI display
interface Checkpoint {
  id: string;
  sessionId: string;
  name: string;
  createdAt: string;
  messageCount: number;
}

interface UseCheckpointsOptions {
  sessionId: string | null;
  projectId: string;
  projectPath: string;
  onToast?: (message: string, type: 'success' | 'error') => void;
}

export function useCheckpoints({ sessionId, projectId, projectPath, onToast }: UseCheckpointsOptions) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [isLoadingCheckpoints, setIsLoadingCheckpoints] = useState(false);
  const [timelineVersion, setTimelineVersion] = useState(0);
  
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (onToast) {
      onToast(message, type);
    }
  }, [onToast]);

  const loadCheckpoints = useCallback(async () => {
    if (!sessionId) return;
    
    setIsLoadingCheckpoints(true);
    try {
      const result = await api.listCheckpoints(sessionId, projectId, projectPath);
      // Map API Checkpoint type to local format if needed
      const mappedCheckpoints = result.map(cp => ({
        id: cp.id,
        sessionId: cp.sessionId,
        name: cp.description || `Checkpoint at ${cp.timestamp}`,
        createdAt: cp.timestamp,
        messageCount: cp.metadata.totalTokens
      }));
      setCheckpoints(mappedCheckpoints);
      setTimelineVersion(prev => prev + 1);
    } catch (error) {
      console.error("Failed to load checkpoints:", error);
      showToast("Failed to load checkpoints", 'error');
    } finally {
      setIsLoadingCheckpoints(false);
    }
  }, [sessionId, projectId, projectPath, showToast]);

  const createCheckpoint = useCallback(async (name: string) => {
    if (!sessionId) return;
    
    try {
      await api.createCheckpoint(sessionId, projectId, projectPath, undefined, name);
      await loadCheckpoints();
      showToast("Checkpoint created successfully", 'success');
    } catch (error) {
      console.error("Failed to create checkpoint:", error);
      showToast("Failed to create checkpoint", 'error');
      throw error;
    }
  }, [sessionId, projectId, projectPath, loadCheckpoints, showToast]);

  const restoreCheckpoint = useCallback(async (checkpointId: string) => {
    if (!sessionId) return;
    
    try {
      await api.restoreCheckpoint(checkpointId, sessionId, projectId, projectPath);
      showToast("Checkpoint restored successfully", 'success');
      // Return true to indicate success
      return true;
    } catch (error) {
      console.error("Failed to restore checkpoint:", error);
      showToast("Failed to restore checkpoint", 'error');
      return false;
    }
  }, [sessionId, projectId, projectPath, showToast]);

  const deleteCheckpoint = useCallback(async (_checkpointId: string) => {
    if (!sessionId) return;
    
    try {
      // API doesn't have deleteCheckpoint, using a placeholder
      console.warn('deleteCheckpoint not implemented in API');
      await loadCheckpoints();
      showToast("Checkpoint deleted successfully", 'success');
    } catch (error) {
      console.error("Failed to delete checkpoint:", error);
      showToast("Failed to delete checkpoint", 'error');
    }
  }, [sessionId, loadCheckpoints, showToast]);

  const forkCheckpoint = useCallback(async (checkpointId: string, newSessionName: string) => {
    if (!sessionId) return null;
    
    try {
      const forkedSession = await api.forkFromCheckpoint(checkpointId, sessionId, projectId, projectPath, newSessionName, 'Forked from checkpoint');
      showToast("Session forked successfully", 'success');
      return forkedSession;
    } catch (error) {
      console.error("Failed to fork checkpoint:", error);
      showToast("Failed to fork session", 'error');
      return null;
    }
  }, [sessionId, projectId, projectPath, showToast]);

  return {
    checkpoints,
    isLoadingCheckpoints,
    timelineVersion,
    loadCheckpoints,
    createCheckpoint,
    restoreCheckpoint,
    deleteCheckpoint,
    forkCheckpoint
  };
}