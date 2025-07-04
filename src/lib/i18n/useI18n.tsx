import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { locales, Locale, detectBrowserLanguage, getNestedTranslation } from './index';
import { Translations } from './locales/en';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, defaultValue?: string) => string;
  translations: Translations;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // Try to get from localStorage first, fallback to browser detection
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('claudia-locale') as Locale;
      if (stored && stored in locales) {
        return stored;
      }
    }
    return detectBrowserLanguage();
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('claudia-locale', newLocale);
    }
  };

  const translations = locales[locale];

  const t = (key: string, defaultValue?: string): string => {
    return getNestedTranslation(translations, key, defaultValue);
  };

  useEffect(() => {
    // Save locale preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('claudia-locale', locale);
    }
  }, [locale]);

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        translations,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Convenience hook for translations only
export function useTranslations() {
  const { t } = useI18n();
  return t;
} 