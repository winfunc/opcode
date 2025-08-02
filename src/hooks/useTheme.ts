import { useThemeContext } from '../contexts/ThemeContext';

/**
 * Hook to access and control the theme system
 * 
 * @returns {Object} Theme utilities and state
 * @returns {ThemeMode} theme - Current theme mode ('dark' | 'gray' | 'light' | 'custom')
 * @returns {CustomThemeColors} customColors - Custom theme color configuration
 * @returns {Function} setTheme - Function to change the theme mode
 * @returns {Function} setCustomColors - Function to update custom theme colors
 * @returns {boolean} isLoading - Whether theme operations are in progress
 * 
 * @example
 * const { theme, setTheme } = useTheme();
 * 
 * // Change theme
 * await setTheme('light');
 * 
 * // Update custom colors
 * await setCustomColors({ background: 'oklch(0.98 0.01 240)' });
 */
export const useTheme = () => {
  return useThemeContext();
};