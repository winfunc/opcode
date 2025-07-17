import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { X, Plus, MessageSquare, Bot, AlertCircle, Loader2, Folder, BarChart, Server, Settings, FileText } from 'lucide-react';
import { useTabState } from '@/hooks/useTabState';
import { Tab } from '@/contexts/TabContext';
import { cn } from '@/lib/utils';

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onClose: (id: string) => void;
  onClick: (id: string) => void;
}

const TabItem: React.FC<TabItemProps> = ({ tab, isActive, onClose, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getIcon = () => {
    switch (tab.type) {
      case 'chat':
        return MessageSquare;
      case 'agent':
        return Bot;
      case 'projects':
        return Folder;
      case 'usage':
        return BarChart;
      case 'mcp':
        return Server;
      case 'settings':
        return Settings;
      case 'claude-md':
      case 'claude-file':
        return FileText;
      case 'agent-execution':
        return Bot;
      case 'create-agent':
        return Plus;
      case 'import-agent':
        return Plus;
      default:
        return MessageSquare;
    }
  };

  const getStatusIcon = () => {
    switch (tab.status) {
      case 'running':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  const Icon = getIcon();
  const statusIcon = getStatusIcon();

  return (
    <Reorder.Item
      value={tab}
      id={tab.id}
      className={cn(
        "relative flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer select-none",
        "border-b-2 transition-all duration-200",
        isActive
          ? "border-blue-500 bg-background text-foreground"
          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
        "min-w-[120px] max-w-[200px]"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(tab.id)}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      
      <span className="flex-1 truncate">
        {tab.title}
      </span>

      {statusIcon && (
        <span className="flex-shrink-0">
          {statusIcon}
        </span>
      )}

      {tab.hasUnsavedChanges && (
        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
      )}

      <AnimatePresence>
        {(isHovered || isActive) && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
            className={cn(
              "flex-shrink-0 p-0.5 rounded hover:bg-muted-foreground/20",
              "transition-colors duration-150"
            )}
          >
            <X className="w-3 h-3" />
          </motion.button>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
};

interface TabManagerProps {
  className?: string;
}

export const TabManager: React.FC<TabManagerProps> = ({ className }) => {
  const {
    tabs,
    activeTabId,
    createChatTab,
    createProjectsTab,
    closeTab,
    switchToTab,
    canAddTab
  } = useTabState();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  // Listen for tab switch events
  useEffect(() => {
    const handleSwitchToTab = (event: CustomEvent) => {
      const { tabId } = event.detail;
      switchToTab(tabId);
    };

    window.addEventListener('switch-to-tab', handleSwitchToTab as EventListener);
    return () => {
      window.removeEventListener('switch-to-tab', handleSwitchToTab as EventListener);
    };
  }, [switchToTab]);

  // Listen for keyboard shortcut events
  useEffect(() => {
    const handleCreateTab = () => {
      createChatTab();
    };

    const handleCloseTab = async () => {
      if (activeTabId) {
        await closeTab(activeTabId);
      }
    };

    const handleNextTab = () => {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
      const nextIndex = (currentIndex + 1) % tabs.length;
      if (tabs[nextIndex]) {
        switchToTab(tabs[nextIndex].id);
      }
    };

    const handlePreviousTab = () => {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
      const previousIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      if (tabs[previousIndex]) {
        switchToTab(tabs[previousIndex].id);
      }
    };

    const handleTabByIndex = (event: CustomEvent) => {
      const { index } = event.detail;
      if (tabs[index]) {
        switchToTab(tabs[index].id);
      }
    };

    window.addEventListener('create-chat-tab', handleCreateTab);
    window.addEventListener('close-current-tab', handleCloseTab);
    window.addEventListener('switch-to-next-tab', handleNextTab);
    window.addEventListener('switch-to-previous-tab', handlePreviousTab);
    window.addEventListener('switch-to-tab-by-index', handleTabByIndex as EventListener);

    return () => {
      window.removeEventListener('create-chat-tab', handleCreateTab);
      window.removeEventListener('close-current-tab', handleCloseTab);
      window.removeEventListener('switch-to-next-tab', handleNextTab);
      window.removeEventListener('switch-to-previous-tab', handlePreviousTab);
      window.removeEventListener('switch-to-tab-by-index', handleTabByIndex as EventListener);
    };
  }, [tabs, activeTabId, createChatTab, closeTab, switchToTab]);

  // Check scroll buttons visibility
  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftScroll(scrollLeft > 0);
    setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 1);
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollButtons);
    window.addEventListener('resize', checkScrollButtons);

    return () => {
      container.removeEventListener('scroll', checkScrollButtons);
      window.removeEventListener('resize', checkScrollButtons);
    };
  }, [tabs]);

  const handleReorder = (newOrder: Tab[]) => {
    // This will be handled by the context when we implement reorderTabs
    console.log('Reorder tabs:', newOrder);
  };

  const handleCloseTab = async (id: string) => {
    await closeTab(id);
  };

  const handleNewTab = () => {
    if (canAddTab()) {
      createProjectsTab();
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    const newScrollLeft = direction === 'left'
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  return (
    <div className={cn("flex items-center bg-muted/30 border-b", className)}>
      {/* Left scroll button */}
      <AnimatePresence>
        {showLeftScroll && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => scrollTabs('left')}
            className="p-1 hover:bg-muted rounded-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M15 18l-6-6 6-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Tabs container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <Reorder.Group
          axis="x"
          values={tabs}
          onReorder={handleReorder}
          className="flex items-stretch"
        >
          <AnimatePresence initial={false}>
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onClose={handleCloseTab}
                onClick={switchToTab}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </div>

      {/* Right scroll button */}
      <AnimatePresence>
        {showRightScroll && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => scrollTabs('right')}
            className="p-1 hover:bg-muted rounded-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 18l6-6-6-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* New tab button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleNewTab}
        disabled={!canAddTab()}
        className={cn(
          "p-1.5 mx-2 rounded-sm transition-colors",
          canAddTab()
            ? "hover:bg-muted text-muted-foreground hover:text-foreground"
            : "opacity-50 cursor-not-allowed"
        )}
        title={canAddTab() ? "Browse projects" : "Maximum tabs reached"}
      >
        <Plus className="w-4 h-4" />
      </motion.button>
    </div>
  );
};

export default TabManager;