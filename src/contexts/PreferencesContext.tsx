import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type FontSize = 'small' | 'default' | 'medium' | 'large' | 'extra-large' | 'huge' | 'massive' | 'giant';
export type PanelWidth = 'compact' | 'comfortable' | 'spacious' | 'wide' | 'wider' | 'widest' | 'ultra-wide' | 'full';
export type KeyboardLayout = 'qwerty' | 'colemak' | 'dvorak' | 'workman';

export interface Preferences {
  fontSize: FontSize;
  panelWidth: PanelWidth;
  keyboardLayout: KeyboardLayout;
}

interface PreferencesContextType {
  preferences: Preferences;
  updateFontSize: (fontSize: FontSize) => void;
  updatePanelWidth: (panelWidth: PanelWidth) => void;
  updateKeyboardLayout: (layout: KeyboardLayout) => void;
}

const defaultPreferences: Preferences = {
  fontSize: 'default',
  panelWidth: 'spacious',
  keyboardLayout: 'qwerty'
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

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
    'spacious': '1280px',    // xl (default)
    'wide': '1440px',        // custom
    'wider': '1600px',       // custom
    'widest': '1760px',      // custom
    'ultra-wide': '1920px',  // custom
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

export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};