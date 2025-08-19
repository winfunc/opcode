# Claudia Server

A standalone TypeScript server for Claude Code integration that provides HTTP REST API and WebSocket streaming capabilities.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [WebSocket API](#websocket-api)
- [Configuration](#configuration)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Overview

Claudia Server extracts the core Claude Code integration functionality from the original Claudia desktop application and provides it as a standalone TypeScript/Node.js server. This allows you to integrate Claude Code into any application using standard HTTP and WebSocket protocols.

The server wraps the Claude Code CLI and provides:
- RESTful API for Claude Code operations
- Real-time streaming via WebSocket
- Project and session management
- CLAUDE.md file management
- Process monitoring and control

## Features

- 🚀 **HTTP REST API** - Standard REST endpoints for all Claude operations
- 📡 **WebSocket Streaming** - Real-time streaming of Claude responses
- 🗂️ **Project Management** - Full project and session management
- 📝 **CLAUDE.md Support** - Read/write CLAUDE.md files
- 🔄 **Session Control** - Start, continue, resume, and cancel Claude sessions
- 🏠 **Auto-Discovery** - Automatically finds Claude binary installation
- 🔐 **Process Management** - Track and manage running Claude processes
- 📊 **Health Monitoring** - Health checks and server status endpoints

## Installation

### Prerequisites

- Node.js 18.0.0 or later
- Claude Code CLI installed and available in PATH
- TypeScript (for development)

### Install Dependencies

```bash
cd claudia-server
npm install
```

### Build

```bash
npm run build
```

## Quick Start

### Start the Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build && npm start

# Or using the CLI
./dist/index.js --port 3000 --host localhost
```

### Verify Installation

```bash
# Check server health
curl http://localhost:3000/api/status/health

# Check Claude version
curl http://localhost:3000/api/claude/version
```

## API Reference

### Base URL

All API endpoints are prefixed with `/api`:
- `http://localhost:3000/api`

### Authentication

Currently, no authentication is required. All endpoints are publicly accessible.

### Response Format

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { /* response data */ },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "details": { /* optional error details */ }
}
```

### Status Endpoints

#### Health Check
```http
GET /api/status/health
```

Returns server health status and basic metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 3600,
    "memory": {
      "rss": 50331648,
      "heapTotal": 20971520,
      "heapUsed": 15728640
    },
    "version": "v18.17.0"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Server Info
```http
GET /api/status/info
```

Returns detailed server information.

#### Home Directory
```http
GET /api/status/home
```

Returns user home directory and Claude directory paths.

### Claude Endpoints

#### Check Claude Version
```http
GET /api/claude/version
```

Check if Claude Code is installed and get version information.

**Response:**
```json
{
  "success": true,
  "data": {
    "is_installed": true,
    "version": "0.8.0",
    "output": "claude 0.8.0"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Execute Claude Code
```http
POST /api/claude/execute
```

Start a new Claude Code session with the given prompt.

**Request Body:**
```json
{
  "project_path": "/path/to/your/project",
  "prompt": "Help me refactor this code",
  "model": "claude-3-5-sonnet-20241022"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Continue Claude Conversation
```http
POST /api/claude/continue
```

Continue an existing Claude Code conversation in the current project.

**Request Body:**
```json
{
  "project_path": "/path/to/your/project",
  "prompt": "Can you also add error handling?",
  "model": "claude-3-5-sonnet-20241022"
}
```

#### Resume Claude Session
```http
POST /api/claude/resume
```

Resume a specific Claude Code session by ID.

**Request Body:**
```json
{
  "project_path": "/path/to/your/project",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "prompt": "Continue from where we left off",
  "model": "claude-3-5-sonnet-20241022"
}
```

#### Cancel Claude Session
```http
POST /api/claude/cancel/{sessionId}
```

Cancel a running Claude Code session.

**Response:**
```json
{
  "success": true,
  "data": {
    "cancelled": true,
    "session_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### List Running Sessions
```http
GET /api/claude/sessions/running
```

Get list of currently running Claude sessions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "run_id": 1704110400000,
      "process_type": {
        "ClaudeSession": {
          "session_id": "550e8400-e29b-41d4-a716-446655440000"
        }
      },
      "pid": 12345,
      "started_at": "2024-01-01T12:00:00.000Z",
      "project_path": "/path/to/project",
      "task": "Help me refactor this code",
      "model": "claude-3-5-sonnet-20241022"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Get Session Info
```http
GET /api/claude/sessions/{sessionId}
```

Get information about a specific session.

#### Get Session History
```http
GET /api/claude/sessions/{sessionId}/history
```

Get the complete history/output for a session.

### Project Endpoints

#### List Projects
```http
GET /api/projects
```

List all Claude projects from `~/.claude/projects/`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "-Users-username-dev-myproject",
      "path": "/Users/username/dev/myproject",
      "sessions": ["550e8400-e29b-41d4-a716-446655440000"],
      "created_at": 1704110400,
      "most_recent_session": 1704110400
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Create Project
```http
POST /api/projects
```

Create a new project for the given path.

**Request Body:**
```json
{
  "path": "/path/to/your/project"
}
```

#### Get Project Sessions
```http
GET /api/projects/{projectId}/sessions
```

Get all sessions for a specific project.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "project_id": "-Users-username-dev-myproject",
      "project_path": "/Users/username/dev/myproject",
      "created_at": 1704110400,
      "first_message": "Help me refactor this code",
      "message_timestamp": "2024-01-01T12:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Find CLAUDE.md Files
```http
GET /api/projects/{projectId}/claude-files
```

Find all CLAUDE.md files in a project.

#### Read CLAUDE.md File
```http
GET /api/projects/claude-file?path=/path/to/CLAUDE.md
```

Read the content of a CLAUDE.md file.

#### Save CLAUDE.md File
```http
PUT /api/projects/claude-file
```

Save content to a CLAUDE.md file.

**Request Body:**
```json
{
  "path": "/path/to/CLAUDE.md",
  "content": "# Project Instructions\\n\\nThis is my project..."
}
```

#### List Directory Contents
```http
GET /api/projects/directory?path=/path/to/directory
```

List contents of a directory.

## WebSocket API

### Connection

Connect to the WebSocket endpoint:
```
ws://localhost:3000/ws
```

### Message Format

All WebSocket messages follow this format:

```json
{
  "type": "message_type",
  "data": { /* message data */ },
  "session_id": "optional_session_id",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Client Messages

#### Subscribe to Session
```json
{
  "type": "subscribe",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Unsubscribe from Session
```json
{
  "type": "unsubscribe",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Server Messages

#### Connection Status
```json
{
  "type": "status",
  "data": {
    "status": "connected",
    "client_id": "client_1704110400000_abc123"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Claude Stream Messages
```json
{
  "type": "claude_stream",
  "data": {
    "type": "partial",
    "content": "I'll help you refactor that code...",
    "role": "assistant",
    "timestamp": "2024-01-01T12:00:00.000Z"
  },
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Error Messages
```json
{
  "type": "error",
  "data": {
    "error": "Error message",
    "details": {}
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Configuration

### Command Line Options

```bash
claudia-server [options]

Options:
  -p, --port <port>           Server port (default: 3000)
  -h, --host <host>           Server host (default: 0.0.0.0)
  --claude-binary <path>      Path to Claude binary
  --claude-home <path>        Path to Claude home directory
  --help                      Show help message
  --version                   Show version number
```

### Environment Variables

- `PORT` - Server port
- `HOST` - Server host
- `CLAUDE_BINARY` - Path to Claude binary
- `CLAUDE_HOME` - Path to Claude home directory

### Configuration Object

You can also configure the server programmatically:

```typescript
import { ClaudiaServer } from './server.js';

const server = new ClaudiaServer({
  port: 3000,
  host: '0.0.0.0',
  cors_origin: ['http://localhost:3000'],
  max_concurrent_sessions: 10,
  session_timeout_ms: 300000,
  claude_binary_path: '/usr/local/bin/claude',
  claude_home_dir: '/custom/claude/home',
});

await server.start();
```

## Examples

### Basic Usage with curl

```bash
# Start a new Claude session
curl -X POST http://localhost:3000/api/claude/execute \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_path": "/path/to/project",
    "prompt": "Help me write a REST API",
    "model": "claude-3-5-sonnet-20241022"
  }'

# List running sessions
curl http://localhost:3000/api/claude/sessions/running

# Get session history
curl http://localhost:3000/api/claude/sessions/550e8400-e29b-41d4-a716-446655440000/history
```

### JavaScript Client Example

```javascript
// HTTP API usage
const response = await fetch('http://localhost:3000/api/claude/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project_path: '/path/to/project',
    prompt: 'Help me with this code',
    model: 'claude-3-5-sonnet-20241022'
  })
});

const result = await response.json();
const sessionId = result.data.session_id;

// WebSocket usage for real-time streaming
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  // Subscribe to session updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    session_id: sessionId
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'claude_stream') {
    console.log('Claude response:', message.data.content);
  }
};
```

### Python Client Example

```python
import requests
import websocket
import json

# HTTP API usage
response = requests.post('http://localhost:3000/api/claude/execute', json={
    'project_path': '/path/to/project',
    'prompt': 'Help me with this code',
    'model': 'claude-3-5-sonnet-20241022'
})

session_id = response.json()['data']['session_id']

# WebSocket usage
def on_message(ws, message):
    data = json.loads(message)
    if data['type'] == 'claude_stream':
        print(f"Claude: {data['data']['content']}")

def on_open(ws):
    # Subscribe to session
    ws.send(json.dumps({
        'type': 'subscribe',
        'session_id': session_id
    }))

ws = websocket.WebSocketApp('ws://localhost:3000/ws',
                          on_message=on_message,
                          on_open=on_open)
ws.run_forever()
```

## Troubleshooting

### Common Issues

#### Claude Binary Not Found
```
Error: Claude binary not found. Please install Claude Code CLI.
```

**Solution:** Install Claude Code CLI and ensure it's in your PATH, or specify the path with `--claude-binary`.

#### Permission Denied
```
Error: EACCES: permission denied, spawn claude
```

**Solution:** Ensure the Claude binary has execute permissions:
```bash
chmod +x /path/to/claude
```

#### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:** Use a different port:
```bash
claudia-server --port 3001
```

#### WebSocket Connection Failed
**Solution:** Check that the server is running and the WebSocket endpoint is accessible. Ensure firewalls aren't blocking the connection.

### Debug Mode

Set `NODE_ENV=development` for more detailed error messages and logging:

```bash
NODE_ENV=development claudia-server
```

### Logs

The server uses Morgan for HTTP request logging and console logging for application events. All logs go to stdout/stderr.

### Health Checks

Use the health endpoint to verify the server is running:

```bash
curl http://localhost:3000/api/status/health
```

---

For more information and updates, visit the [Claudia GitHub repository](https://github.com/getAsterisk/claudia).