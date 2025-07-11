# Claudia API Implementation Status

This document tracks the implementation status of all API endpoints required for the web GUI and iOS app.

## Overview

The web server (`web-server.js`) needs to implement all the endpoints that the Tauri backend provides, so that:
1. The web GUI can function completely without Tauri
2. The iOS app can use the same API endpoints via a remote backend

## Implementation Status

### ✅ Implemented Endpoints

1. **Health Check**
   - `GET /api/health` - Basic health check endpoint
   - Status: ✅ Fully implemented

2. **Project Management**
   - `GET /api/projects` - List all Claude projects
   - Status: ✅ Implemented (reads from ~/.claude/projects)
   - `GET /api/projects/:id/sessions` - Get sessions for a project
   - Status: ✅ Implemented (reads JSONL files)

3. **Agent Management (Mock)**
   - `GET /api/agents` - List agents
   - Status: ⚠️ Mock implementation only (returns hardcoded data)

4. **Running Sessions**
   - `GET /api/running-sessions` - List running agent sessions
   - Status: ⚠️ Returns empty array (no real implementation)
   - `GET /api/running-claude-sessions` - List running Claude sessions
   - Status: ⚠️ Returns empty array (no real implementation)

### ❌ Missing Endpoints

#### Claude Code Execution (Critical)
- `POST /api/claude/execute` - Start new Claude session
- `POST /api/claude/continue` - Continue existing session
- `POST /api/claude/resume` - Resume session by ID
- `POST /api/claude/cancel` - Cancel running session
- `GET /api/claude/status/:session_id` - Get session output

#### Agent Management (Complete Implementation)
- `POST /api/agents` - Create agent
- `GET /api/agents/:id` - Get single agent
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent
- `POST /api/agents/:id/execute` - Execute agent
- `GET /api/agents/:id/runs` - List agent runs
- `GET /api/agent-runs/:id` - Get single run
- `POST /api/agent-sessions/:id/kill` - Kill running session
- `GET /api/agent-sessions/:id/output` - Get session output
- `POST /api/agents/export/:id` - Export agent
- `POST /api/agents/import` - Import agent

#### Usage Analytics
- `GET /api/usage/stats` - Overall usage statistics
- `GET /api/usage/details` - Detailed usage entries
- `GET /api/usage/date-range` - Usage by date range
- `GET /api/usage/session/:id/stats` - Session-specific stats

#### Timeline & Checkpoints
- `POST /api/checkpoints` - Create checkpoint
- `POST /api/checkpoints/restore` - Restore checkpoint
- `GET /api/sessions/:id/checkpoints` - List checkpoints
- `POST /api/checkpoints/fork` - Fork from checkpoint
- `GET /api/sessions/:id/timeline` - Get session timeline
- `POST /api/checkpoint-settings` - Update settings
- `GET /api/checkpoints/diff` - Get diff between checkpoints

#### MCP Server Management
- `GET /api/mcp/servers` - List MCP servers
- `POST /api/mcp/servers` - Add MCP server
- `GET /api/mcp/servers/:name` - Get server details
- `DELETE /api/mcp/servers/:name` - Remove server
- `POST /api/mcp/test` - Test server connection
- `POST /api/mcp/import` - Import servers
- `POST /api/mcp/import-claude-desktop` - Import from Claude Desktop

#### Slash Commands
- `GET /api/slash-commands` - List slash commands
- `POST /api/slash-commands` - Create slash command
- `PUT /api/slash-commands/:id` - Update slash command
- `DELETE /api/slash-commands/:id` - Delete slash command
- `POST /api/slash-commands/execute` - Execute slash command

#### File System Operations
- `GET /api/fs/list` - List directory contents
- `GET /api/fs/search` - Search files
- `GET /api/claude-md/find` - Find CLAUDE.md files
- `GET /api/claude-md/read` - Read CLAUDE.md file
- `PUT /api/claude-md/save` - Save CLAUDE.md file

#### Settings
- `GET /api/settings/claude` - Get Claude settings
- `PUT /api/settings/claude` - Save Claude settings
- `GET /api/settings/system-prompt` - Get system prompt
- `PUT /api/settings/system-prompt` - Save system prompt

#### Session History
- `GET /api/sessions/:projectId/:sessionId/history` - Load session history
- `GET /api/agent-sessions/:sessionId/history` - Load agent session history

#### System Status
- `GET /api/claude/version` - Check Claude installation
- `GET /api/claude/installations` - Find Claude installations

### WebSocket Events

The WebSocket server needs to emit these events:
- `process-output` - Real-time output from Claude/agents
- `process-completed` - When a process finishes
- `process-failed` - When a process fails
- `checkpoint-created` - When a checkpoint is created
- `usage-updated` - When usage stats change

## Architecture for Remote Backend

For the iOS app to work, we need a backend server that can:

1. **Run Claude Code Sessions**
   - Execute `claude` CLI commands on the server
   - Stream output via WebSocket
   - Manage session state

2. **Persistent Storage**
   - SQLite database for agents, usage stats, etc.
   - File system access for projects and sessions
   - Checkpoint storage

3. **Authentication & Security**
   - User authentication (API keys or OAuth)
   - Project isolation between users
   - Secure execution environment

4. **Scalability Considerations**
   - Session pooling for Claude processes
   - Queue management for execution requests
   - Resource limits per user

## Implementation Priority

1. **Phase 1: Core Functionality**
   - Claude Code execution endpoints
   - Agent creation and execution
   - Basic file system operations

2. **Phase 2: Data Management**
   - Usage analytics
   - Session history
   - Settings management

3. **Phase 3: Advanced Features**
   - Timeline & checkpoints
   - MCP server management
   - Slash commands

4. **Phase 4: Production Ready**
   - Authentication
   - Multi-user support
   - Deployment configuration

## Next Steps

1. Implement missing endpoints in `web-server.js`
2. Add SQLite database for persistent storage
3. Implement Claude Code execution with process management
4. Add WebSocket event streaming
5. Create integration tests for all endpoints
6. Deploy backend server for iOS testing