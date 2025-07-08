import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { claudeSyntaxTheme } from '@/lib/claudeSyntaxTheme';
import { lightSyntaxTheme } from '@/lib/lightSyntaxTheme';

/**
 * Hook that returns the appropriate syntax highlighting theme based on current theme
 */
export function useSyntaxTheme() {
  const { theme } = useTheme();
  
  return useMemo(() => {
    return theme === 'light' ? lightSyntaxTheme : claudeSyntaxTheme;
  }, [theme]);
} 