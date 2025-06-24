export type Theme = 'dark' | 'catppuccin';

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'catppuccin') {
    root.classList.add('theme-catppuccin');
  } else {
    root.classList.remove('theme-catppuccin');
  }
}
