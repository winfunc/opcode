import type { Language, Translations } from "@/lib/i18n";
import { en } from "./en";
import { zh } from "./zh";
import { ja } from "./ja";
import { es } from "./es";
import { ko } from "./ko";
import { fr } from "./fr";
import { de } from "./de";
import { ru } from "./ru";
import { pt } from "./pt";
import { it } from "./it";
import { ar } from "./ar";
import { hi } from "./hi";

/**
 * Complete translations mapping for all supported languages
 *
 * Contains translation objects for all supported languages in the application.
 * Used by the i18n system to provide localized content.
 */
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

/**
 * Get translations for a specific language
 *
 * Retrieves the translation object for the specified language.
 * Falls back to English if the requested language is not available.
 *
 * @param language - Language code to get translations for
 * @returns Translation object for the specified language
 *
 * @example
 * ```typescript
 * const zhTranslations = getTranslations('zh');
 * const fallbackTranslations = getTranslations('unsupported' as Language);
 * // Returns English translations as fallback
 * ```
 */
export const getTranslations = (language: Language): Translations => {
  return translations[language] || translations.en;
};
