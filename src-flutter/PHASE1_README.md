# Claudia Flutter - Phase 1

Flutter version of Claudia - GUI app and Toolkit for Claude Code

## Project Structure

This Flutter project follows a feature-based architecture with clean code principles:

```
lib/
├── core/           # Core application configuration and utilities
├── features/       # Feature modules (agents, sessions, projects, etc.)
├── shared/         # Shared widgets, themes, and utilities
└── main.dart       # Application entry point
```

## Development Commands

### Prerequisites
- Flutter SDK 3.24.0 or higher
- Dart 3.0 or higher

### Getting Started

```bash
# Install dependencies
flutter pub get

# Run on desktop (macOS)
flutter run -d macos

# Run on desktop (Linux)
flutter run -d linux

# Run on desktop (Windows)
flutter run -d windows

# Build for release
flutter build macos  # or linux/windows
```

### Development Tools

```bash
# Code generation for build_runner
dart run build_runner build

# Watch for changes and regenerate
dart run build_runner watch

# Clean generated files
dart run build_runner clean
```

## Phase 1 Implementation

This represents the foundation implementation of the Flutter migration:

✅ **Completed Tasks:**
- [x] Flutter project initialization with desktop support
- [x] Core dependencies setup (Riverpod, Window Manager, etc.)
- [x] Basic project structure and architecture
- [x] Custom window controls and titlebar
- [x] Theme system with Inter font
- [x] Asset management setup

🚧 **Next Steps (Phase 2):**
- [ ] Core UI system migration (Button, Dialog, Tabs, etc.)
- [ ] Design system implementation
- [ ] Animation system setup
- [ ] Icon system migration

## Dependencies

### Core Framework
- `flutter_riverpod` - State management
- `go_router` - Navigation
- `window_manager` - Desktop window controls

### Database & Storage
- `drift` - SQLite ORM for Flutter
- `sqlite3_flutter_libs` - SQLite libraries
- `path_provider` - System path access

### UI & Animation
- `flutter_animate` - Animation library
- `lucide_icons` - Icon library

### Development Tools
- `build_runner` - Code generation
- `drift_dev` - Drift code generation
- `freezed` - Immutable classes generation
- `json_serializable` - JSON serialization

## Architecture Notes

- **State Management**: Using Riverpod for reactive state management
- **Database**: Drift for type-safe SQLite operations
- **UI**: Material 3 design with custom theming
- **Window Management**: Custom titlebar and window controls for desktop
- **Code Generation**: Freezed for data models, JSON serialization

## Platform Support

- ✅ macOS
- ✅ Linux  
- ✅ Windows
- 🚧 Web (future consideration)
- 🚧 Mobile (future consideration)