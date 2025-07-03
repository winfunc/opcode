# API Overview & Getting Started

This guide provides an introduction to the Claudia API system and how to use it for building integrations or extending Claudia's functionality.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [API Access](#api-access)
- [Authentication & Setup](#authentication--setup)
- [Basic Usage Patterns](#basic-usage-patterns)
- [Error Handling](#error-handling)
- [Real-time Updates](#real-time-updates)
- [Best Practices](#best-practices)

## Architecture Overview

Claudia uses a **dual-layer architecture** for maximum performance and type safety:

```
┌─────────────────────┐    TypeScript API     ┌──────────────────────┐
│   React Frontend    │ ◄─────────────────► │   Rust Backend       │
│                     │                       │                      │
│ • Components        │    Tauri Commands     │ • Command Handlers   │
│ • UI Logic          │ ◄─────────────────► │ • Business Logic     │
│ • API Client        │                       │ • Database Access    │
│                     │    Event System       │ • Process Management │
└─────────────────────┘ ◄─────────────────► └──────────────────────┘
```

### Frontend Layer (`src/lib/api.ts`)
- **TypeScript API Client** with full type safety
- **100+ methods** organized by functionality
- **Comprehensive error handling** with meaningful messages
- **Real-time event handling** for live updates

### Backend Layer (`src-tauri/src/commands/`)
- **Rust command handlers** for system operations
- **SQLite database** for local data persistence
- **Process management** for Claude Code and agent execution
- **File system operations** with proper sandboxing

## API Access

All API functionality is accessed through the centralized `api` object:

```typescript
import { api } from '@/lib/api';

// The api object provides access to all Claudia functionality
const projects = await api.listProjects();
```

### Available API Groups

| Group | Import | Description |
|-------|--------|-------------|
| **Projects** | `api.listProjects()` | Project discovery and management |
| **Sessions** | `api.executeClaudeCode()` | Claude Code session execution |
| **Agents** | `api.listAgents()` | Custom agent management |
| **Checkpoints** | `api.createCheckpoint()` | Session versioning |
| **MCP** | `api.mcpList()` | MCP server management |
| **Usage** | `api.getUsageStats()` | Analytics and cost tracking |

## Authentication & Setup

Claudia operates on the local machine and uses the system's Claude Code installation. No external authentication is required, but you need:

### Prerequisites
1. **Claude Code CLI** installed and accessible in PATH
2. **Valid Claude API key** configured in Claude Code
3. **Claudia running** with proper permissions

### Verifying Setup

```typescript
// Check if Claude Code is properly installed
const status = await api.checkClaudeVersion();
if (!status.is_installed) {
  console.error('Claude Code not found:', status.output);
  return;
}

// Get Claude settings to verify configuration
const settings = await api.getClaudeSettings();
console.log('Claude configured:', Object.keys(settings).length > 0);
```

## Basic Usage Patterns

### 1. Working with Projects

```typescript
// List all available projects
const projects = await api.listProjects();

// Get sessions for a specific project
const sessions = await api.getProjectSessions(projects[0].id);

// Find CLAUDE.md files in a project
const claudeFiles = await api.findClaudeMdFiles('/path/to/project');
```

### 2. Managing Agents

```typescript
// List existing agents
const agents = await api.listAgents();

// Create a new agent
const newAgent = await api.createAgent(
  'Code Reviewer',
  'shield',
  'You are an expert code reviewer. Analyze code for bugs, security issues, and improvements.',
  'Review the codebase for potential issues',
  'sonnet'
);

// Execute an agent
const runId = await api.executeAgent(
  newAgent.id!,
  '/path/to/project',
  'Please review the recent changes'
);
```

### 3. Session Management

```typescript
// Start a new Claude Code session
await api.executeClaudeCode(
  '/path/to/project',
  'Help me implement user authentication',
  'sonnet'
);

// Continue an existing conversation
await api.continueClaudeCode(
  '/path/to/project',
  'Add password reset functionality',
  'sonnet'
);

// Load session history
const history = await api.loadSessionHistory('session-uuid', 'project-id');
```

### 4. Real-time Monitoring

```typescript
// Get live output from a running session
const output = await api.getClaudeSessionOutput('session-id');

// Monitor agent execution
const agentRun = await api.getAgentRunWithRealTimeMetrics(runId);
console.log(`Status: ${agentRun.status}, Tokens: ${agentRun.metrics?.total_tokens}`);
```

## Error Handling

All API methods use **async/await** with proper error handling:

```typescript
try {
  const projects = await api.listProjects();
  // Handle success
} catch (error) {
  console.error('Failed to list projects:', error);
  // Handle error appropriately
}
```

### Common Error Types

| Error Type | Description | Resolution |
|------------|-------------|------------|
| **Claude Not Found** | Claude Code CLI not installed | Install Claude Code and ensure it's in PATH |
| **Permission Denied** | File system access restricted | Check file permissions and Tauri capabilities |
| **Process Failed** | Claude execution failed | Check logs and verify project configuration |
| **Database Error** | SQLite operation failed | Check disk space and database integrity |

## Real-time Updates

Claudia provides real-time updates through Tauri's event system:

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen for session output updates
const unlisten = await listen('claude-output', (event) => {
  console.log('New output:', event.payload);
});

// Listen for agent status changes
const unlistenAgent = await listen('agent-status-update', (event) => {
  console.log('Agent status:', event.payload);
});

// Clean up listeners when done
unlisten();
unlistenAgent();
```

### Available Events

| Event | Payload | Description |
|-------|---------|-------------|
| `claude-output` | `{ sessionId, content }` | New output from Claude session |
| `agent-status-update` | `{ runId, status }` | Agent execution status change |
| `process-started` | `{ processId, type }` | New process started |
| `process-finished` | `{ processId, exitCode }` | Process completed |

## Best Practices

### 1. Resource Management
```typescript
// Always clean up processes when done
try {
  const runId = await api.executeAgent(agentId, projectPath, task);
  // ... handle execution
} finally {
  // Kill if still running
  await api.killAgentSession(runId);
}
```

### 2. Error Recovery
```typescript
// Implement retry logic for transient failures
async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 3. Type Safety
```typescript
// Leverage TypeScript types for better development experience
import type { Agent, AgentRun, Project, Session } from '@/lib/api';

function processAgentRun(run: AgentRun): void {
  // TypeScript ensures all properties are properly typed
  console.log(`Agent ${run.agent_name} status: ${run.status}`);
}
```

### 4. Performance Optimization
```typescript
// Use pagination for large datasets
const runs = await api.listAgentRuns(); // Gets all runs
const recentRuns = runs.slice(0, 10); // Take only recent ones

// Cache frequently accessed data
const projectCache = new Map<string, Project>();
const getProject = async (id: string): Promise<Project> => {
  if (projectCache.has(id)) {
    return projectCache.get(id)!;
  }
  const projects = await api.listProjects();
  const project = projects.find(p => p.id === id);
  if (project) projectCache.set(id, project);
  return project!;
};
```

## Next Steps

Now that you understand the API basics, explore specific functionality:

- [**Project Management API**](./project-management-api.md) - Discover and manage Claude Code projects
- [**Agent Management API**](./agent-management-api.md) - Create and execute custom AI agents
- [**Session Management API**](./session-management-api.md) - Control Claude Code sessions
- [**Data Types Reference**](./data-types.md) - Complete type definitions

---

**Tip**: Use your IDE's IntelliSense with the TypeScript definitions for the best development experience. All API methods are fully typed with JSDoc documentation.