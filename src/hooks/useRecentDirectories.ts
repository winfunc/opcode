import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface RecentDirectory {
  path: string;
  lastUsed: string; // ISO date string
  displayName: string; // derived from path
}

const MAX_RECENT_DIRECTORIES = 10;
const RECENT_DIRECTORIES_KEY = 'recentDirectories';

/**
 * Hook for managing recent working directories
 * Stores recent directories in Claude settings and provides utilities for managing them
 */
export function useRecentDirectories() {
  const [recentDirectories, setRecentDirectories] = useState<RecentDirectory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load recent directories from settings on mount
  useEffect(() => {
    loadRecentDirectories();
  }, []);

  const loadRecentDirectories = useCallback(async () => {
    try {
      setIsLoading(true);
      const settings = await api.getClaudeSettings();
      const recent = settings[RECENT_DIRECTORIES_KEY] as RecentDirectory[] || [];
      
      // Sort by last used date (most recent first) and validate
      const validRecent = recent
        .filter(dir => dir && dir.path && dir.path.trim() !== '' && dir.lastUsed && dir.displayName)
        .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
        .slice(0, MAX_RECENT_DIRECTORIES);
      
      setRecentDirectories(validRecent);
    } catch (error) {
      console.error('Failed to load recent directories:', error);
      setRecentDirectories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveRecentDirectories = useCallback(async (directories: RecentDirectory[]) => {
    try {
      const settings = await api.getClaudeSettings();
      const updatedSettings = {
        ...settings,
        [RECENT_DIRECTORIES_KEY]: directories
      };
      await api.saveClaudeSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to save recent directories:', error);
      throw error;
    }
  }, []);

  const addRecentDirectory = useCallback(async (path: string) => {
    if (!path || path.trim() === '' || path.trim().length === 0) return;

    const normalizedPath = path.trim();
    // Skip paths that are only whitespace characters
    if (normalizedPath.replace(/[\s\t\n\r]/g, '') === '') return;
    const displayName = normalizedPath.split('/').pop() || normalizedPath;
    const now = new Date().toISOString();

    const newDirectory: RecentDirectory = {
      path: normalizedPath,
      lastUsed: now,
      displayName
    };

    setRecentDirectories(current => {
      // Remove existing entry with same path (if any)
      const filtered = current.filter(dir => dir.path !== normalizedPath);
      
      // Add new entry at the beginning
      const updated = [newDirectory, ...filtered].slice(0, MAX_RECENT_DIRECTORIES);
      
      // Save to settings asynchronously
      saveRecentDirectories(updated).catch(console.error);
      
      return updated;
    });
  }, [saveRecentDirectories]);

  const removeRecentDirectory = useCallback(async (path: string) => {
    setRecentDirectories(current => {
      const updated = current.filter(dir => dir.path !== path);
      
      // Save to settings asynchronously
      saveRecentDirectories(updated).catch(console.error);
      
      return updated;
    });
  }, [saveRecentDirectories]);

  const clearRecentDirectories = useCallback(async () => {
    setRecentDirectories([]);
    await saveRecentDirectories([]);
  }, [saveRecentDirectories]);

  return {
    recentDirectories,
    isLoading,
    addRecentDirectory,
    removeRecentDirectory,
    clearRecentDirectories,
    refreshRecentDirectories: loadRecentDirectories
  };
}