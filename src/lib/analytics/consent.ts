import type { AnalyticsSettings } from './types';

const ANALYTICS_STORAGE_KEY = 'claudia-analytics-settings';

export class ConsentManager {
  private static instance: ConsentManager;
  private settings: AnalyticsSettings | null = null;
  
  private constructor() {}
  
  static getInstance(): ConsentManager {
    if (!ConsentManager.instance) {
      ConsentManager.instance = new ConsentManager();
    }
    return ConsentManager.instance;
  }
  
  async initialize(): Promise<AnalyticsSettings> {
    try {
      // Try to load from localStorage first
      const stored = localStorage.getItem(ANALYTICS_STORAGE_KEY);
      if (stored) {
        this.settings = JSON.parse(stored);
      } else {
        // Initialize with default settings
        this.settings = {
          enabled: false,
          hasConsented: false,
        };
      }
      
      // Generate anonymous user ID if not exists
      if (this.settings && !this.settings.userId) {
        this.settings.userId = this.generateAnonymousId();
        await this.saveSettings();
      }
      
      // Generate session ID
      if (this.settings) {
        this.settings.sessionId = this.generateSessionId();
      }
      
      return this.settings || {
        enabled: false,
        hasConsented: false,
      };
    } catch (error) {
      console.error('Failed to initialize consent manager:', error);
      // Return default settings on error
      return {
        enabled: false,
        hasConsented: false,
      };
    }
  }
  
  async grantConsent(): Promise<void> {
    if (!this.settings) {
      await this.initialize();
    }
    
    this.settings!.enabled = true;
    this.settings!.hasConsented = true;
    this.settings!.consentDate = new Date().toISOString();
    
    await this.saveSettings();
  }
  
  async revokeConsent(): Promise<void> {
    if (!this.settings) {
      await this.initialize();
    }
    
    this.settings!.enabled = false;
    
    await this.saveSettings();
  }
  
  async deleteAllData(): Promise<void> {
    // Clear local storage
    localStorage.removeItem(ANALYTICS_STORAGE_KEY);
    
    // Reset settings with new anonymous ID
    this.settings = {
      enabled: false,
      hasConsented: false,
      userId: this.generateAnonymousId(),
      sessionId: this.generateSessionId(),
    };
    
    await this.saveSettings();
  }
  
  getSettings(): AnalyticsSettings | null {
    return this.settings;
  }
  
  hasConsented(): boolean {
    return this.settings?.hasConsented || false;
  }
  
  isEnabled(): boolean {
    return this.settings?.enabled || false;
  }
  
  getUserId(): string {
    return this.settings?.userId || this.generateAnonymousId();
  }
  
  getSessionId(): string {
    return this.settings?.sessionId || this.generateSessionId();
  }
  
  private async saveSettings(): Promise<void> {
    if (!this.settings) return;
    
    try {
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save analytics settings:', error);
    }
  }
  
  private generateAnonymousId(): string {
    // Generate a UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  
  private generateSessionId(): string {
    // Simple session ID based on timestamp and random value
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}