import React, { useState } from 'react';
import { Settings, Users, Menu, Minus, Square, X, Bot, BarChart3, FileText, Network, Info, Folder } from 'lucide-react';
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
      className="h-11 bg-background flex items-center justify-between select-none"
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

      {/* Right side - Navigation icons */}
      <div className="flex items-center space-x-1 pr-5">
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
        
        {onClaudeClick && (
          <button
            onClick={onClaudeClick}
            className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            title="CLAUDE.md"
          >
            <FileText size={16} />
          </button>
        )}
        
        {onMCPClick && (
          <button
            onClick={onMCPClick}
            className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            title="MCP"
          >
            <Network size={16} />
          </button>
        )}
        
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        )}
        
        {onInfoClick && (
          <button
            onClick={onInfoClick}
            className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            title="About"
          >
            <Info size={16} />
          </button>
        )}
      </div>
    </div>
  );
};