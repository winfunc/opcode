# Claudia API Documentation

Welcome to the comprehensive API documentation for Claudia, the powerful desktop GUI for Claude Code.

## 📚 Documentation Structure

### Core API Guides
- [**API Overview & Getting Started**](./api-overview.md) - Introduction to the Claudia API system
- [**Project Management API**](./project-management-api.md) - Manage Claude Code projects and sessions
- [**Session Management API**](./session-management-api.md) - Execute and interact with Claude Code sessions
- [**Agent Management API**](./agent-management-api.md) - Create, manage, and execute custom AI agents
- [**MCP Server API**](./mcp-server-api.md) - Manage Model Context Protocol servers
- [**Usage Analytics API**](./usage-analytics-api.md) - Track token usage and costs
- [**Checkpoint System API**](./checkpoint-system-api.md) - Session versioning and timeline management

### Reference Documentation
- [**Data Types Reference**](./data-types.md) - Complete type definitions and interfaces
- [**Error Handling**](./error-handling.md) - Error patterns and best practices
- [**Code Examples**](./examples.md) - Practical usage examples and patterns

## 🚀 Quick Start

```typescript
import { api } from '@/lib/api';

// List all Claude Code projects
const projects = await api.listProjects();

// Create a new agent
const agent = await api.createAgent(
  'My Agent',
  'bot',
  'You are a helpful coding assistant.',
  'Help with code review',
  'sonnet'
);

// Execute the agent on a project
const runId = await api.executeAgent(
  agent.id!,
  '/path/to/project',
  'Review the code for potential improvements'
);
```

## 🏗️ Architecture Overview

Claudia uses a **React frontend** with **Rust (Tauri) backend** architecture:

- **Frontend API Client** (`src/lib/api.ts`) - TypeScript interface to backend
- **Backend Commands** (`src-tauri/src/commands/`) - Rust Tauri command handlers
- **Type Safety** - Full TypeScript types for all API interactions
- **Real-time Updates** - Event-driven updates via Tauri's event system

## 📖 API Categories

| Category | Methods | Description |
|----------|---------|-------------|
| **Projects** | 16 methods | Claude Code project discovery and management |
| **Sessions** | 10 methods | Interactive Claude Code session execution |
| **Agents** | 18 methods | Custom AI agent creation and execution |
| **Checkpoints** | 15 methods | Session state management and versioning |
| **MCP** | 15 methods | Model Context Protocol server integration |
| **Usage** | 5 methods | Token usage analytics and cost tracking |

## 🔗 Integration Points

- **Claude Code CLI** - Direct integration with Anthropic's official CLI
- **SQLite Database** - Local storage for agents, runs, and metadata
- **File System** - Project and session file management
- **GitHub API** - Agent sharing and community features
- **Process Management** - Background execution of Claude sessions and agents

## 🛠️ Development

All API methods are available through the centralized `api` object exported from `src/lib/api.ts`. The API provides:

- **Full TypeScript support** with comprehensive type definitions
- **Error handling** with meaningful error messages
- **Async/await patterns** for all operations
- **Real-time streaming** for session output
- **Event-driven updates** for UI reactivity

---

**Next**: Start with the [API Overview & Getting Started](./api-overview.md) guide.