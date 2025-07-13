import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  Theme, 
  DEFAULT_THEME, 
  getStoredTheme, 
  setStoredTheme, 
  applyTheme 
} from '@/lib/theme';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme from storage
  useEffect(() => {
    const storedTheme = getStoredTheme();
    setThemeState(storedTheme);
    applyTheme(storedTheme);
    
    // Ensure body has the correct theme class immediately
    document.body.setAttribute('data-theme', storedTheme);
    
    setIsInitialized(true);
  }, []);

  // Apply theme changes
  useEffect(() => {
    if (isInitialized) {
      applyTheme(theme);
      setStoredTheme(theme);
    }
  }, [theme, isInitialized]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (event: MediaQueryListEvent) => {
      // Only auto-switch if no theme is explicitly stored
      const stored = localStorage.getItem('claudia-theme');
      if (!stored) {
        const systemTheme = event.matches ? 'dark' : 'light';
        setThemeState(systemTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply theme to document root for immediate effect
  useEffect(() => {
    if (isInitialized) {
      const root = document.documentElement;
      root.setAttribute('data-theme', theme);
    }
  }, [theme, isInitialized]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  const value: ThemeContextType = {
    theme,
    setTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {/* Prevent flash of unstyled content */}
      {isInitialized ? children : <div className="h-screen bg-background" />}
    </ThemeContext.Provider>
  );
}