export type Theme = 'dark' | 'light';

export const themes = {
  dark: {
    // Main backgrounds - sophisticated dark with subtle blue undertones
    background: 'oklch(0.11 0.015 240)',
    foreground: 'oklch(0.95 0.008 240)',
    card: 'oklch(0.13 0.012 240)',
    cardForeground: 'oklch(0.95 0.008 240)',
    popover: 'oklch(0.11 0.015 240)',
    popoverForeground: 'oklch(0.95 0.008 240)',
    
    // Primary - elegant purple-blue for interactive elements
    primary: 'oklch(0.65 0.15 260)',
    primaryForeground: 'oklch(0.98 0.005 240)',
    
    // Secondary - warm slate for secondary actions
    secondary: 'oklch(0.18 0.008 240)',
    secondaryForeground: 'oklch(0.88 0.008 240)',
    
    // Muted - subtle variations for hierarchy
    muted: 'oklch(0.15 0.008 240)',
    mutedForeground: 'oklch(0.65 0.008 240)',
    
    // Accent - vibrant blue for highlights
    accent: 'oklch(0.55 0.18 240)',
    accentForeground: 'oklch(0.98 0.005 240)',
    
    // Status colors
    destructive: 'oklch(0.62 0.22 25)',
    destructiveForeground: 'oklch(0.98 0.005 240)',
    
    // Borders and inputs - subtle but defined
    border: 'oklch(0.20 0.008 240)',
    input: 'oklch(0.16 0.008 240)',
    ring: 'oklch(0.60 0.12 260)',
    
    // Success colors
    green500: 'oklch(0.72 0.20 142)',
    green600: 'oklch(0.64 0.22 142)',
  },
  light: {
    // Main backgrounds - clean whites with subtle warmth
    background: 'oklch(0.99 0.005 240)',
    foreground: 'oklch(0.15 0.008 240)',
    card: 'oklch(0.97 0.005 240)',
    cardForeground: 'oklch(0.15 0.008 240)',
    popover: 'oklch(0.99 0.005 240)',
    popoverForeground: 'oklch(0.15 0.008 240)',
    
    // Primary - deep professional blue
    primary: 'oklch(0.45 0.15 240)',
    primaryForeground: 'oklch(0.98 0.005 240)',
    
    // Secondary - soft blue-gray
    secondary: 'oklch(0.92 0.008 240)',
    secondaryForeground: 'oklch(0.20 0.008 240)',
    
    // Muted - professional gray tones
    muted: 'oklch(0.94 0.005 240)',
    mutedForeground: 'oklch(0.50 0.008 240)',
    
    // Accent - vibrant blue for highlights
    accent: 'oklch(0.55 0.18 240)',
    accentForeground: 'oklch(0.98 0.005 240)',
    
    // Status colors
    destructive: 'oklch(0.58 0.22 25)',
    destructiveForeground: 'oklch(0.98 0.005 240)',
    
    // Borders and inputs - clean and defined
    border: 'oklch(0.85 0.008 240)',
    input: 'oklch(0.90 0.008 240)',
    ring: 'oklch(0.50 0.12 240)',
    
    // Success colors
    green500: 'oklch(0.65 0.20 142)',
    green600: 'oklch(0.58 0.22 142)',
  },
} as const;

export const DEFAULT_THEME: Theme = 'dark';
export const THEME_STORAGE_KEY = 'claudia-theme';

export function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches 
    ? 'dark' 
    : 'light';
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  
  return getSystemTheme();
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  const body = document.body;
  const themeColors = themes[theme];
  
  // Apply CSS variables
  Object.entries(themeColors).forEach(([key, value]) => {
    const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssVar, value);
  });
  
  // Set data attribute for conditional styling
  root.setAttribute('data-theme', theme);
  body.setAttribute('data-theme', theme);
  
  // Add transition class for smooth theme changes
  if (!body.classList.contains('theme-transitioning')) {
    body.classList.add('theme-transitioning');
    setTimeout(() => body.classList.remove('theme-transitioning'), 300);
  }
}