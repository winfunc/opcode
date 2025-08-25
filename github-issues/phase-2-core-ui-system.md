# [Flutter Migration] Phase 2: Core UI System Migration

## Overview
Migrate the core UI system from React/shadcn/ui to Flutter Material Design components with custom theming.

## Tasks

### 2.1 Design System Implementation
- [ ] Create Flutter equivalent of shadcn/ui components:
  - `CustomButton` (equivalent to Button with CVA variants)
  - `CustomDialog` (modal dialogs with overlay)
  - `CustomTabs` (tabbed interface system)
  - `CustomInput`, `CustomSelect`, `CustomSwitch`
  - `CustomCard`, `CustomBadge`, `CustomToast`
- [ ] Implement dynamic theming system equivalent to ThemeContext
- [ ] Create CSS variables equivalent using Flutter themes
- [ ] Set up responsive design patterns

### 2.2 Icon and Asset System
- [ ] Migrate from Lucide React to `lucide_flutter` or equivalent
- [ ] Set up asset management for images and fonts
- [ ] Configure custom fonts (Inter font family)
- [ ] Implement icon picker component

### 2.3 Animation System
- [ ] Replace Framer Motion with Flutter animations:
  - `flutter_animate` for complex animations
  - Built-in `AnimatedContainer`, `Hero` widgets
  - Custom transition animations for page changes
  - Staggered list animations equivalent

## Acceptance Criteria
- [ ] All core UI components are implemented with Flutter equivalents
- [ ] Dynamic theming system works correctly
- [ ] Animation system provides smooth transitions
- [ ] Asset management is properly configured

## Dependencies
- Depends on Phase 1 completion

## Timeline
**Estimated Duration:** 2 weeks (Weeks 3-4)

## Priority
🟠 **High** - Core UI foundation

## Labels
`flutter-migration`, `phase-2`, `ui-system`, `design-system`