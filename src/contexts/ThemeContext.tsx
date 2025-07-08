import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  // 加载保存的主题偏好
  useEffect(() => {
    loadTheme();
  }, []);

  // 应用主题到DOM
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const loadTheme = async () => {
    try {
      // 首先尝试从Claude设置中读取主题偏好
      const settings = await api.getClaudeSettings();
      const savedTheme = settings.uiTheme as ThemeMode;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeState(savedTheme);
        return;
      }
    } catch (error) {
      console.warn('Failed to load theme from settings:', error);
    }

    // 回退到localStorage
    try {
      const savedTheme = localStorage.getItem('claudia-theme') as ThemeMode;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeState(savedTheme);
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    }
  };

  const saveTheme = async (newTheme: ThemeMode) => {
    try {
      // 保存到Claude设置
      const settings = await api.getClaudeSettings();
      settings.uiTheme = newTheme;
      await api.saveClaudeSettings(settings);
    } catch (error) {
      console.warn('Failed to save theme to settings:', error);
      // 回退到localStorage
      try {
        localStorage.setItem('claudia-theme', newTheme);
      } catch (localError) {
        console.warn('Failed to save theme to localStorage:', localError);
      }
    }
  };

  const applyTheme = (newTheme: ThemeMode) => {
    const root = document.documentElement;
    
    if (newTheme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    saveTheme(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 