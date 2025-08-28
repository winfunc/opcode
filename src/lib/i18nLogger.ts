import i18n from '../i18n/i18n';

/**
 * Bilingual logger utility that outputs logs in both current language and English
 * 双语日志工具，同时输出当前语言和英文日志
 */
export class BilingualLogger {
  private static instance: BilingualLogger;
  
  private constructor() {}
  
  static getInstance(): BilingualLogger {
    if (!BilingualLogger.instance) {
      BilingualLogger.instance = new BilingualLogger();
    }
    return BilingualLogger.instance;
  }
  
  /**
   * Log info message in both languages
   */
  info(key: string, data?: any): void {
    const currentLang = i18n.language;
    const message = i18n.t(`logs.${key}`, data);
    
    if (currentLang === 'zh') {
      // If current language is Chinese, also show English
      const enMessage = i18n.t(`logs.${key}`, { ...data, lng: 'en' });
      console.log(`[INFO] ${message} / ${enMessage}`);
    } else {
      console.log(`[INFO] ${message}`);
    }
  }
  
  /**
   * Log error message in both languages
   */
  error(key: string, error?: any): void {
    const currentLang = i18n.language;
    const message = i18n.t(`logs.${key}`, { error: error?.message || error });
    
    if (currentLang === 'zh') {
      const enMessage = i18n.t(`logs.${key}`, { error: error?.message || error, lng: 'en' });
      console.error(`[ERROR] ${message} / ${enMessage}`);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }
  
  /**
   * Log warning message in both languages
   */
  warn(key: string, data?: any): void {
    const currentLang = i18n.language;
    const message = i18n.t(`logs.${key}`, data);
    
    if (currentLang === 'zh') {
      const enMessage = i18n.t(`logs.${key}`, { ...data, lng: 'en' });
      console.warn(`[WARN] ${message} / ${enMessage}`);
    } else {
      console.warn(`[WARN] ${message}`);
    }
  }
  
  /**
   * Log debug message in both languages (only in development)
   */
  debug(key: string, data?: any): void {
    if (import.meta.env.MODE !== 'development') return;
    
    const currentLang = i18n.language;
    const message = i18n.t(`logs.${key}`, data);
    
    if (currentLang === 'zh') {
      const enMessage = i18n.t(`logs.${key}`, { ...data, lng: 'en' });
      console.debug(`[DEBUG] ${message} / ${enMessage}`);
    } else {
      console.debug(`[DEBUG] ${message}`);
    }
  }
}

// Export singleton instance
export const logger = BilingualLogger.getInstance();