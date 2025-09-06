import { useCallback, useRef } from 'react';

export interface ScreenReaderAnnouncementOptions {
  priority?: 'polite' | 'assertive';
  delay?: number;
}

/**
 * Custom hook to manage screen reader announcements for incoming messages
 * Uses ARIA live regions to announce content to screen readers
 */
export const useScreenReaderAnnouncements = () => {
  const announcementTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnnouncementRef = useRef<string>('');

  /**
   * Announces a message to screen readers via ARIA live regions
   * @param message - The message content to announce
   * @param options - Configuration options for the announcement
   */
  const announceMessage = useCallback((message: string, options: ScreenReaderAnnouncementOptions = {}) => {
    const { priority = 'polite', delay = 100 } = options;
    
    // Clear any pending announcements
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
    }
    
    // Don't announce the same message twice in a row
    if (message === lastAnnouncementRef.current) {
      return;
    }
    
    lastAnnouncementRef.current = message;
    
    // Small delay to ensure DOM updates are complete
    announcementTimeoutRef.current = setTimeout(() => {
      // Find or create the live region
      let liveRegion = document.getElementById('claude-announcements');
      
      if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = 'claude-announcements';
        liveRegion.setAttribute('aria-live', priority);
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        liveRegion.style.cssText = `
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        `;
        document.body.appendChild(liveRegion);
      }
      
      // Update the live region priority if needed
      if (liveRegion.getAttribute('aria-live') !== priority) {
        liveRegion.setAttribute('aria-live', priority);
      }
      
      // Clear and set the new message
      liveRegion.textContent = '';
      // Force a small delay to ensure screen readers detect the change
      setTimeout(() => {
        liveRegion!.textContent = message;
      }, 50);
    }, delay);
  }, []);

  /**
   * Announces when Claude starts responding
   */
  const announceClaudeStarted = useCallback(() => {
    announceMessage('Claude says', { priority: 'polite' });
  }, [announceMessage]);

  /**
   * Announces when Claude finishes responding
   */
  const announceClaudeFinished = useCallback(() => {
    announceMessage('Finished', { priority: 'polite' });
  }, [announceMessage]);

  /**
   * Announces new assistant message content
   */
  const announceAssistantMessage = useCallback((content: string) => {
    // Clean up the content for screen reader announcement
    const cleanContent = cleanMessageForAnnouncement(content);
    if (cleanContent) {
      announceMessage(`Claude says: ${cleanContent}`, { priority: 'polite' });
    }
  }, [announceMessage]);

  /**
   * Announces tool execution
   */
  const announceToolExecution = useCallback((toolName: string, description?: string) => {
    const message = description 
      ? `Using ${toolName}: ${description}`
      : `Using ${toolName}`;
    announceMessage(message, { priority: 'polite' });
  }, [announceMessage]);

  /**
   * Announces tool completion
   */
  const announceToolCompleted = useCallback((toolName: string, success: boolean) => {
    const status = success ? 'done' : 'failed';
    announceMessage(`${toolName} ${status}`, { priority: 'polite' });
  }, [announceMessage]);

  return {
    announceMessage,
    announceClaudeStarted,
    announceClaudeFinished,
    announceAssistantMessage,
    announceToolExecution,
    announceToolCompleted,
  };
};

/**
 * Cleans message content for screen reader announcement
 * Removes markdown formatting and truncates if too long
 */
function cleanMessageForAnnouncement(content: string): string {
  if (!content) return '';
  
  // Remove markdown formatting
  let cleaned = content
    .replace(/```[\s\S]*?```/g, '[code block]') // Replace code blocks
    .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
    .replace(/#{1,6}\s*/g, '') // Remove heading markers
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();
  
  // Truncate if too long (screen readers work better with shorter announcements)
  if (cleaned.length > 200) {
    cleaned = cleaned.substring(0, 197) + '...';
  }
  
  return cleaned;
}