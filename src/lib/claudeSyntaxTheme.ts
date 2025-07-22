/**
 * Claude-themed syntax highlighting theme
 * Features orange, purple, and violet colors to match Claude's aesthetic
 * Supports both light and dark themes
 */

const baseTheme = {
  textShadow: 'none',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.875em',
  textAlign: 'left' as const,
  whiteSpace: 'pre' as const,
  wordSpacing: 'normal',
  wordBreak: 'normal' as const,
  wordWrap: 'normal' as const,
  lineHeight: '1.5',
  MozTabSize: '4',
  OTabSize: '4',
  tabSize: '4',
  WebkitHyphens: 'none' as const,
  MozHyphens: 'none' as const,
  msHyphens: 'none' as const,
  hyphens: 'none' as const,
};

const lightColors = {
  base: '#1f2937',
  comment: '#9ca3af',
  punctuation: '#6b7280',
  property: '#f59e0b', // Amber/Orange
  tag: '#8b5cf6', // Violet
  boolean: '#f59e0b', // Amber/Orange
  number: '#f59e0b', // Amber/Orange
  constant: '#f59e0b', // Amber/Orange
  symbol: '#f59e0b', // Amber/Orange
  deleted: '#ef4444',
  selector: '#a78bfa', // Light Purple
  string: '#10b981', // Emerald Green
  builtin: '#8b5cf6', // Violet
  inserted: '#10b981', // Emerald Green
  entity: '#a78bfa', // Light Purple
  atrule: '#c084fc', // Light Violet
  keyword: '#c084fc', // Light Violet
  function: '#818cf8', // Indigo
  className: '#f59e0b', // Amber/Orange
  regex: '#06b6d4', // Cyan
  important: '#f59e0b', // Amber/Orange
  variable: '#a78bfa', // Light Purple
  parameter: '#fbbf24', // Yellow
  method: '#818cf8', // Indigo
  field: '#f59e0b', // Amber/Orange
  annotation: '#9ca3af',
  type: '#a78bfa', // Light Purple
  module: '#8b5cf6', // Violet
  inlineCodeBg: 'rgba(139, 92, 246, 0.15)',
};

const darkColors = {
  base: '#e3e8f0',
  comment: '#6b7280',
  punctuation: '#9ca3af',
  property: '#f59e0b', // Amber/Orange
  tag: '#8b5cf6', // Violet
  boolean: '#f59e0b', // Amber/Orange
  number: '#f59e0b', // Amber/Orange
  constant: '#f59e0b', // Amber/Orange
  symbol: '#f59e0b', // Amber/Orange
  deleted: '#ef4444',
  selector: '#a78bfa', // Light Purple
  string: '#10b981', // Emerald Green
  builtin: '#8b5cf6', // Violet
  inserted: '#10b981', // Emerald Green
  entity: '#a78bfa', // Light Purple
  atrule: '#c084fc', // Light Violet
  keyword: '#c084fc', // Light Violet
  function: '#818cf8', // Indigo
  className: '#f59e0b', // Amber/Orange
  regex: '#06b6d4', // Cyan
  important: '#f59e0b', // Amber/Orange
  variable: '#a78bfa', // Light Purple
  parameter: '#fbbf24', // Yellow
  method: '#818cf8', // Indigo
  field: '#f59e0b', // Amber/Orange
  annotation: '#6b7280',
  type: '#a78bfa', // Light Purple
  module: '#8b5cf6', // Violet
  inlineCodeBg: 'rgba(139, 92, 246, 0.1)',
};

function createTheme(colors: typeof lightColors) {
  return {
    'code[class*="language-"]': {
      color: colors.base,
      background: 'transparent',
      ...baseTheme,
    },
    'pre[class*="language-"]': {
      color: colors.base,
      background: 'transparent',
      ...baseTheme,
      padding: '1em',
      margin: '0',
      overflow: 'auto',
    },
    ':not(pre) > code[class*="language-"]': {
      background: colors.inlineCodeBg,
      padding: '0.1em 0.3em',
      borderRadius: '0.3em',
      whiteSpace: 'normal' as const,
    },
    'comment': { color: colors.comment, fontStyle: 'italic' },
    'prolog': { color: colors.comment },
    'doctype': { color: colors.comment },
    'cdata': { color: colors.comment },
    'punctuation': { color: colors.punctuation },
    'namespace': { opacity: '0.7' },
    'property': { color: colors.property },
    'tag': { color: colors.tag },
    'boolean': { color: colors.boolean },
    'number': { color: colors.number },
    'constant': { color: colors.constant },
    'symbol': { color: colors.symbol },
    'deleted': { color: colors.deleted },
    'selector': { color: colors.selector },
    'attr-name': { color: colors.selector },
    'string': { color: colors.string },
    'char': { color: colors.string },
    'builtin': { color: colors.builtin },
    'url': { color: colors.string },
    'inserted': { color: colors.inserted },
    'entity': { color: colors.entity, cursor: 'help' },
    'atrule': { color: colors.atrule },
    'attr-value': { color: colors.string },
    'keyword': { color: colors.keyword },
    'function': { color: colors.function },
    'class-name': { color: colors.className },
    'regex': { color: colors.regex },
    'important': { color: colors.important, fontWeight: 'bold' },
    'variable': { color: colors.variable },
    'bold': { fontWeight: 'bold' },
    'italic': { fontStyle: 'italic' },
    'operator': { color: colors.punctuation },
    'script': { color: colors.base },
    'parameter': { color: colors.parameter },
    'method': { color: colors.method },
    'field': { color: colors.field },
    'annotation': { color: colors.annotation },
    'type': { color: colors.type },
    'module': { color: colors.module },
  };
}

export const claudeSyntaxThemeLight = createTheme(lightColors);
export const claudeSyntaxThemeDark = createTheme(darkColors);

// Default export for backward compatibility
export const claudeSyntaxTheme = claudeSyntaxThemeLight;

// Function to get theme based on current theme mode
export function getClaudeSyntaxTheme(isDark: boolean) {
  return isDark ? claudeSyntaxThemeDark : claudeSyntaxThemeLight;
}