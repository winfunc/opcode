import React from 'react';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/lib/theme-context';
import { Palette, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2 text-base font-medium">
        <Palette className="h-5 w-5" />
        Color Theme
      </Label>
      
      {/* Elegant Theme Cards */}
      <div className="grid grid-cols-3 gap-4">
        {themes.map((themeOption) => (
          <button
            key={themeOption.id}
            onClick={() => setTheme(themeOption.id)}
            className={cn(
              "relative group rounded-xl border-2 transition-all duration-300 overflow-hidden",
              "hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              theme === themeOption.id 
                ? "border-primary shadow-lg" 
                : "border-border hover:border-primary/50"
            )}
          >
            {/* Theme Preview */}
            <div className={`theme-${themeOption.id} p-4 space-y-3`}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                />
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: 'var(--color-muted)' }}
                />
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                />
              </div>
              
              {/* Content Preview */}
              <div 
                className="h-8 rounded"
                style={{ backgroundColor: 'var(--color-card)' }}
              >
                <div 
                  className="h-2 w-3/4 rounded mt-2 ml-2"
                  style={{ backgroundColor: 'var(--color-muted)' }}
                />
              </div>
              
              <div 
                className="h-6 rounded"
                style={{ backgroundColor: 'var(--color-card)' }}
              >
                <div 
                  className="h-2 w-1/2 rounded mt-1 ml-2"
                  style={{ backgroundColor: 'var(--color-muted)' }}
                />
              </div>
              
              {/* Theme Name */}
              <div className="text-center pt-2">
                <div 
                  className="font-medium text-sm"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  {themeOption.name}
                </div>
                <div 
                  className="text-xs opacity-75"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  {themeOption.description}
                </div>
              </div>
            </div>
            
            {/* Active Indicator */}
            {theme === themeOption.id && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
            
            {/* Hover Effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
        ))}
      </div>
      
      <p className="text-sm text-muted-foreground">
        Choose your preferred color scheme for the interface
      </p>
    </div>
  );
};
