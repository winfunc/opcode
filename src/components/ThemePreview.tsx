import React from 'react';
import { useTheme, type Theme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';

interface ThemePreviewProps {
  themeId: Theme;
  name: string;
  className?: string;
}

export const ThemePreview: React.FC<ThemePreviewProps> = ({ 
  themeId, 
  name, 
  className 
}) => {
  const { theme: currentTheme } = useTheme();
  const isActive = currentTheme === themeId;

  return (
    <div 
      className={cn(
        "relative rounded-lg border-2 transition-all duration-200",
        isActive ? "border-primary shadow-md" : "border-border hover:border-border/80",
        className
      )}
    >
      {/* Theme preview content */}
      <div className={`theme-${themeId} p-4 rounded-lg`}>
        <div className="space-y-3">
          {/* Background and surface colors */}
          <div className="flex gap-2">
            <div 
              className="w-8 h-8 rounded border border-border"
              style={{ backgroundColor: 'var(--color-background)' }}
              title="Background"
            />
            <div 
              className="w-8 h-8 rounded border border-border"
              style={{ backgroundColor: 'var(--color-card)' }}
              title="Card"
            />
            <div 
              className="w-8 h-8 rounded border border-border"
              style={{ backgroundColor: 'var(--color-muted)' }}
              title="Muted"
            />
          </div>
          
          {/* Text sample */}
          <div className="space-y-1">
            <div 
              className="text-sm font-medium"
              style={{ color: 'var(--color-foreground)' }}
            >
              {name}
            </div>
            <div 
              className="text-xs"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              Preview text
            </div>
          </div>
          
          {/* Accent color */}
          <div 
            className="w-full h-2 rounded"
            style={{ backgroundColor: 'var(--color-primary)' }}
          />
        </div>
      </div>
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full border-2 border-background" />
      )}
    </div>
  );
};
