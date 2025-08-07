import React, { useState, useRef, useEffect } from 'react';
import { Settings, Users, Menu, Minus, Square, X, Bot, BarChart3, FileText, Network, Info, Folder, MoreVertical, ChevronDown } from 'lucide-react';
import { useThemeContext } from '@/contexts/ThemeContext';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface CustomTitlebarProps {
  title?: string;
  onSettingsClick?: () => void;
  onAgentsClick?: () => void;
  onUsageClick?: () => void;
  onClaudeClick?: () => void;
  onMCPClick?: () => void;
  onInfoClick?: () => void;
  onProjectsClick?: () => void;
  onMenuClick?: () => void;
}

export const CustomTitlebar: React.FC<CustomTitlebarProps> = ({
  title = "Claudia",
  onSettingsClick,
  onAgentsClick,
  onUsageClick,
  onClaudeClick,
  onMCPClick,
  onInfoClick,
  onProjectsClick,
  onMenuClick
}) => {
  const { theme } = useThemeContext();
  const [isHovered, setIsHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMinimize = async () => {
    try {
      const window = getCurrentWindow();
      await window.minimize();
      console.log('Window minimized successfully');
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      const window = getCurrentWindow();
      const isMaximized = await window.isMaximized();
      if (isMaximized) {
        await window.unmaximize();
        console.log('Window unmaximized successfully');
      } else {
        await window.maximize();
        console.log('Window maximized successfully');
      }
    } catch (error) {
      console.error('Failed to maximize/unmaximize window:', error);
    }
  };

  const handleClose = async () => {
    try {
      const window = getCurrentWindow();
      await window.close();
      console.log('Window closed successfully');
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  };

  return (
    <div 
      className="h-11 bg-background flex items-center justify-between select-none border-b border-border/50"
      style={{ borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}
      data-tauri-drag-region
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left side - macOS Traffic Light buttons */}
      <div className="flex items-center space-x-2 pl-5">
        <div className="flex items-center space-x-2">
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="group relative w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-200 flex items-center justify-center z-10"
            title="Close"
          >
            {isHovered && (
              <X size={8} className="text-red-900 opacity-60 group-hover:opacity-100" />
            )}
          </button>

          {/* Minimize button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMinimize();
            }}
            className="group relative w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-all duration-200 flex items-center justify-center z-10"
            title="Minimize"
          >
            {isHovered && (
              <Minus size={8} className="text-yellow-900 opacity-60 group-hover:opacity-100" />
            )}
          </button>

          {/* Maximize button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMaximize();
            }}
            className="group relative w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-all duration-200 flex items-center justify-center z-10"
            title="Maximize"
          >
            {isHovered && (
              <Square size={6} className="text-green-900 opacity-60 group-hover:opacity-100" />
            )}
          </button>
        </div>
      </div>

      {/* Center - Title (hidden) */}
      {/* <div 
        className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        data-tauri-drag-region
      >
        <span className="text-sm font-medium text-foreground/80">{title}</span>
      </div> */}

      {/* Right side - Navigation icons with improved spacing */}
      <div className="flex items-center pr-5 gap-3">
        {/* Primary actions group */}
        <div className="flex items-center gap-1">
          {onProjectsClick && (
            <button
              onClick={onProjectsClick}
              className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Projects"
            >
              <Folder size={16} />
            </button>
          )}
          
          {onAgentsClick && (
            <button
              onClick={onAgentsClick}
              className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Agents"
            >
              <Bot size={16} />
            </button>
          )}
          
          {onUsageClick && (
            <button
              onClick={onUsageClick}
              className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Usage Dashboard"
            >
              <BarChart3 size={16} />
            </button>
          )}
        </div>

        {/* Visual separator */}
        <div className="w-px h-5 bg-border/50" />

        {/* Secondary actions group */}
        <div className="flex items-center gap-1">
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          )}

          {/* Dropdown menu for additional options */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-1"
              title="More options"
            >
              <MoreVertical size={16} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg z-50">
                <div className="py-1">
                  {onClaudeClick && (
                    <button
                      onClick={() => {
                        onClaudeClick();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-3"
                    >
                      <FileText size={14} />
                      <span>CLAUDE.md</span>
                    </button>
                  )}
                  
                  {onMCPClick && (
                    <button
                      onClick={() => {
                        onMCPClick();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-3"
                    >
                      <Network size={14} />
                      <span>MCP Servers</span>
                    </button>
                  )}
                  
                  {onInfoClick && (
                    <button
                      onClick={() => {
                        onInfoClick();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-3"
                    >
                      <Info size={14} />
                      <span>About</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};