import React, { useState, useEffect, ReactNode } from "react";
import {
  I18nContext,
  type Language,
  type I18nContextType,
  getBrowserLanguage,
  isRTLLanguage,
} from "@/lib/i18n";
import { getTranslations } from "@/locales";

/**
 * Props interface for the I18nProvider component
 */
interface I18nProviderProps {
  children: ReactNode;
}

/**
 * Local storage key for persisting language preference
 */
const LANGUAGE_STORAGE_KEY = "claudia-language";

/**
 * I18nProvider component for providing internationalization context
 *
 * Provides internationalization functionality throughout the application including
 * language switching, translation access, RTL support, and persistent language
 * preferences. Automatically detects browser language and updates HTML attributes.
 *
 * @param children - Child components that will have access to i18n context
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <I18nProvider>
 *       <Header />
 *       <MainContent />
 *       <Footer />
 *     </I18nProvider>
 *   );
 * }
 * ```
 */
export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  // 从localStorage获取保存的语言，如果没有则使用浏览器语言
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
    return savedLanguage || getBrowserLanguage();
  });

  // 更新语言设置
  const handleSetLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);

    // 更新HTML lang属性
    document.documentElement.lang = newLanguage;

    // 更新HTML dir属性（用于RTL语言）
    document.documentElement.dir = isRTLLanguage(newLanguage) ? "rtl" : "ltr";
  };

  // 初始化时设置HTML属性
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRTLLanguage(language) ? "rtl" : "ltr";
  }, [language]);

  const contextValue: I18nContextType = {
    language,
    setLanguage: handleSetLanguage,
    t: getTranslations(language),
    isRTL: isRTLLanguage(language),
  };

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
};
