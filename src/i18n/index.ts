import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

const resources = {
  en: {
    translation: en
  },
  zh: {
    translation: zh
  }
};

// 检测用户系统语言
const getUserLanguage = () => {
  const savedLang = localStorage.getItem('language');
  if (savedLang) return savedLang;
  
  const browserLang = navigator.language.split('-')[0];
  return (resources as Record<string, unknown>)[browserLang] ? browserLang : 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getUserLanguage(), // 默认语言
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
