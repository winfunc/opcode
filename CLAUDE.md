# Claudia - Claude Code GUI Toolkit Development Guide

## 📋 Project Overview

**Claudia** is a powerful desktop application that transforms how you interact with Claude Code. Built with Tauri 2, it provides a beautiful GUI for managing your Claude Code sessions, creating custom agents, tracking usage, and much more.

- **Project Type**: Desktop Application (Tauri-based)
- **Primary Languages**: Rust (Backend), TypeScript/React (Frontend)
- **Architecture**: Client-side desktop app with local data storage
- **Target Users**: Developers using Claude Code CLI who want a visual interface

### Key Technologies
- **Frontend**: React 18 + TypeScript + Vite 6 + Tailwind CSS v4 + shadcn/ui
- **Backend**: Rust with Tauri 2
- **Database**: SQLite (via rusqlite) 
- **Package Manager**: Bun
- **Build System**: Tauri 2 with Cargo (Rust) and Bun (Frontend)

## 🎯 Core Features & Functionality

### 🗂️ Project & Session Management
- Visual project browser for `~/.claude/projects/`
- Session history with full context restoration
- Smart search for projects and sessions
- Session insights with metadata display

### 🤖 CC Agents (Custom Claude Agents)
- Create specialized agents with custom system prompts
- Agent library management with execution history
- Background agent execution in separate processes
- Performance metrics and detailed logs

### 📊 Usage Analytics Dashboard
- Real-time Claude API usage and cost tracking
- Token analytics by model, project, and time period
- Visual charts showing usage trends
- Data export capabilities for accounting

### 🔌 MCP Server Management
- Model Context Protocol server registry
- UI-based server configuration and testing
- Claude Desktop configuration import
- Connection health monitoring

### ⏰ Timeline & Checkpoints
- Session versioning with checkpoint creation
- Visual timeline navigation with branching
- Instant checkpoint restoration
- Session forking and diff viewing

### 📝 CLAUDE.md Management
- Built-in markdown editor with live preview
- Project-wide CLAUDE.md file scanning
- Syntax highlighting and real-time rendering

## 🏗️ Project Structure

```
claudia/
├── src/                     # React frontend application
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Base UI primitives (shadcn/ui)
│   │   ├── AgentExecution.tsx
│   │   ├── ClaudeCodeSession.tsx
│   │   ├── MCPManager.tsx
│   │   ├── Settings.tsx
│   │   └── UsageDashboard.tsx
│   ├── lib/                # Utilities and API client
│   │   ├── api.ts          # Tauri backend communication
│   │   └── utils.ts        # Helper functions
│   └── assets/             # Static assets
├── src-tauri/              # Rust backend (Tauri)
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   │   ├── agents.rs   # Agent management
│   │   │   ├── claude.rs   # Claude CLI integration
│   │   │   ├── storage.rs  # Database operations
│   │   │   └── usage.rs    # Usage tracking
│   │   ├── checkpoint/     # Session timeline management
│   │   └── process/        # Background process management
│   └── Cargo.toml         # Rust dependencies
├── scripts/               # Build and automation scripts
├── cc_agents/            # Pre-built agent configurations
└── public/               # Static web assets
```

## 🛠️ Development Environment Setup

### Prerequisites
1. **Rust** (1.70.0+): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. **Bun** (latest): `curl -fsSL https://bun.sh/install | bash`
3. **Claude Code CLI**: Download from [claude.ai/code](https://claude.ai/code)
4. **Git**: For version control

### Platform-Specific Dependencies

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libxdo-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev
```

**macOS**:
```bash
xcode-select --install
brew install pkg-config  # optional
```

**Windows**:
- Install Microsoft C++ Build Tools
- Install WebView2 (pre-installed on Windows 11)

### Development Setup
```bash
# Clone repository
git clone https://github.com/getAsterisk/claudia.git
cd claudia

# Install frontend dependencies
bun install

# Start development server (includes frontend + Tauri backend)
bun run tauri dev

# Alternative: Frontend only
bun run dev
```

## 🔧 Development Guidelines

### Code Organization Principles
- **Frontend**: React components with TypeScript, following functional component patterns
- **Backend**: Rust modules with clear separation of concerns
- **State Management**: React hooks for frontend, Tauri state management for backend
- **Data Flow**: Frontend communicates with Rust backend via Tauri's invoke API

### Key Development Patterns

#### Frontend Development
- Use TypeScript for all React components
- Implement error boundaries for robust UI
- Follow shadcn/ui patterns for consistent styling
- Use Tailwind CSS for styling with design system consistency
- Implement proper loading states and error handling

#### Backend Development (Rust)
- Organize code into logical modules under `src-tauri/src/commands/`
- Use `#[tauri::command]` for frontend-callable functions
- Implement proper error handling with Result types
- Use SQLite for local data persistence
- Follow Rust best practices for memory safety

#### Inter-Process Communication
- Frontend calls backend via `invoke<T>(command, args)`
- Backend functions marked with `#[tauri::command]`
- Use proper serialization/deserialization with serde
- Handle async operations properly

### Testing Strategy
```bash
# Frontend type checking
bunx tsc --noEmit

# Rust tests
cd src-tauri && cargo test

# Format Rust code
cd src-tauri && cargo fmt
```

## 🚀 Build and Deployment

### Development Build
```bash
bun run tauri dev          # Hot reload development
```

### Production Build
```bash
bun run tauri build        # Creates installers in src-tauri/target/release/bundle/
bun run tauri build --debug  # Debug build (faster compilation)
```

### Build Outputs
- **Linux**: `.deb`, `.AppImage`
- **macOS**: `.dmg`, `.app`
- **Windows**: `.msi`, `.exe`

## 📊 Database Schema & Data Management

### SQLite Schema
- **agents**: Custom agent configurations
- **agent_runs**: Execution history and metrics
- **app_settings**: Application configuration

### Data Storage Locations
- **User Data**: `~/.claude/` directory
- **Project Data**: `~/.claude/projects/`
- **Settings**: `~/.claude/settings.json`
- **Application Database**: Local SQLite in app data directory

## 🔌 Integration Points

### Claude Code CLI Integration
- Automatic binary detection and version management
- Process management for background executions
- Session resumption and state persistence
- Real-time output streaming and capture

### MCP Server Integration
- Dynamic server registration and management
- Configuration import from Claude Desktop
- Connection testing and health monitoring
- Protocol compliance validation

### File System Integration
- Project directory scanning and indexing
- CLAUDE.md file discovery and management
- Session transcript storage and retrieval
- Checkpoint creation and restoration

## 🛡️ Security Considerations

### Local Data Security
- All data stored locally on user machine
- No telemetry or data collection
- Secure handling of Claude API credentials
- Process isolation for agent executions

### Permission Management
- Configurable agent permissions per execution
- File system access controls
- Network access restrictions
- Safe command execution practices

## 🐛 Common Development Issues & Solutions

### Build Issues
1. **"cargo not found"**: Ensure Rust installed and `~/.cargo/bin` in PATH
2. **"webkit2gtk not found"**: Install required Linux dependencies
3. **"MSVC not found"**: Install Visual Studio Build Tools on Windows
4. **"claude command not found"**: Install Claude Code CLI

### Runtime Issues
1. **Settings not loading**: Check `~/.claude/settings.json` exists and is valid
2. **Agent execution fails**: Verify Claude CLI installation and permissions
3. **Database errors**: Check SQLite file permissions and disk space
4. **MCP connection issues**: Validate server configurations and network access

## 📈 Performance Optimization

### Frontend Performance
- Implement virtual scrolling for large lists
- Use React.memo for expensive components
- Optimize bundle size with code splitting
- Implement proper caching strategies

### Backend Performance
- Use async/await for I/O operations
- Implement connection pooling for database
- Cache frequently accessed data
- Optimize SQLite queries with proper indexing

## 🤝 Contributing Guidelines

### Code Style
- **Rust**: Follow `rustfmt` formatting
- **TypeScript**: Use Prettier with project config
- **Commits**: Follow conventional commit format
- **PRs**: Include tests and documentation updates

### Development Workflow
1. Fork repository and create feature branch
2. Implement changes with proper testing
3. Run linting and type checking
4. Update documentation as needed
5. Submit PR with clear description

### Areas for Contribution
- 🐛 Bug fixes and improvements
- ✨ New features and enhancements
- 📚 Documentation improvements
- 🎨 UI/UX enhancements
- 🧪 Test coverage expansion
- 🌐 Internationalization support

## 📝 Claude Code Specific Guidelines

When working on this project with Claude Code:

### Essential Context
- This is a **desktop application** built with Tauri 2
- **Primary codebase**: Frontend (React/TS) + Backend (Rust)
- **Key integration**: Claude Code CLI for AI assistant functionality
- **Data persistence**: Local SQLite database + file system

### Development Priorities
1. **Cross-platform compatibility** - ensure features work on Windows, macOS, Linux
2. **Performance** - desktop app should be responsive and efficient
3. **User experience** - intuitive GUI for Claude Code power users
4. **Data safety** - reliable local storage and backup capabilities
5. **Integration robustness** - handle Claude CLI updates and changes gracefully

### Code Quality Standards
- Implement proper error handling for both Rust and TypeScript
- Use TypeScript strictly (no `any` types without justification)
- Follow Rust ownership and borrowing principles
- Implement comprehensive logging for debugging
- Create automated tests for critical functionality

### Architecture Considerations
- **Frontend-Backend Communication**: Use Tauri's invoke API efficiently
- **State Management**: Prefer React hooks, avoid complex state libraries unless necessary
- **Database Operations**: Use transactions for data consistency
- **File Operations**: Handle permissions and cross-platform path differences
- **Process Management**: Ensure proper cleanup of background processes

---

*This guide is tailored specifically for Claudia development and should be updated as the project evolves. For general Claude Code best practices, see the standard CLAUDE.md template.*