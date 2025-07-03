import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/lib/i18n/useI18n';
import { LOCALE_NAMES, Locale } from '@/lib/i18n';

interface LanguageSelectorProps {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function LanguageSelector({ 
  variant = "ghost", 
  size = "sm",
  showLabel = false,
  className 
}: LanguageSelectorProps) {
  const { locale, setLocale } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Globe className="h-4 w-4" />
          {showLabel && (
            <span className="ml-2">
              {LOCALE_NAMES[locale]}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(LOCALE_NAMES).map(([key, name]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => setLocale(key as Locale)}
            className={locale === key ? "bg-accent" : ""}
          >
            <span className={locale === key ? "font-medium" : ""}>
              {name}
            </span>
            {locale === key && (
              <span className="ml-auto text-xs">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 