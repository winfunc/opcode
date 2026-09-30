import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supportedLanguages } from '@/i18n';

interface LanguageSelectorProps {
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className }) => {
  const { t, i18n } = useTranslation();
  
  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('app_language', langCode);
  };

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <Label className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {t('settings.general.language')}
        </Label>
        <p className="text-caption text-muted-foreground mt-1">
          {t('settings.general.languageDesc')}
        </p>
      </div>
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg">
        {supportedLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              i18n.language === lang.code || i18n.language.startsWith(lang.code + '-')
                ? "bg-background shadow-sm" 
                : "hover:bg-background/50"
            )}
          >
            {(i18n.language === lang.code || i18n.language.startsWith(lang.code + '-')) && (
              <Check className="h-3 w-3" />
            )}
            {lang.nativeName}
          </button>
        ))}
      </div>
    </div>
  );
};
