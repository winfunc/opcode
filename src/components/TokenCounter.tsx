import React from "react";
import { motion } from "framer-motion";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

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
 * A floating token counter that appears at the bottom-right of the screen
 * to show the current token usage. Features smooth animations and auto-hide
 * when token count is zero.
 *
 * @param tokens - Total number of tokens to display
 * @param show - Whether to show the counter (default: true)
 * @param className - Additional CSS classes for styling
 *
 * @example
 * ```tsx
 * <TokenCounter tokens={1234} show={isVisible} />
 *
 * // With custom styling
 * <TokenCounter
 *   tokens={totalTokens}
 *   show={showTokens}
 *   className="bottom-32 right-8"
 * />
 * ```
 */
export const TokenCounter: React.FC<TokenCounterProps> = ({ tokens, show = true, className }) => {
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
        <span className="text-muted-foreground">tokens</span>
      </div>
    </motion.div>
  );
};
