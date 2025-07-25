/**
 * Font scaling utility for high-resolution displays and accessibility
 * 
 * Provides functionality to adjust font sizes throughout the application
 * for better readability on high-DPI displays or for users who need larger text.
 */

export type FontScale = 'small' | 'normal' | 'large' | 'extra-large' | 'custom';

export interface FontScaleConfig {
  scale: FontScale;
  multiplier: number;
}

/**
 * Font scale configurations with their corresponding multipliers
 */
export const FONT_SCALE_OPTIONS: Record<FontScale, FontScaleConfig> = {
  'small': { scale: 'small', multiplier: 0.875 },
  'normal': { scale: 'normal', multiplier: 1.0 },
  'large': { scale: 'large', multiplier: 1.125 },
  'extra-large': { scale: 'extra-large', multiplier: 1.25 },
  'custom': { scale: 'custom', multiplier: 1.0 } // Default, will be overridden
};

const FONT_SCALE_STORAGE_KEY = 'claudia-font-scale';
const CUSTOM_FONT_SCALE_STORAGE_KEY = 'claudia-custom-font-scale';

/**
 * Font scale manager class
 */
class FontScaleManager {
  private currentScale: FontScale = 'normal';
  private customMultiplier: number = 1.0;
  private listeners: Set<(scale: FontScale, multiplier?: number) => void> = new Set();

  constructor() {
    this.loadFromStorage();
    this.applyScale();
  }

  /**
   * Get the current font scale
   */
  getCurrentScale(): FontScale {
    return this.currentScale;
  }

  /**
   * Get the current scale multiplier
   */
  getCurrentMultiplier(): number {
    if (this.currentScale === 'custom') {
      return this.customMultiplier;
    }
    return FONT_SCALE_OPTIONS[this.currentScale].multiplier;
  }

  /**
   * Get the current custom multiplier
   */
  getCustomMultiplier(): number {
    return this.customMultiplier;
  }

  /**
   * Set a new font scale
   */
  setScale(scale: FontScale, customMultiplier?: number): void {
    if (scale === 'custom' && customMultiplier !== undefined) {
      this.customMultiplier = Math.max(0.5, Math.min(3.0, customMultiplier)); // Clamp between 0.5x and 3.0x
    }
    
    if (this.currentScale === scale && (scale !== 'custom' || customMultiplier === undefined)) return;
    
    this.currentScale = scale;
    this.saveToStorage();
    this.applyScale();
    this.notifyListeners();
  }

  /**
   * Set custom multiplier and switch to custom scale
   */
  setCustomMultiplier(multiplier: number): void {
    this.setScale('custom', multiplier);
  }

  /**
   * Subscribe to font scale changes
   */
  subscribe(listener: (scale: FontScale, multiplier?: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Load font scale from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
      if (stored && stored in FONT_SCALE_OPTIONS) {
        this.currentScale = stored as FontScale;
      }
      
      // Load custom multiplier if using custom scale
      if (this.currentScale === 'custom') {
        const customStored = localStorage.getItem(CUSTOM_FONT_SCALE_STORAGE_KEY);
        if (customStored) {
          const customValue = parseFloat(customStored);
          if (!isNaN(customValue)) {
            this.customMultiplier = Math.max(0.5, Math.min(3.0, customValue));
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to load font scale from storage:', error);
    }
  }

  /**
   * Save font scale to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(FONT_SCALE_STORAGE_KEY, this.currentScale);
      
      // Save custom multiplier if using custom scale
      if (this.currentScale === 'custom') {
        localStorage.setItem(CUSTOM_FONT_SCALE_STORAGE_KEY, this.customMultiplier.toString());
      }
    } catch (error) {
      logger.warn('Failed to save font scale to storage:', error);
    }
  }

  /**
   * Apply the current font scale to the document
   */
  private applyScale(): void {
    const multiplier = this.getCurrentMultiplier();
    document.documentElement.style.setProperty('--font-scale-multiplier', multiplier.toString());
    document.documentElement.setAttribute('data-font-scale', this.currentScale);
  }

  /**
   * Notify all listeners of scale changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentScale, this.currentScale === 'custom' ? this.customMultiplier : undefined);
      } catch (error) {
        logger.warn('Font scale listener error:', error);
      }
    });
  }

  /**
   * Reset to default scale
   */
  reset(): void {
    this.setScale('normal');
  }

  /**
   * Increase font scale by one step
   */
  increase(): void {
    const scales: FontScale[] = ['small', 'normal', 'large', 'extra-large'];
    const currentIndex = scales.indexOf(this.currentScale);
    if (currentIndex < scales.length - 1) {
      this.setScale(scales[currentIndex + 1]);
    }
  }

  /**
   * Decrease font scale by one step
   */
  decrease(): void {
    const scales: FontScale[] = ['small', 'normal', 'large', 'extra-large'];
    const currentIndex = scales.indexOf(this.currentScale);
    if (currentIndex > 0) {
      this.setScale(scales[currentIndex - 1]);
    }
  }
}

/**
 * Global font scale manager instance
 */
export const fontScaleManager = new FontScaleManager();

/**
 * React hook for using font scale in components
 */
export const useFontScale = () => {
  const [scale, setScale] = React.useState<FontScale>(fontScaleManager.getCurrentScale());
  const [customMultiplier, setCustomMultiplier] = React.useState<number>(fontScaleManager.getCustomMultiplier());

  React.useEffect(() => {
    const unsubscribe = fontScaleManager.subscribe((newScale, newCustomMultiplier) => {
      setScale(newScale);
      if (newCustomMultiplier !== undefined) {
        setCustomMultiplier(newCustomMultiplier);
      }
    });
    return unsubscribe;
  }, []);

  return {
    scale,
    multiplier: fontScaleManager.getCurrentMultiplier(),
    customMultiplier,
    setScale: (newScale: FontScale, customMult?: number) => fontScaleManager.setScale(newScale, customMult),
    setCustomMultiplier: (multiplier: number) => fontScaleManager.setCustomMultiplier(multiplier),
    increase: () => fontScaleManager.increase(),
    decrease: () => fontScaleManager.decrease(),
    reset: () => fontScaleManager.reset()
  };
};

// Import React for the hook
import React from 'react';
import { logger } from '@/lib/logger';