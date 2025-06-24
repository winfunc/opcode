/**
 * Claude-themed syntax highlighting theme
 * Features orange, purple, and violet colors to match Claude's aesthetic
 */
export const claudeSyntaxTheme: any = {
  'code[class*="language-"]': {
    color: '#cdd6f4',
    background: 'transparent',
    textShadow: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875em',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.5',
    MozTabSize: '4',
    OTabSize: '4',
    tabSize: '4',
    WebkitHyphens: 'none',
    MozHyphens: 'none',
    msHyphens: 'none',
    hyphens: 'none',
  },
  'pre[class*="language-"]': {
    color: '#cdd6f4',
    background: 'transparent',
    textShadow: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875em',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.5',
    MozTabSize: '4',
    OTabSize: '4',
    tabSize: '4',
    WebkitHyphens: 'none',
    MozHyphens: 'none',
    msHyphens: 'none',
    hyphens: 'none',
    padding: '1em',
    margin: '0',
    overflow: 'auto',
  },
  ':not(pre) > code[class*="language-"]': {
    background: 'rgba(139, 92, 246, 0.1)',
    padding: '0.1em 0.3em',
    borderRadius: '0.3em',
    whiteSpace: 'normal',
  },
  'comment': {
    color: '#6c7086',
    fontStyle: 'italic',
  },
  'prolog': {
    color: '#6c7086',
  },
  'doctype': {
    color: '#6c7086',
  },
  'cdata': {
    color: '#6c7086',
  },
  'punctuation': {
    color: '#a6adc8',
  },
  'namespace': {
    opacity: '0.7',
  },
  'property': {
    color: '#fab387', // Amber/Orange
  },
  'tag': {
    color: '#cba6f7', // Violet
  },
  'boolean': {
    color: '#fab387', // Amber/Orange
  },
  'number': {
    color: '#fab387', // Amber/Orange
  },
  'constant': {
    color: '#fab387', // Amber/Orange
  },
  'symbol': {
    color: '#fab387', // Amber/Orange
  },
  'deleted': {
    color: '#f38ba8',
  },
  'selector': {
    color: '#b4befe', // Light Purple
  },
  'attr-name': {
    color: '#b4befe', // Light Purple
  },
  'string': {
    color: '#a6e3a1', // Emerald Green
  },
  'char': {
    color: '#a6e3a1', // Emerald Green
  },
  'builtin': {
    color: '#cba6f7', // Violet
  },
  'url': {
    color: '#a6e3a1', // Emerald Green
  },
  'inserted': {
    color: '#a6e3a1', // Emerald Green
  },
  'entity': {
    color: '#b4befe', // Light Purple
    cursor: 'help',
  },
  'atrule': {
    color: '#cba6f7', // Light Violet
  },
  'attr-value': {
    color: '#a6e3a1', // Emerald Green
  },
  'keyword': {
    color: '#cba6f7', // Light Violet
  },
  'function': {
    color: '#89b4fa', // Indigo
  },
  'class-name': {
    color: '#fab387', // Amber/Orange
  },
  'regex': {
    color: '#89dceb', // Cyan
  },
  'important': {
    color: '#fab387', // Amber/Orange
    fontWeight: 'bold',
  },
  'variable': {
    color: '#b4befe', // Light Purple
  },
  'bold': {
    fontWeight: 'bold',
  },
  'italic': {
    fontStyle: 'italic',
  },
  'operator': {
    color: '#a6adc8',
  },
  'script': {
    color: '#cdd6f4',
  },
  'parameter': {
    color: '#f9e2af', // Yellow
  },
  'method': {
    color: '#89b4fa', // Indigo
  },
  'field': {
    color: '#fab387', // Amber/Orange
  },
  'annotation': {
    color: '#6c7086',
  },
  'type': {
    color: '#b4befe', // Light Purple
  },
  'module': {
    color: '#cba6f7', // Violet
  },
}; 