# Flutter Migration Tasks for Claudia

This document outlines the comprehensive migration plan from React/Tauri to Flutter for the Claudia desktop application.

## Phase 1: Project Setup and Foundation (Weeks 1-2)

### 1.1 Flutter Project Initialization
- [ ] Create new Flutter project in `src-flutter/` directory
- [ ] Configure Flutter desktop support (Windows, macOS, Linux)
- [ ] Set up project structure following Flutter best practices
- [ ] Configure build scripts and development commands
- [ ] Set up CI/CD pipeline for Flutter builds

### 1.2 Core Dependencies Setup
- [ ] Add essential packages:
  - `riverpod` or `bloc` for state management
  - `go_router` for navigation
  - `drift` for SQLite database (equivalent to rusqlite)
  - `window_manager` for custom window controls
  - `flutter_rust_bridge` for Rust FFI integration
- [ ] Configure platform-specific dependencies
- [ ] Set up code generation tools

### 1.3 Rust Backend Integration Strategy
- [ ] Create Rust FFI library from existing Tauri commands
- [ ] Implement `flutter_rust_bridge` bindings
- [ ] Set up shared library compilation for all platforms
- [ ] Create Rust API layer compatible with Flutter FFI
- [ ] Test basic Rust-Flutter communication

## Phase 2: Core UI System Migration (Weeks 3-4)

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

## Phase 3: State Management Architecture (Week 5)

### 3.1 Global State Migration
- [ ] Convert Zustand stores to Riverpod providers:
  - `SessionStore` → `SessionProvider`
  - `AgentStore` → `AgentProvider`
- [ ] Implement React Context equivalents:
  - `TabContext` → `TabNotifier`
  - `ThemeContext` → `ThemeNotifier`

### 3.2 Data Persistence Layer
- [ ] Migrate service layer to Drift database:
  - `sessionPersistence.ts` → `session_service.dart`
  - `tabPersistence.ts` → `tab_service.dart`
- [ ] Set up database migrations and schema management
- [ ] Implement caching mechanisms equivalent to OutputCacheProvider

## Phase 4: Core Component Migration (Weeks 6-8)

### 4.1 Application Shell Components
- [ ] **CustomTitlebar** → Custom app bar with window controls
- [ ] **TabManager** → `TabBarView` with drag-and-drop using `reorderable_list`
- [ ] **TabContent** → Dynamic widget routing system
- [ ] **StartupIntro** → Welcome screen with animations

### 4.2 Session Management Components (Highest Priority)
- [ ] **ClaudeCodeSession** → Main chat interface widget:
  - Implement real-time message streaming with `StreamBuilder`
  - Create virtualized message list using `flutter_list_view`
  - Build floating prompt input with queue management
  - Add drag-and-drop file support using `desktop_drop`
  - Implement split-pane layout with `split_view`
  - Create checkpoint timeline navigation
- [ ] **MessageList** → Custom scrollable message widgets
- [ ] **PromptQueue** → Queue management UI component
- [ ] **SessionHeader** → Session info display widget

### 4.3 Project and Agent Management
- [ ] **ProjectList** → Project browser with search functionality
- [ ] **SessionList** → Session history with virtualization
- [ ] **Agents** → Agent management interface
- [ ] **CreateAgent** → Agent creation wizard with form validation
- [ ] **AgentExecution** → Agent execution monitoring interface

## Phase 5: Advanced Features (Weeks 9-10)

### 5.1 Tool Widgets System
- [ ] Create dynamic widget factory system:
  - `TodoWidget` → Task management display
  - `BashWidget` → Terminal output display with syntax highlighting
  - `LSWidget` → Directory listing display
- [ ] Implement syntax highlighting using `flutter_syntax_view`
- [ ] Add code block rendering with custom themes

### 5.2 Settings and Configuration
- [ ] **Settings** → Multi-tab settings interface
- [ ] **MCPManager** → Model Context Protocol server management
- [ ] **ProxySettings** → Network proxy configuration
- [ ] **CheckpointSettings** → Session checkpoint configuration

### 5.3 Analytics and Usage Tracking
- [ ] **UsageDashboard** → Charts and analytics using `fl_chart`
- [ ] Implement PostHog integration equivalent
- [ ] Create privacy-focused consent management
- [ ] Build usage export functionality

## Phase 6: Advanced UI Features (Week 11)

### 6.1 Rich Text and Markdown
- [ ] Replace `react-markdown` with `flutter_markdown`
- [ ] Implement `@uiw/react-md-editor` equivalent with `flutter_quill`
- [ ] Add markdown preview functionality
- [ ] Create custom link detection and handling

### 6.2 Web Integration
- [ ] **WebviewPreview** → Embedded web view using `webview_flutter`
- [ ] Implement HTML rendering for tool outputs
- [ ] Add screenshot capture functionality

### 6.3 File System Integration
- [ ] **FilePicker** → File and directory selection using `file_picker`
- [ ] Implement drag-and-drop file handling
- [ ] Create file system browsing interface

## Phase 7: Platform Integration (Week 12)

### 7.1 Native Platform Features
- [ ] Custom window decorations and transparency
- [ ] macOS vibrancy effects equivalent
- [ ] Windows/Linux native theming integration
- [ ] System tray integration
- [ ] Global keyboard shortcuts

### 7.2 System Integration
- [ ] Claude CLI integration through Rust FFI
- [ ] Process management for background agent execution
- [ ] File system access and permissions
- [ ] Network proxy support

## Phase 8: Testing and Performance (Week 13)

### 8.1 Testing Strategy
- [ ] Unit tests for core business logic
- [ ] Widget tests for UI components
- [ ] Integration tests for Rust FFI communication
- [ ] Performance testing for large session lists
- [ ] Memory leak testing for real-time features

### 8.2 Performance Optimization
- [ ] Optimize message list virtualization
- [ ] Implement lazy loading for large datasets
- [ ] Optimize Rust FFI calls for better performance
- [ ] Profile and optimize animation performance

## Phase 9: Migration and Deployment (Week 14)

### 9.1 Data Migration
- [ ] Create migration scripts from current SQLite database
- [ ] Implement backward compatibility for settings
- [ ] Migrate user preferences and themes
- [ ] Transfer agent configurations and sessions

### 9.2 Build and Distribution
- [ ] Configure Flutter build for all platforms
- [ ] Set up code signing for macOS/Windows
- [ ] Create installation packages (DMG, MSI, AppImage)
- [ ] Update build scripts and CI/CD pipeline

## Risk Assessment and Mitigation

### High-Risk Components
1. **Real-time Message Streaming**: Requires careful implementation of StreamBuilder patterns
2. **Rust FFI Integration**: Complex async communication between Flutter and Rust
3. **Tab Drag-and-Drop**: Flutter's drag-and-drop system differs significantly from web
4. **Custom Window Controls**: Platform-specific implementations needed

### Medium-Risk Components
1. **Syntax Highlighting**: Different ecosystem, may require custom implementation
2. **Animation Timing**: Flutter animation system has different performance characteristics
3. **Database Migration**: Schema changes may require careful data migration

### Migration Strategy Recommendations

1. **Parallel Development**: Keep React version running while building Flutter version
2. **Feature Parity**: Ensure all existing features work before switching
3. **User Testing**: Beta test with power users before full migration
4. **Rollback Plan**: Maintain ability to revert to React version if needed

## Key Flutter Packages Required

### Core Framework
- `flutter/material.dart` - Material Design components
- `flutter/cupertino.dart` - iOS-style components

### State Management
- `riverpod: ^2.4.0` - Reactive state management
- `flutter_hooks: ^0.20.0` - React-hooks equivalent

### UI Components
- `flutter_animate: ^4.2.0` - Animation library
- `fl_chart: ^0.65.0` - Charts and graphs
- `flutter_markdown: ^0.6.0` - Markdown rendering
- `flutter_syntax_view: ^4.0.0` - Syntax highlighting

### System Integration
- `window_manager: ^0.3.0` - Custom window controls
- `file_picker: ^6.1.0` - File selection dialogs
- `desktop_drop: ^0.4.0` - Drag and drop support
- `webview_flutter: ^4.4.0` - Web view integration

### Data and Storage
- `drift: ^2.14.0` - SQLite database ORM
- `shared_preferences: ^2.2.0` - Simple key-value storage

### Rust Integration
- `flutter_rust_bridge: ^2.0.0` - Rust FFI bindings
- `ffi: ^2.1.0` - Foreign function interface

### Platform Specific
- `platform_channels` - Native platform communication
- `url_launcher: ^6.2.0` - Open URLs and files
- `path_provider: ^2.1.0` - System directories access

This migration plan provides a structured approach to transitioning from React/Tauri to Flutter while maintaining feature parity and ensuring a smooth user experience.