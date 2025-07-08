/**
 * Light-themed syntax highlighting theme
 * Features darker colors for better readability on light backgrounds
 */
export const lightSyntaxTheme: any = {
  'code[class*="language-"]': {
    color: '#24292f',
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
    color: '#24292f',
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
    color: '#6e7681',
    fontStyle: 'italic',
  },
  'prolog': {
    color: '#6e7681',
  },
  'doctype': {
    color: '#6e7681',
  },
  'cdata': {
    color: '#6e7681',
  },
  'punctuation': {
    color: '#656d76',
  },
  'namespace': {
    opacity: '0.7',
  },
  'property': {
    color: '#d2700d', // Darker Orange for light theme
  },
  'tag': {
    color: '#8250df', // Darker Violet
  },
  'boolean': {
    color: '#d2700d', // Darker Orange
  },
  'number': {
    color: '#d2700d', // Darker Orange
  },
  'constant': {
    color: '#d2700d', // Darker Orange
  },
  'symbol': {
    color: '#d2700d', // Darker Orange
  },
  'deleted': {
    color: '#cf222e',
  },
  'selector': {
    color: '#8250df', // Darker Purple
  },
  'attr-name': {
    color: '#8250df', // Darker Purple
  },
  'string': {
    color: '#0a8043', // Darker Green
  },
  'char': {
    color: '#0a8043', // Darker Green
  },
  'builtin': {
    color: '#8250df', // Darker Violet
  },
  'url': {
    color: '#0a8043', // Darker Green
  },
  'inserted': {
    color: '#0a8043', // Darker Green
  },
  'entity': {
    color: '#8250df', // Darker Purple
    cursor: 'help',
  },
  'atrule': {
    color: '#8250df', // Darker Violet
  },
  'attr-value': {
    color: '#0a8043', // Darker Green
  },
  'keyword': {
    color: '#8250df', // Darker Violet
  },
  'function': {
    color: '#6639ba', // Darker Indigo
  },
  'class-name': {
    color: '#d2700d', // Darker Orange
  },
  'regex': {
    color: '#0969da', // Darker Cyan
  },
  'important': {
    color: '#d2700d', // Darker Orange
    fontWeight: 'bold',
  },
  'variable': {
    color: '#8250df', // Darker Purple
  },
  'bold': {
    fontWeight: 'bold',
  },
  'italic': {
    fontStyle: 'italic',
  },
  'operator': {
    color: '#656d76',
  },
  'script': {
    color: '#24292f',
  },
  'parameter': {
    color: '#bf8700', // Darker Yellow
  },
  'method': {
    color: '#6639ba', // Darker Indigo
  },
  'field': {
    color: '#d2700d', // Darker Orange
  },
  'annotation': {
    color: '#6e7681',
  },
  'type': {
    color: '#8250df', // Darker Purple
  },
  'module': {
    color: '#8250df', // Darker Violet
  },
}; 