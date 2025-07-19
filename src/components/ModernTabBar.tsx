import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  X, 
  Plus, 
  MessageSquare, 
  Bot, 
  Folder, 
  BarChart, 
  Server, 
  Settings, 
  FileText,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { useTabState } from '@/hooks/useTabState';
import { Tab } from '@/contexts/TabContext';
import { Button } from './ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
      default:
        return MessageSquare;
    }
  };

  const Icon = getIcon();

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none",
        "border-b-2 transition-all duration-150 ease-out",
        "min-w-[120px] max-w-[200px] hover:bg-accent/50",
        isActive
          ? "border-primary bg-background text-foreground shadow-sm"
          : "border-transparent bg-transparent text-muted-foreground hover:text-foreground"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(tab.id)}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      
      <span className="flex-1 truncate font-medium">
        {tab.title}
      </span>

      {tab.hasUnsavedChanges && (
        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
      )}

      {/* Close button - only show on hover or if active */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        className={cn(
          "flex-shrink-0 p-0.5 rounded-sm hover:bg-muted-foreground/20",
          "transition-all duration-150 opacity-0 scale-75",
          (isHovered || isActive) && "opacity-100 scale-100"
        )}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

/**
 * Modern tab bar component inspired by Cursor's clean design
 * Features:
 * - Horizontal scrolling for many tabs
 * - Clean hover effects
 * - Tab overflow handling
 * - Keyboard shortcuts support
 */
export const ModernTabBar: React.FC = () => {
  const {
    tabs,
    activeTabId,
    createChatTab,
    closeTab,
    switchToTab,
    canAddTab
  } = useTabState();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showTabMenu, setShowTabMenu] = useState(false);

  // Check scroll buttons visibility
  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => checkScrollButtons();
    const handleResize = () => checkScrollButtons();

    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [tabs]);

  // Scroll active tab into view
  useEffect(() => {
    if (!activeTabId) return;
    
    const container = scrollContainerRef.current;
    const activeTab = container?.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement;
    
    if (container && activeTab) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      
      if (tabRect.right > containerRect.right || tabRect.left < containerRect.left) {
        activeTab.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTabId]);

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

  const handleCloseTab = async (id: string) => {
    await closeTab(id);
  };

  const handleNewTab = () => {
    if (canAddTab()) {
      createChatTab();
    }
  };

  // Show overflow tabs in dropdown
  const visibleTabs = tabs;
  const overflowTabs = tabs.length > 8 ? tabs.slice(8) : [];

  return (
    <div className="flex items-center bg-background border-b border-border/50">
      {/* Left scroll button */}
      {canScrollLeft && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => scrollTabs('left')}
          className="h-8 w-8 flex-shrink-0 rounded-none border-r"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      )}

      {/* Tabs container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex items-stretch min-w-full">
          {visibleTabs.map((tab) => (
            <div key={tab.id} data-tab-id={tab.id}>
              <TabItem
                tab={tab}
                isActive={tab.id === activeTabId}
                onClose={handleCloseTab}
                onClick={switchToTab}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Right scroll button */}
      {canScrollRight && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => scrollTabs('right')}
          className="h-8 w-8 flex-shrink-0 rounded-none border-l"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}

      {/* Tab overflow menu */}
      {overflowTabs.length > 0 && (
        <DropdownMenu open={showTabMenu} onOpenChange={setShowTabMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 rounded-none border-l"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {overflowTabs.map((tab) => {
              const Icon = tab.type === 'chat' ? MessageSquare : FileText;
              return (
                <DropdownMenuItem
                  key={tab.id}
                  onClick={() => switchToTab(tab.id)}
                  className="flex items-center gap-2"
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 truncate">{tab.title}</span>
                  {tab.hasUnsavedChanges && (
                    <div className="w-2 h-2 bg-primary rounded-full" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* New tab button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNewTab}
        disabled={!canAddTab()}
        className={cn(
          "h-8 w-8 flex-shrink-0 rounded-none border-l",
          "hover:bg-accent transition-colors",
          !canAddTab() && "opacity-50 cursor-not-allowed"
        )}
        title={canAddTab() ? "New chat (⌘T)" : "Maximum tabs reached"}
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
};