import React from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
] as const;

interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className }) => {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className={`relative ${className || ""}`} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
        title={t("titlebar.language")}
      >
        <Globe size={16} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-36 bg-popover border border-border rounded-lg shadow-lg z-[250]">
          <div className="py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleChange(lang.code)}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors ${
                  i18n.language === lang.code ? "bg-accent/50 font-medium" : ""
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
