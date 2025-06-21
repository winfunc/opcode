# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claudia is a desktop application that provides a GUI wrapper and enhancement tool for Claude Code CLI. It's built with a hybrid architecture using React/TypeScript for the frontend and Rust/Tauri for the backend.

## Essential Commands

### Development
```bash
# Install dependencies
bun install

# Start development (hot reload for both frontend and backend)
bun run tauri dev

# Run frontend only (Vite dev server on port 1420)
bun run dev

# Type checking
bunx tsc --noEmit
```

### Building
```bash
# Production build (creates platform-specific installers)
bun run tauri build

# Debug build
bun run tauri build --debug

# Build without bundling (just executable)
bun run tauri build --no-bundle

# macOS universal binary
bun run tauri build --target universal-apple-darwin
```

### Testing & Code Quality
```bash
# Run Rust tests
cd src-tauri && cargo test

# Format Rust code
cd src-tauri && cargo fmt
```

## Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite 6 + Tailwind CSS v4 + shadcn/ui
- **Backend**: Rust with Tauri 2 framework
- **Database**: SQLite (via rusqlite) for local data storage
- **IPC**: Type-safe Tauri commands (176 registered commands)

### Key Architectural Components

1. **Security Sandboxing System** (`src-tauri/src/sandbox/`)
   - OS-level sandboxing (seccomp on Linux, Seatbelt on macOS)
   - Granular permission profiles for agent execution
   - Violation tracking and audit logging

2. **Agent Management** (`src-tauri/src/commands/agent.rs`)
   - Custom AI agents with configurable system prompts
   - Secure execution environment
   - Real-time metrics and execution history

3. **Checkpoint/Timeline System** (`src-tauri/src/checkpoint/`)
   - Version control-like checkpointing for Claude sessions
   - Branching and forking capabilities
   - Diff viewing between checkpoints

4. **MCP Integration** (`src-tauri/src/commands/mcp.rs`)
   - Model Context Protocol server management
   - Import/export capabilities
   - Connection testing

### Frontend Structure
- `src/components/` - UI components organized by feature
- `src/lib/` - Shared utilities and Tauri API client
- Component state managed locally with React hooks
- All backend communication through `src/lib/api.ts`

### Backend Structure
- `src-tauri/src/commands/` - Tauri IPC command handlers
- `src-tauri/src/sandbox/` - Security sandboxing implementation
- `src-tauri/src/checkpoint/` - Timeline/versioning management
- `src-tauri/src/process/` - Process management utilities

## Important Notes

- The application requires Claude Code CLI to be installed and accessible
- All Tauri commands are async and use the Tokio runtime
- Frontend-backend communication is strictly through defined IPC commands
- The sandbox system is critical for security - changes require thorough testing
- Database operations use SQLite with rusqlite bindings