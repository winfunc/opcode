// Theme management utilities

export type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'claudia-theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(THEME_KEY) as Theme) || 'system';
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
}

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function getActiveTheme(storedTheme: Theme): 'light' | 'dark' {
  if (storedTheme === 'system') {
    return getSystemTheme();
  }
  return storedTheme;
}

export function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;
  
  // Add transitioning class to prevent flashing
  document.documentElement.classList.add('theme-transitioning');
  
  // Apply theme
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  
  // Remove transitioning class after a brief delay
  setTimeout(() => {
    document.documentElement.classList.remove('theme-transitioning');
  }, 50);
}

export function initializeTheme(): void {
  const storedTheme = getStoredTheme();
  const activeTheme = getActiveTheme(storedTheme);
  applyTheme(activeTheme);
  
  // Listen for system theme changes if using system theme
  if (storedTheme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    mediaQuery.addEventListener('change', (e) => {
      const newTheme = e.matches ? 'light' : 'dark';
      applyTheme(newTheme);
    });
  }
}