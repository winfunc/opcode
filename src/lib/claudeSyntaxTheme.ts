import type React from "react";

/**
 * Claude-themed syntax highlighting theme
 *
 * A comprehensive syntax highlighting theme designed to match Claude's aesthetic.
 * Features orange, purple, and violet colors with carefully chosen contrast ratios
 * for optimal readability in both light and dark environments.
 *
 * @example
 * ```tsx
 * import { claudeSyntaxTheme } from '@/lib/claudeSyntaxTheme';
 *
 * // Use with Prism.js or similar syntax highlighter
 * <SyntaxHighlighter style={claudeSyntaxTheme} language="javascript">
 *   {code}
 * </SyntaxHighlighter>
 * ```
 */
export const claudeSyntaxTheme: { [key: string]: React.CSSProperties } = {
  'code[class*="language-"]': {
    color: "#e3e8f0",
    background: "transparent",
    textShadow: "none",
    fontFamily: "var(--font-mono)",
    fontSize: "0.875em",
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.5",
    MozTabSize: "4",
    OTabSize: "4",
    tabSize: "4",
    WebkitHyphens: "none",
    MozHyphens: "none",
    msHyphens: "none",
    hyphens: "none",
  },
  'pre[class*="language-"]': {
    color: "#e3e8f0",
    background: "transparent",
    textShadow: "none",
    fontFamily: "var(--font-mono)",
    fontSize: "0.875em",
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.5",
    MozTabSize: "4",
    OTabSize: "4",
    tabSize: "4",
    WebkitHyphens: "none",
    MozHyphens: "none",
    msHyphens: "none",
    hyphens: "none",
    padding: "1em",
    margin: "0",
    overflow: "auto",
  },
  ':not(pre) > code[class*="language-"]': {
    background: "rgba(139, 92, 246, 0.1)",
    padding: "0.1em 0.3em",
    borderRadius: "0.3em",
    whiteSpace: "normal",
  },
  comment: {
    color: "#6b7280",
    fontStyle: "italic",
  },
  prolog: {
    color: "#6b7280",
  },
  doctype: {
    color: "#6b7280",
  },
  cdata: {
    color: "#6b7280",
  },
  punctuation: {
    color: "#9ca3af",
  },
  namespace: {
    opacity: "0.7",
  },
  property: {
    color: "#f59e0b", // Amber/Orange
  },
  tag: {
    color: "#8b5cf6", // Violet
  },
  boolean: {
    color: "#f59e0b", // Amber/Orange
  },
  number: {
    color: "#f59e0b", // Amber/Orange
  },
  constant: {
    color: "#f59e0b", // Amber/Orange
  },
  symbol: {
    color: "#f59e0b", // Amber/Orange
  },
  deleted: {
    color: "#ef4444",
  },
  selector: {
    color: "#a78bfa", // Light Purple
  },
  "attr-name": {
    color: "#a78bfa", // Light Purple
  },
  string: {
    color: "#10b981", // Emerald Green
  },
  char: {
    color: "#10b981", // Emerald Green
  },
  builtin: {
    color: "#8b5cf6", // Violet
  },
  url: {
    color: "#10b981", // Emerald Green
  },
  inserted: {
    color: "#10b981", // Emerald Green
  },
  entity: {
    color: "#a78bfa", // Light Purple
    cursor: "help",
  },
  atrule: {
    color: "#c084fc", // Light Violet
  },
  "attr-value": {
    color: "#10b981", // Emerald Green
  },
  keyword: {
    color: "#c084fc", // Light Violet
  },
  function: {
    color: "#818cf8", // Indigo
  },
  "class-name": {
    color: "#f59e0b", // Amber/Orange
  },
  regex: {
    color: "#06b6d4", // Cyan
  },
  important: {
    color: "#f59e0b", // Amber/Orange
    fontWeight: "bold",
  },
  variable: {
    color: "#a78bfa", // Light Purple
  },
  bold: {
    fontWeight: "bold",
  },
  italic: {
    fontStyle: "italic",
  },
  operator: {
    color: "#9ca3af",
  },
  script: {
    color: "#e3e8f0",
  },
  parameter: {
    color: "#fbbf24", // Yellow
  },
  method: {
    color: "#818cf8", // Indigo
  },
  field: {
    color: "#f59e0b", // Amber/Orange
  },
  annotation: {
    color: "#6b7280",
  },
  type: {
    color: "#a78bfa", // Light Purple
  },
  module: {
    color: "#8b5cf6", // Violet
  },
};
