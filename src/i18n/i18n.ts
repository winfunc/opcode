import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enComplete from './locales/en/complete.json';
import zhComplete from './locales/zh/complete.json';

const resources = {
  en: {
    translation: enComplete
  },
  zh: {
    translation: zhComplete
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    defaultNS: 'translation',
    
    interpolation: {
      escapeValue: false
    },
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'gooey-language',
    }
  });

export default i18n;