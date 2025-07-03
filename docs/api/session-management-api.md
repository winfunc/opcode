# Session Management API

The Session Management API provides functionality to execute, monitor, and interact with Claude Code sessions. This includes starting new conversations, continuing existing ones, and managing real-time session output.

## Table of Contents
- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Session Execution](#session-execution)
- [Session Monitoring](#session-monitoring)
- [Real-time Output](#real-time-output)
- [Process Management](#process-management)
- [Examples](#examples)

## Overview

Claude Code sessions are interactive conversations between users and Claude AI. The Session Management API provides programmatic control over these sessions, enabling you to:

- **Start new sessions** with custom prompts and models
- **Continue existing conversations** with additional messages
- **Resume specific sessions** by UUID
- **Monitor real-time output** with streaming capabilities
- **Manage running processes** for resource control

### Session Lifecycle
```
Start Session → Execute → Monitor Output → Continue/Resume → Complete
     ↓             ↓           ↓              ↓             ↓
 New Process   Running     Streaming      Active        Cleanup
```

## Core Concepts

### Session Types
- **New Session**: Fresh conversation with initial prompt
- **Continued Session**: Adding to the most recent conversation
- **Resumed Session**: Continuing a specific session by UUID

### Models
Sessions can use different Claude models:
- `claude-sonnet-4-20250514` (default)
- `claude-3-5-haiku-20241022`
- `claude-opus-4-20250514`

### Output Formats
- **JSONL**: Structured conversation logs
- **Live Stream**: Real-time stdout from Claude process
- **Cached Output**: Processed and stored session data

## Session Execution

### `executeClaudeCode(projectPath, prompt, model)`

Starts a new Claude Code session with the specified prompt.

```typescript
async executeClaudeCode(
  projectPath: string, 
  prompt: string, 
  model: string
): Promise<void>
```

**Parameters**:
- `projectPath` - Absolute path to the project directory
- `prompt` - Initial user message/prompt
- `model` - Claude model to use (e.g., 'sonnet', 'haiku', 'opus')

**Returns**: Promise that resolves when session starts

**Example**:
```typescript
// Start a new coding session
await api.executeClaudeCode(
  '/path/to/my/project',
  'Help me implement user authentication with JWT tokens',
  'sonnet'
);

// Session starts immediately and runs in background
console.log('Session started - use monitoring APIs to track progress');
```

**Behavior**:
- Creates a new session UUID
- Spawns Claude Code process in background
- Streams output via events
- Session continues until completion or cancellation

### `continueClaudeCode(projectPath, prompt, model)`

Continues the most recent conversation in the specified project.

```typescript
async continueClaudeCode(
  projectPath: string, 
  prompt: string, 
  model: string
): Promise<void>
```

**Parameters**: Same as `executeClaudeCode`

**Example**:
```typescript
// Continue the previous conversation
await api.continueClaudeCode(
  '/path/to/my/project',
  'Now add password reset functionality',
  'sonnet'
);
```

**Behavior**:
- Finds the most recent session in the project
- Adds new message to existing conversation
- Maintains conversation context and history

### `resumeClaudeCode(projectPath, sessionId, prompt, model)`

Resumes a specific session by its UUID.

```typescript
async resumeClaudeCode(
  projectPath: string, 
  sessionId: string, 
  prompt: string, 
  model: string
): Promise<void>
```

**Parameters**:
- `projectPath` - Project directory path
- `sessionId` - Specific session UUID to resume
- `prompt` - New message to add
- `model` - Model to use for the response

**Example**:
```typescript
// Resume a specific session
await api.resumeClaudeCode(
  '/path/to/my/project',
  'session-uuid-123',
  'Can you explain the implementation again?',
  'sonnet'
);
```

**Use Cases**:
- Return to earlier conversation branch
- Continue specific discussion thread
- Resume after checkpoint restoration

## Session Monitoring

### `listRunningClaudeSessions()`

Lists all currently active Claude Code sessions.

```typescript
async listRunningClaudeSessions(): Promise<any[]>
```

**Returns**: Array of running session information

**Example**:
```typescript
const runningSessions = await api.listRunningClaudeSessions();

runningSessions.forEach(session => {
  console.log(`Session: ${session.session_id}`);
  console.log(`Project: ${session.project_path}`);
  console.log(`Started: ${session.started_at}`);
  console.log(`PID: ${session.pid}`);
});
```

**Session Info Structure**:
```typescript
interface RunningSession {
  session_id: string;
  project_path: string;
  started_at: string;
  pid: number;
  model: string;
  status: 'running' | 'initializing' | 'completing';
}
```

### `cancelClaudeExecution(sessionId?)`

Cancels a running Claude Code session.

```typescript
async cancelClaudeExecution(sessionId?: string): Promise<void>
```

**Parameters**:
- `sessionId` - Optional specific session to cancel. If not provided, cancels all running sessions

**Example**:
```typescript
// Cancel specific session
await api.cancelClaudeExecution('session-uuid-123');

// Cancel all running sessions
await api.cancelClaudeExecution();
```

**Behavior**:
- Terminates Claude process gracefully
- Saves any partial output
- Cleans up system resources
- Updates session status to 'cancelled'

## Real-time Output

### `getClaudeSessionOutput(sessionId)`

Retrieves the current output from a running Claude session.

```typescript
async getClaudeSessionOutput(sessionId: string): Promise<string>
```

**Parameters**:
- `sessionId` - The session UUID to get output for

**Returns**: Current session output in JSONL format

**Example**:
```typescript
// Get current output
const output = await api.getClaudeSessionOutput('session-uuid-123');

// Parse JSONL format
const lines = output.split('\n').filter(line => line.trim());
const messages = lines.map(line => JSON.parse(line));

messages.forEach(message => {
  console.log(`${message.role}: ${message.content}`);
});
```

**Output Format**:
```jsonl
{"role": "user", "content": "Help me implement authentication", "timestamp": "2024-01-01T10:00:00Z"}
{"role": "assistant", "content": "I'll help you implement JWT authentication...", "timestamp": "2024-01-01T10:00:05Z"}
```

### Event-Driven Updates

Sessions emit real-time events for live monitoring:

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen for session output updates
const unlisten = await listen('claude-output', (event) => {
  const { sessionId, content } = event.payload;
  console.log(`New output from ${sessionId}:`, content);
});

// Listen for session status changes
const unlistenStatus = await listen('claude-status', (event) => {
  const { sessionId, status } = event.payload;
  console.log(`Session ${sessionId} status: ${status}`);
});
```

**Available Events**:
- `claude-output` - New content from session
- `claude-status` - Session status changes
- `claude-error` - Error messages
- `claude-complete` - Session completion

## Process Management

### Process Information

Each Claude session runs as a separate system process for isolation and resource management.

```typescript
// Get process information for running sessions
const sessions = await api.listRunningClaudeSessions();

sessions.forEach(session => {
  console.log(`PID: ${session.pid}`);
  console.log(`Memory usage: ${session.memory_mb}MB`);
  console.log(`Runtime: ${session.runtime_seconds}s`);
});
```

### Resource Cleanup

```typescript
// Monitor and cleanup finished processes
setInterval(async () => {
  const cleanedUp = await api.cleanupFinishedProcesses();
  if (cleanedUp.length > 0) {
    console.log(`Cleaned up ${cleanedUp.length} finished processes`);
  }
}, 30000); // Check every 30 seconds
```

### Memory Management

```typescript
// Monitor session resource usage
async function monitorSessions() {
  const sessions = await api.listRunningClaudeSessions();
  
  for (const session of sessions) {
    if (session.memory_mb > 1000) { // More than 1GB
      console.warn(`High memory usage in session ${session.session_id}`);
      
      // Consider cancelling if necessary
      if (session.runtime_seconds > 3600) { // Running for 1+ hour
        await api.cancelClaudeExecution(session.session_id);
        console.log(`Cancelled long-running session ${session.session_id}`);
      }
    }
  }
}
```

## Examples

### Interactive Session Manager

```typescript
class SessionManager {
  private activeSessions = new Map<string, any>();
  private outputListeners = new Map<string, () => void>();

  async startSession(projectPath: string, prompt: string, model = 'sonnet') {
    console.log('🚀 Starting new session...');
    
    // Start the session
    await api.executeClaudeCode(projectPath, prompt, model);
    
    // Find the new session
    const sessions = await api.listRunningClaudeSessions();
    const newSession = sessions.find(s => s.project_path === projectPath);
    
    if (newSession) {
      this.activeSessions.set(newSession.session_id, newSession);
      await this.setupOutputMonitoring(newSession.session_id);
      return newSession.session_id;
    }
    
    throw new Error('Failed to start session');
  }

  async setupOutputMonitoring(sessionId: string) {
    const { listen } = await import('@tauri-apps/api/event');
    
    const unlisten = await listen('claude-output', (event: any) => {
      if (event.payload.sessionId === sessionId) {
        this.handleSessionOutput(sessionId, event.payload.content);
      }
    });
    
    this.outputListeners.set(sessionId, unlisten);
  }

  private handleSessionOutput(sessionId: string, content: string) {
    console.log(`📝 Session ${sessionId.slice(0, 8)}... output:`);
    
    // Parse JSONL and show latest message
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      try {
        const lastMessage = JSON.parse(lines[lines.length - 1]);
        if (lastMessage.role === 'assistant') {
          console.log('🤖 Claude:', lastMessage.content.slice(0, 100) + '...');
        }
      } catch (e) {
        // Ignore parsing errors for partial content
      }
    }
  }

  async continueSession(sessionId: string, prompt: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    console.log(`➡️ Continuing session ${sessionId.slice(0, 8)}...`);
    await api.resumeClaudeCode(
      session.project_path,
      sessionId,
      prompt,
      session.model
    );
  }

  async stopSession(sessionId: string) {
    console.log(`🛑 Stopping session ${sessionId.slice(0, 8)}...`);
    
    await api.cancelClaudeExecution(sessionId);
    
    // Cleanup listeners
    const unlisten = this.outputListeners.get(sessionId);
    if (unlisten) {
      unlisten();
      this.outputListeners.delete(sessionId);
    }
    
    this.activeSessions.delete(sessionId);
  }

  async cleanup() {
    // Stop all active sessions
    for (const sessionId of this.activeSessions.keys()) {
      await this.stopSession(sessionId);
    }
  }
}
```

### Batch Session Processor

```typescript
async function processBatchTasks(projectPath: string, tasks: string[]) {
  console.log(`Processing ${tasks.length} tasks in ${projectPath}`);
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`\n📋 Task ${i + 1}/${tasks.length}: ${task}`);
    
    // Start session for this task
    await api.executeClaudeCode(projectPath, task, 'sonnet');
    
    // Wait for completion
    let isRunning = true;
    while (isRunning) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const runningSessions = await api.listRunningClaudeSessions();
      const activeSession = runningSessions.find(s => s.project_path === projectPath);
      
      if (!activeSession) {
        isRunning = false;
        console.log('✅ Task completed');
      } else {
        // Show progress
        const output = await api.getClaudeSessionOutput(activeSession.session_id);
        const lines = output.split('\n').filter(line => line.trim());
        console.log(`   💭 Processing... (${lines.length} messages)`);
      }
    }
  }
  
  console.log('🎉 All tasks completed!');
}

// Usage
const tasks = [
  'Analyze the codebase structure',
  'Add comprehensive error handling',
  'Write unit tests for core functions',
  'Update documentation'
];

await processBatchTasks('/path/to/project', tasks);
```

### Session History Explorer

```typescript
async function exploreSessionHistory(projectPath: string) {
  // Get project info
  const projects = await api.listProjects();
  const project = projects.find(p => p.path === projectPath);
  
  if (!project) {
    console.log('❌ Project not found in Claude Code');
    return;
  }
  
  // Get all sessions
  const sessions = await api.getProjectSessions(project.id);
  console.log(`📚 Found ${sessions.length} sessions in project`);
  
  // Group sessions by date
  const sessionsByDate = sessions.reduce((acc, session) => {
    const date = new Date(session.created_at * 1000).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(session);
    return acc;
  }, {} as Record<string, typeof sessions>);
  
  // Show session history
  for (const [date, daySessions] of Object.entries(sessionsByDate)) {
    console.log(`\n📅 ${date} (${daySessions.length} sessions)`);
    
    for (const session of daySessions) {
      console.log(`   💬 ${session.id.slice(0, 8)}...`);
      
      if (session.first_message) {
        const preview = session.first_message.slice(0, 80) + '...';
        console.log(`      "${preview}"`);
      }
      
      // Load full history for detailed sessions
      try {
        const history = await api.loadSessionHistory(session.id, project.id);
        const messageCount = history.length;
        const lastMessage = history[history.length - 1];
        
        console.log(`      📊 ${messageCount} messages`);
        if (lastMessage?.timestamp) {
          console.log(`      🕐 Last activity: ${lastMessage.timestamp}`);
        }
      } catch (error) {
        console.log(`      ❌ Could not load history: ${error}`);
      }
    }
  }
}
```

---

**Next**: Learn about [Agent Management API](./agent-management-api.md) for creating and executing custom AI agents.