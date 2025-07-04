import { en, Translations } from './locales/en';
import { zhTW } from './locales/zh-TW';
import { zhCN } from './locales/zh-CN';
import { ja } from './locales/ja';

export const locales = {
  en,
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  ja,
} as const;

export type Locale = keyof typeof locales;

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  ja: '日本語',
};

// Utility function to get nested translation
export function getNestedTranslation(
  translations: Translations,
  path: string,
  defaultValue?: string
): string {
  const keys = path.split('.');
  let result: any = translations;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return defaultValue || path;
    }
  }
  
  return typeof result === 'string' ? result : defaultValue || path;
}

// Browser language detection
export function detectBrowserLanguage(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  
  const browserLang = navigator.language || (navigator as any).userLanguage;
  
  // Check for exact match
  if (browserLang in locales) {
    return browserLang as Locale;
  }
  
  // Check for partial match (e.g., 'zh-TW' matches 'zh')
  const langCode = browserLang.split('-')[0];
  const matchingLocale = Object.keys(locales).find(locale => 
    locale.startsWith(langCode)
  ) as Locale;
  
  return matchingLocale || DEFAULT_LOCALE;
} 