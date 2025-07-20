import React from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { SUPPORTED_LANGUAGES, type Language } from "@/lib/i18n";

interface LanguageSelectorProps {
  /**
   * 是否显示为紧凑模式（只显示图标）
   */
  compact?: boolean;
  /**
   * 可选的className
   */
  className?: string;
}

/**
 * 语言选择器组件
 * 允许用户切换应用程序的显示语言
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  compact = false,
  className,
}) => {
  const { language, setLanguage, t } = useI18n();

  const handleLanguageChange = (newLanguage: Language) => {
    setLanguage(newLanguage);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={className}
          title={t.common.language}
        >
          <Globe className="h-4 w-4" />
          {!compact && (
            <>
              <span className="ml-2">{SUPPORTED_LANGUAGES[language]}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => handleLanguageChange(code as Language)}
            className={`cursor-pointer ${language === code ? "bg-accent" : ""}`}
          >
            <span className="flex-1">{name}</span>
            {language === code && <span className="text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
