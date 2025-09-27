import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

/**
 * Custom hook for managing auto-scroll preference globally
 * This hook handles loading, saving, and providing the auto-scroll setting
 * across the application.
 */
export const useAutoScroll = () => {
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);

  // Load auto-scroll preference from storage
  useEffect(() => {
    const loadAutoScrollPreference = async () => {
      try {
        setIsLoading(true);

        // First check localStorage for instant loading
        const cached = typeof window !== 'undefined'
          ? window.localStorage.getItem('app_setting:auto_scroll_enabled')
          : null;

        if (cached === 'true') {
          setAutoScrollEnabled(true);
        } else if (cached === 'false') {
          setAutoScrollEnabled(false);
        }

        // Then verify from database
        const pref = await api.getSetting('auto_scroll_enabled');
        const enabled = pref === null ? true : pref === 'true'; // Default to true
        setAutoScrollEnabled(enabled);
      } catch (error) {
        console.error('Failed to load auto-scroll preference:', error);
        // Default to enabled on error
        setAutoScrollEnabled(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadAutoScrollPreference();
  }, []);

  /**
   * Update the auto-scroll preference
   * @param enabled - Whether auto-scroll should be enabled
   */
  const updateAutoScrollPreference = async (enabled: boolean) => {
    try {
      setAutoScrollEnabled(enabled);
      await api.saveSetting('auto_scroll_enabled', enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Failed to save auto-scroll preference:', error);
      // Revert on error
      setAutoScrollEnabled(!enabled);
      throw error;
    }
  };

  return {
    autoScrollEnabled,
    isLoading,
    updateAutoScrollPreference,
  };
};