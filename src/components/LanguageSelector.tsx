import React from "react";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LanguageSelectorProps {
  onLanguageChange: (language: string) => void;
  currentLanguage: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  onLanguageChange,
  currentLanguage
}) => {
  const { t } = useTranslation();

  const handleLanguageChange = (value: string) => {
    onLanguageChange(value);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{t('settings.language')}</label>
      <Select value={currentLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('settings.language')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="zh">中文</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};