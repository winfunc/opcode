import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/** Font size options for global UI scaling */
export type FontSize = 'small' | 'default' | 'medium' | 'large' | 'extra-large' | 'huge' | 'massive' | 'giant';

/** Panel width options for main content area */
export type PanelWidth = 'compact' | 'comfortable' | 'spacious' | 'wide' | 'wider' | 'widest' | 'ultra-wide' | 'ultra-wide-plus' | 'full';

/** Supported keyboard layouts for input translation */
export type KeyboardLayout = 'qwerty' | 'colemak' | 'dvorak' | 'workman';

/** User preferences for appearance customization */
export interface Preferences {
  /** Global font size setting */
  fontSize: FontSize;
  /** Main panel width setting */
  panelWidth: PanelWidth;
  /** Keyboard layout for input translation */
  keyboardLayout: KeyboardLayout;
}

/** Context interface for preferences management */
interface PreferencesContextType {
  /** Current user preferences */
  preferences: Preferences;
  /** Update font size preference */
  updateFontSize: (fontSize: FontSize) => void;
  /** Update panel width preference */
  updatePanelWidth: (panelWidth: PanelWidth) => void;
  /** Update keyboard layout preference */
  updateKeyboardLayout: (layout: KeyboardLayout) => void;
}

const defaultPreferences: Preferences = {
  fontSize: 'default',
  panelWidth: 'ultra-wide', // Changed to 1920px default
  keyboardLayout: 'qwerty'
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

/**
 * Preferences provider component that manages user appearance settings
 * Handles font size, panel width, and keyboard layout preferences with localStorage persistence
 */
export const PreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);

  // Font size mapping
  const fontSizeMap: Record<FontSize, string> = {
    'small': '0.75',     // 12px
    'default': '0.875',  // 14px
    'medium': '1',       // 16px
    'large': '1.125',    // 18px
    'extra-large': '1.25', // 20px
    'huge': '1.5',       // 24px
    'massive': '1.75',   // 28px
    'giant': '2'         // 32px
  };

  // Panel width mapping
  const panelWidthMap: Record<PanelWidth, string> = {
    'compact': '768px',      // sm
    'comfortable': '1024px', // lg
    'spacious': '1280px',    // xl
    'wide': '1440px',        // custom
    'wider': '1600px',       // custom
    'widest': '1760px',      // custom
    'ultra-wide': '1920px',  // custom (default)
    'ultra-wide-plus': '2560px', // custom
    'full': '100%'           // full width
  };

  // Apply CSS custom properties when preferences change
  useEffect(() => {
    const root = document.documentElement;
    const scale = fontSizeMap[preferences.fontSize];
    
    // Set font scale variable
    root.style.setProperty('--font-scale', scale);
    
    // Set individual font size variables based on scale
    const baseSizes = {
      xs: 0.75,   // 12px at default scale
      sm: 0.875,  // 14px at default scale
      base: 1,    // 16px at default scale
      lg: 1.125,  // 18px at default scale
      xl: 1.25,   // 20px at default scale
      '2xl': 1.5, // 24px at default scale
      '3xl': 1.875, // 30px at default scale
      '4xl': 2.25   // 36px at default scale
    };

    Object.entries(baseSizes).forEach(([size, baseValue]) => {
      const scaledValue = baseValue * parseFloat(scale);
      root.style.setProperty(`--font-size-${size}`, `${scaledValue}rem`);
    });

    // Set panel width variable
    root.style.setProperty('--panel-max-width', panelWidthMap[preferences.panelWidth]);
    
    // Add data attribute for panel width (for CSS selectors)
    root.setAttribute('data-panel-width', preferences.panelWidth);
  }, [preferences, fontSizeMap, panelWidthMap]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('claudia-preferences');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
      } catch (error) {
        console.error('Failed to parse stored preferences:', error);
      }
    }
  }, []);

  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('claudia-preferences', JSON.stringify(preferences));
  }, [preferences]);

  const updateFontSize = (fontSize: FontSize) => {
    setPreferences(prev => ({ ...prev, fontSize }));
  };

  const updatePanelWidth = (panelWidth: PanelWidth) => {
    setPreferences(prev => ({ ...prev, panelWidth }));
  };

  const updateKeyboardLayout = (keyboardLayout: KeyboardLayout) => {
    setPreferences(prev => ({ ...prev, keyboardLayout }));
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        updateFontSize,
        updatePanelWidth,
        updateKeyboardLayout
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

/**
 * Hook to access preferences context
 * @returns Preferences context with current settings and update functions
 * @throws Error if used outside PreferencesProvider
 */
export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};