import React from "react";
import { motion } from "framer-motion";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/useI18n";

interface TokenCounterProps {
  /**
   * Total number of tokens
   */
  tokens: number;
  /**
   * Whether to show the counter
   */
  show?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * TokenCounter component - Displays a floating token count
 * 
 * @example
 * <TokenCounter tokens={1234} show={true} />
 */
export const TokenCounter: React.FC<TokenCounterProps> = ({
  tokens,
  show = true,
  className,
}) => {
  const t = useTranslations();
  
  if (!show || tokens === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={cn(
        "fixed bottom-20 right-4 z-30",
        "bg-background/90 backdrop-blur-sm",
        "border border-border rounded-full",
        "px-3 py-1.5 shadow-lg",
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-xs">
        <Hash className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono">{tokens.toLocaleString()}</span>
        <span className="text-muted-foreground">{t('dashboard.tokens')}</span>
      </div>
    </motion.div>
  );
}; 