import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemeToggleProps {
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
}

export function ThemeToggle({ size = 'default', variant = 'ghost' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className="relative overflow-hidden transition-all duration-200 hover:bg-accent/50"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <div className="relative">
        {theme === 'dark' ? (
          <Sun className="h-4 w-4 transition-all duration-300 rotate-0 scale-100 text-yellow-500" />
        ) : (
          <Moon className="h-4 w-4 transition-all duration-300 rotate-0 scale-100 text-blue-400" />
        )}
      </div>
    </Button>
  );
}