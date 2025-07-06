# Feature: Add comprehensive appearance customization system

## Summary

This pull request introduces a comprehensive appearance customization system to Claudia, addressing accessibility needs for users with high-resolution monitors and alternative keyboard layouts. The feature adds:

- **Global font scaling** with 8 size options (12px to 32px) affecting ALL UI text
- **Panel width customization** with 8 width options (768px to full width)
- **Keyboard layout support** for COLEMAK, DVORAK, and WORKMAN with real-time translation

## Problem Solved

1. **Accessibility on high-resolution monitors**: Fixed font sizes make the UI difficult to read on 4K+ displays
2. **Screen space utilization**: Default panel width doesn't make optimal use of wide monitors
3. **Alternative keyboard layouts**: Users with non-QWERTY layouts couldn't type correctly in the application

## Approach

### 1. Global Font Scaling System
- Implemented CSS custom properties (`--font-scale`) that cascade through the entire UI
- Created font size variables that scale proportionally: `--font-size-xs` through `--font-size-4xl`
- Override Tailwind utilities to use scaled sizes globally
- Font sizes range from "small" (12px) to "giant" (32px)

### 2. Panel Width Management
- Added CSS variable `--panel-max-width` for dynamic panel sizing
- Implemented 8 width options from "compact" (768px) to "full" width
- Full width mode includes responsive padding for better readability
- Uses data attributes for CSS targeting

### 3. Keyboard Layout Translation
- Created comprehensive keyboard mappings for COLEMAK, DVORAK, and WORKMAN
- Implemented real-time character translation at the input level
- Added `KeyboardInput` and `KeyboardTextarea` components with automatic translation
- Translation happens transparently without affecting clipboard or shortcuts

## Technical Implementation

### New Components
- `PreferencesContext` - Centralized state management for appearance settings
- `KeyboardInput` - Input component with layout translation
- `KeyboardTextarea` - Textarea component with layout translation

### New Hooks
- `usePreferences` - Access appearance preferences throughout the app
- `useKeyboardLayoutInput` - Handle keyboard translation logic

### New Utilities
- `keyboardLayouts.ts` - Complete keyboard layout mappings and translation functions

### Modified Files
- `Settings.tsx` - Added "Appearance" tab with all customization options
- `App.tsx` - Integrated PreferencesProvider for app-wide preferences
- `FloatingPromptInput.tsx` - Updated to use KeyboardTextarea for layout support
- `styles.css` - Added global CSS scaling system
- `package.json` - Added `concurrently` dependency for development workflow

## Features Details

### Font Size Options
1. Small (12px) - For maximum content density
2. Default (14px) - Standard size
3. Medium (16px) - Slightly larger for comfort
4. Large (18px) - Better readability
5. Extra Large (20px) - High visibility
6. Huge (24px) - Accessibility focused
7. Massive (28px) - Maximum readability
8. Giant (32px) - Ultra high visibility

### Panel Width Options
1. Compact (768px) - Minimal width
2. Comfortable (1024px) - Standard laptop
3. Spacious (1280px) - Default
4. Wide (1440px) - Wide monitors
5. Wider (1600px) - Ultra-wide
6. Widest (1760px) - Maximum fixed
7. Ultra Wide (1920px) - Full HD width
8. Full Width - Responsive with padding

### Keyboard Layouts
- **COLEMAK**: Popular ergonomic layout
- **DVORAK**: Classic alternative layout
- **WORKMAN**: Modern ergonomic layout

## Testing

- ✅ TypeScript compilation passes without errors
- ✅ Build process completes successfully
- ✅ Font scaling affects all UI elements (menus, headers, content)
- ✅ Panel width adjustments work correctly
- ✅ Keyboard layouts translate accurately
- ✅ Preferences persist in localStorage
- ✅ No console errors or warnings

## Screenshots

### Font Size Scaling
[User should add screenshot showing different font sizes]

### Panel Width Options
[User should add screenshot showing different panel widths]

### Keyboard Layout Settings
[User should add screenshot of the Appearance settings tab]

## Dependencies

- Added `concurrently@^8.2.2` for improved development workflow (`dev:tauri` script)

## Notes

- All features are opt-in with sensible defaults
- Preferences are stored in localStorage for persistence
- Keyboard translation doesn't affect system shortcuts or clipboard
- CSS scaling ensures consistent proportions across all font sizes
- Full JSDoc documentation added to all exported functions and components

## Benefits

1. **Improved Accessibility**: Users with visual impairments or high-res monitors can now comfortably use Claudia
2. **Better Screen Utilization**: Wide monitor users can take advantage of their full screen real estate
3. **Inclusive Design**: Support for alternative keyboard layouts makes Claudia accessible to a wider audience
4. **Future-Proof**: The preference system can be easily extended for additional customization options

This feature significantly improves the user experience and accessibility of Claudia while maintaining backward compatibility and following the project's coding standards.