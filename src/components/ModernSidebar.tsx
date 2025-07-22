import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  FileText, 
  FolderOpen, 
  Settings, 
  Bot, 
  BarChart3, 
  Network,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Home,
  Terminal
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useTabState } from '@/hooks/useTabState';

interface ModernSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  width: number;
  onWidthChange: (width: number) => void;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  badge?: number;
  shortcut?: string;
}

/**
 * Modern sidebar component inspired by Cursor's design
 * Features:
 * - Collapsible navigation
 * - File tree view
 * - Quick access buttons
 * - Resizable width
 * - Search functionality
 */
export const ModernSidebar: React.FC<ModernSidebarProps> = ({
  collapsed,
  onCollapsedChange,
  width,
  onWidthChange
}) => {
  const { 
    createProjectsTab, 
    createSettingsTab, 
    createUsageTab, 
    createMCPTab,
    createChatTab 
  } = useTabState();
  
  const [activeSection, setActiveSection] = useState<'explorer' | 'search' | 'extensions'>('explorer');
  const [searchQuery, setSearchQuery] = useState('');
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  // Main navigation items
  const mainItems: SidebarItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      onClick: () => createChatTab(),
      shortcut: '⌘T'
    },
    {
      id: 'explorer',
      label: 'Explorer',
      icon: FolderOpen,
      onClick: () => createProjectsTab(),
      shortcut: '⌘E'
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      onClick: () => setActiveSection('search'),
      shortcut: '⌘F'
    },
    {
      id: 'terminal',
      label: 'Terminal',
      icon: Terminal,
      onClick: () => createChatTab(),
      shortcut: '⌘`'
    }
  ];

  const bottomItems: SidebarItem[] = [
    {
      id: 'agents',
      label: 'AI Agents',
      icon: Bot,
      onClick: () => createChatTab(),
      shortcut: '⌘A'
    },
    {
      id: 'usage',
      label: 'Usage',
      icon: BarChart3,
      onClick: () => createUsageTab(),
      shortcut: '⌘U'
    },
    {
      id: 'mcp',
      label: 'MCP',
      icon: Network,
      onClick: () => createMCPTab(),
      shortcut: '⌘M'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      onClick: () => createSettingsTab(),
      shortcut: '⌘,'
    }
  ];

  // Handle sidebar resizing
  useEffect(() => {
    let isResizing = false;

    const handleMouseDown = (e: MouseEvent) => {
      if (collapsed) return;
      isResizing = true;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(240, Math.min(500, e.clientX));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    const resizer = resizerRef.current;
    if (resizer) {
      resizer.addEventListener('mousedown', handleMouseDown);
      return () => {
        resizer.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [collapsed, onWidthChange]);

  const SidebarButton: React.FC<{ item: SidebarItem; isActive?: boolean }> = ({ 
    item, 
    isActive = false 
  }) => (
    <Button
      variant="ghost"
      size={collapsed ? "icon" : "sm"}
      onClick={item.onClick}
      className={cn(
        "w-full justify-start h-9 px-2",
        collapsed ? "justify-center px-0" : "justify-start",
        isActive && "bg-accent text-accent-foreground",
        "hover:bg-accent/80 transition-colors"
      )}
      title={collapsed ? `${item.label} (${item.shortcut})` : undefined}
    >
      <item.icon className={cn("h-4 w-4", !collapsed && "mr-2")} />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{item.label}</span>
          {item.badge && (
            <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Button>
  );

  return (
    <>
      <div
        ref={sidebarRef}
        className={cn(
          "bg-muted/30 border-r border-border flex flex-col",
          "transition-all duration-200 ease-in-out",
          collapsed ? "w-12" : "min-w-0"
        )}
        style={{ width: collapsed ? 48 : width }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-border/50">
          {!collapsed && (
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
                <span className="text-primary-foreground text-xs font-bold">C</span>
              </div>
              <span className="font-semibold text-sm truncate">Claude Code</span>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCollapsedChange(!collapsed)}
            className="h-6 w-6 hover:bg-accent"
          >
            {collapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </Button>
        </div>

        {/* Search Bar */}
        {!collapsed && (
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-7 text-xs bg-background/50"
              />
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <div className="flex-1 flex flex-col px-2 py-1">
          {/* Primary items */}
          <div className="space-y-1 mb-4">
            {mainItems.map((item) => (
              <SidebarButton 
                key={item.id} 
                item={item}
                isActive={item.id === activeSection}
              />
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 min-h-0">
            {!collapsed && (
              <div className="h-full">
                {activeSection === 'explorer' && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2">
                      Projects
                    </div>
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => createProjectsTab()}
                        className="w-full justify-start h-8 px-2 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-2" />
                        New Project
                      </Button>
                      {/* Project list would go here */}
                    </div>
                  </div>
                )}
                
                {activeSection === 'search' && (
                  <div className="text-xs text-muted-foreground p-2">
                    Search functionality coming soon...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Navigation */}
          <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
            {bottomItems.map((item) => (
              <SidebarButton key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      {!collapsed && (
        <div
          ref={resizerRef}
          className="w-1 bg-border/30 hover:bg-border cursor-col-resize transition-colors"
          title="Drag to resize"
        />
      )}
    </>
  );
};