import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ModernSidebar } from './ModernSidebar';
import { ModernTabBar } from './ModernTabBar';
import { ChatPanel } from './ChatPanel';
import { useTabState } from '@/hooks/useTabState';

interface CursorLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Cursor-style modern layout component
 * Features:
 * - Left sidebar for navigation and file management
 * - Modern tab bar with clean design
 * - Main content area for code/content editing
 * - Resizable right panel for AI chat integration
 * - Responsive design that adapts to screen size
 */
export const CursorLayout: React.FC<CursorLayoutProps> = ({ 
  children, 
  className 
}) => {
  const { tabs, activeTabId } = useTabState();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(true);
  const [chatPanelWidth, setChatPanelWidth] = useState(350);
  const [sidebarWidth, setSidebarWidth] = useState(280);

  // Auto-hide chat panel on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1200) {
        setChatPanelOpen(false);
      } else if (window.innerWidth > 1400) {
        setChatPanelOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      
      if (modKey) {
        switch (e.key) {
          case 'b':
            // Toggle sidebar
            e.preventDefault();
            setSidebarCollapsed(prev => !prev);
            break;
          case 'j':
            // Toggle chat panel
            e.preventDefault();
            setChatPanelOpen(prev => !prev);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={cn(
      "h-screen bg-background flex overflow-hidden",
      "cursor-layout",
      className
    )}>
      {/* Left Sidebar */}
      <ModernSidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Modern Tab Bar */}
        <ModernTabBar />
        
        {/* Content Area */}
        <div className="flex-1 flex min-h-0">
          {/* Main Editor Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-hidden bg-background">
              {children}
            </div>
          </div>

          {/* Right Chat Panel */}
          {chatPanelOpen && (
            <ChatPanel
              width={chatPanelWidth}
              onWidthChange={setChatPanelWidth}
              onClose={() => setChatPanelOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Quick Access Overlay */}
      {!chatPanelOpen && (
        <button
          onClick={() => setChatPanelOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-50",
            "w-12 h-12 rounded-full",
            "bg-primary text-primary-foreground",
            "shadow-lg hover:shadow-xl",
            "transition-all duration-200",
            "flex items-center justify-center",
            "hover:scale-110 active:scale-95"
          )}
          title="Open AI Chat (Ctrl+J)"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>
      )}
    </div>
  );
};