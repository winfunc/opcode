import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { api } from '../lib/api';

export type ThemeMode = 'dark' | 'gray' | 'light' | 'custom';

export interface CustomThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
}

interface ThemeContextType {
  theme: ThemeMode;
  customColors: CustomThemeColors;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setCustomColors: (colors: Partial<CustomThemeColors>) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'theme_preference';
const CUSTOM_COLORS_STORAGE_KEY = 'theme_custom_colors';

// Default custom theme colors (based on current dark theme)
const DEFAULT_CUSTOM_COLORS: CustomThemeColors = {
  background: 'oklch(0.12 0.01 240)',
  foreground: 'oklch(0.98 0.01 240)',
  card: 'oklch(0.14 0.01 240)',
  cardForeground: 'oklch(0.98 0.01 240)',
  primary: 'oklch(0.98 0.01 240)',
  primaryForeground: 'oklch(0.12 0.01 240)',
  secondary: 'oklch(0.16 0.01 240)',
  secondaryForeground: 'oklch(0.98 0.01 240)',
  muted: 'oklch(0.16 0.01 240)',
  mutedForeground: 'oklch(0.65 0.01 240)',
  accent: 'oklch(0.16 0.01 240)',
  accentForeground: 'oklch(0.98 0.01 240)',
  destructive: 'oklch(0.6 0.2 25)',
  destructiveForeground: 'oklch(0.98 0.01 240)',
  border: 'oklch(0.16 0.01 240)',
  input: 'oklch(0.16 0.01 240)',
  ring: 'oklch(0.98 0.01 240)',
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [customColors, setCustomColorsState] = useState<CustomThemeColors>(DEFAULT_CUSTOM_COLORS);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme preference and custom colors from storage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Load theme preference
        const savedTheme = await api.getSetting(THEME_STORAGE_KEY);
        
        if (savedTheme) {
          const themeMode = savedTheme as ThemeMode;
          setThemeState(themeMode);
          applyTheme(themeMode, customColors);
        }

        // Load custom colors
        const savedColors = await api.getSetting(CUSTOM_COLORS_STORAGE_KEY);
        
        if (savedColors) {
          const colors = JSON.parse(savedColors) as CustomThemeColors;
          setCustomColorsState(colors);
          if (theme === 'custom') {
            applyTheme('custom', colors);
          }
        }
      } catch (error) {
        console.error('Failed to load theme settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Apply theme to document
  const applyTheme = useCallback((themeMode: ThemeMode, colors: CustomThemeColors) => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('theme-dark', 'theme-gray', 'theme-light', 'theme-custom');
    
    // Add new theme class
    root.classList.add(`theme-${themeMode}`);
    
    // If custom theme, apply custom colors as CSS variables
    if (themeMode === 'custom') {
      Object.entries(colors).forEach(([key, value]) => {
        const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.setProperty(cssVarName, value);
      });
    } else {
      // Clear custom CSS variables when not using custom theme
      Object.keys(colors).forEach((key) => {
        const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.removeProperty(cssVarName);
      });
    }
  }, []);

  const setTheme = useCallback(async (newTheme: ThemeMode) => {
    try {
      setIsLoading(true);
      
      // Apply theme immediately
      setThemeState(newTheme);
      applyTheme(newTheme, customColors);
      
      // Save to storage
      await api.saveSetting(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  }, [customColors, applyTheme]);

  const setCustomColors = useCallback(async (colors: Partial<CustomThemeColors>) => {
    try {
      setIsLoading(true);
      
      const newColors = { ...customColors, ...colors };
      setCustomColorsState(newColors);
      
      // Apply immediately if custom theme is active
      if (theme === 'custom') {
        applyTheme('custom', newColors);
      }
      
      // Save to storage
      await api.saveSetting(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(newColors));
    } catch (error) {
      console.error('Failed to save custom colors:', error);
    } finally {
      setIsLoading(false);
    }
  }, [theme, customColors, applyTheme]);

  const value: ThemeContextType = {
    theme,
    customColors,
    setTheme,
    setCustomColors,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};