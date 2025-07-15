import type { Language, Translations } from '@/lib/i18n';
import { en } from './en';
import { zh } from './zh';
import { ja } from './ja';
import { es } from './es';

// 导入所有翻译
export const translations: Record<Language, Translations> = {
  en,
  zh,
  ja,
  es,
  // 其他语言可以后续添加
  ko: en, // 暂时使用英文作为韩语的后备
  fr: en, // 暂时使用英文作为法语的后备
  de: en, // 暂时使用英文作为德语的后备
  ru: en, // 暂时使用英文作为俄语的后备
  pt: en, // 暂时使用英文作为葡萄牙语的后备
  it: en, // 暂时使用英文作为意大利语的后备
  ar: en, // 暂时使用英文作为阿拉伯语的后备
  hi: en, // 暂时使用英文作为印地语的后备
};

// 获取翻译
export const getTranslations = (language: Language): Translations => {
  return translations[language] || translations.en;
};