import type { Language, Translations } from '@/lib/i18n';
import { en } from './en';
import { zh } from './zh';
import { ja } from './ja';
import { es } from './es';
import { ko } from './ko';
import { fr } from './fr';
import { de } from './de';
import { ru } from './ru';
import { pt } from './pt';
import { it } from './it';
import { ar } from './ar';
import { hi } from './hi';

// 导入所有翻译
export const translations: Record<Language, Translations> = {
  en,
  zh,
  ja,
  es,
  ko,
  fr,
  de,
  ru,
  pt,
  it,
  ar,
  hi,
};

// 获取翻译
export const getTranslations = (language: Language): Translations => {
  return translations[language] || translations.en;
};