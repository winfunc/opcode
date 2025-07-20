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
 * LanguageSelector component for switching application language
 *
 * A dropdown component that allows users to switch between supported
 * languages. Features compact mode for icon-only display and full mode
 * with language name. Automatically persists language preference.
 *
 * @param compact - Whether to show in compact mode (icon only)
 * @param className - Optional CSS classes for styling
 *
 * @example
 * ```tsx
 * // Full mode with language name
 * <LanguageSelector />
 *
 * // Compact mode (icon only)
 * <LanguageSelector compact={true} />
 * ```
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  compact = false,
  className,
}) => {
  const { language, setLanguage, t } = useI18n();

  /**
   * Handle language change selection
   *
   * @param newLanguage - The selected language code
   */
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
