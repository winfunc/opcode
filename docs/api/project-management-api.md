# Project Management API

The Project Management API provides functionality to discover, manage, and interact with Claude Code projects stored in the `~/.claude/projects` directory.

## Table of Contents
- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Project Discovery](#project-discovery)
- [Session Management](#session-management)
- [CLAUDE.md File Management](#claudemd-file-management)
- [Settings Management](#settings-management)
- [File System Operations](#file-system-operations)
- [Examples](#examples)

## Overview

Claude Code stores projects in the `~/.claude/projects` directory, where each project is a URL-encoded directory name containing session files and metadata. The Project Management API provides a clean interface to discover and work with these projects.

### Key Features
- **Automatic Discovery** - Scan and list all Claude Code projects
- **Session Enumeration** - List sessions within each project
- **CLAUDE.md Management** - Read and edit system prompt files
- **Settings Integration** - Access Claude Code configuration
- **File Operations** - Browse project directories and files

## Core Concepts

### Project Structure
```
~/.claude/projects/
├── example.com%2Fuser%2Frepo/          # URL-encoded project path
│   ├── session-uuid-1.jsonl            # Session conversation logs
│   ├── session-uuid-2.jsonl
│   └── ...
├── localhost%2Fmy-project/
│   ├── session-uuid-3.jsonl
│   └── ...
└── ...
```

### Project Identity
- **Project ID**: URL-encoded directory name (e.g., `example.com%2Fuser%2Frepo`)
- **Project Path**: Original decoded path (e.g., `/home/user/projects/repo`)
- **Sessions**: Array of session UUIDs found in the project directory

## Project Discovery

### `listProjects()`

Lists all projects found in the `~/.claude/projects` directory.

```typescript
async listProjects(): Promise<Project[]>
```

**Returns**: Array of `Project` objects with metadata

**Example**:
```typescript
const projects = await api.listProjects();

projects.forEach(project => {
  console.log(`Project: ${project.path}`);
  console.log(`ID: ${project.id}`);
  console.log(`Sessions: ${project.sessions.length}`);
  console.log(`Created: ${new Date(project.created_at * 1000)}`);
});
```

**Project Object Structure**:
```typescript
interface Project {
  id: string;           // URL-encoded directory name
  path: string;         // Original project path
  sessions: string[];   // Array of session UUIDs
  created_at: number;   // Unix timestamp
}
```

### `getProjectSessions(projectId)`

Retrieves detailed session information for a specific project.

```typescript
async getProjectSessions(projectId: string): Promise<Session[]>
```

**Parameters**:
- `projectId` - The project ID (URL-encoded directory name)

**Returns**: Array of `Session` objects with metadata

**Example**:
```typescript
const sessions = await api.getProjectSessions('example.com%2Fuser%2Frepo');

sessions.forEach(session => {
  console.log(`Session: ${session.id}`);
  console.log(`First message: ${session.first_message}`);
  console.log(`Created: ${session.created_at}`);
});
```

**Session Object Structure**:
```typescript
interface Session {
  id: string;              // Session UUID
  project_id: string;      // Parent project ID
  project_path: string;    // Original project path
  todo_data?: any;         // Optional todo metadata
  created_at: number;      // Unix timestamp
  first_message?: string;  // First user message content
  message_timestamp?: string; // Timestamp of first message
}
```

## Session Management

### `loadSessionHistory(sessionId, projectId)`

Loads the complete JSONL conversation history for a session.

```typescript
async loadSessionHistory(sessionId: string, projectId: string): Promise<any[]>
```

**Parameters**:
- `sessionId` - The session UUID
- `projectId` - The project ID containing the session

**Returns**: Array of conversation messages in JSONL format

**Example**:
```typescript
const history = await api.loadSessionHistory(
  'session-uuid-123',
  'example.com%2Fuser%2Frepo'
);

history.forEach((message, index) => {
  console.log(`Message ${index}:`, message.content);
  console.log(`Role: ${message.role}`);
  console.log(`Timestamp: ${message.timestamp}`);
});
```

### `openNewSession(path?)`

Opens a new Claude Code session in the specified path.

```typescript
async openNewSession(path?: string): Promise<string>
```

**Parameters**:
- `path` - Optional project path. If not provided, uses current directory

**Returns**: Session ID of the newly created session

**Example**:
```typescript
// Open session in specific project
const sessionId = await api.openNewSession('/path/to/my/project');

// Open session in current directory
const sessionId = await api.openNewSession();
```

## CLAUDE.md File Management

### `findClaudeMdFiles(projectPath)`

Discovers all CLAUDE.md files within a project directory.

```typescript
async findClaudeMdFiles(projectPath: string): Promise<ClaudeMdFile[]>
```

**Parameters**:
- `projectPath` - Absolute path to the project directory

**Returns**: Array of found CLAUDE.md files with metadata

**Example**:
```typescript
const claudeFiles = await api.findClaudeMdFiles('/path/to/project');

claudeFiles.forEach(file => {
  console.log(`File: ${file.relative_path}`);
  console.log(`Size: ${file.size} bytes`);
  console.log(`Modified: ${new Date(file.modified)}`);
});
```

### `readClaudeMdFile(filePath)`

Reads the content of a specific CLAUDE.md file.

```typescript
async readClaudeMdFile(filePath: string): Promise<string>
```

**Parameters**:
- `filePath` - Absolute path to the CLAUDE.md file

**Returns**: File content as string

**Example**:
```typescript
const content = await api.readClaudeMdFile('/path/to/project/CLAUDE.md');
console.log('System prompt:', content);
```

### `saveClaudeMdFile(filePath, content)`

Saves content to a CLAUDE.md file.

```typescript
async saveClaudeMdFile(filePath: string, content: string): Promise<string>
```

**Parameters**:
- `filePath` - Absolute path to the CLAUDE.md file
- `content` - New content to write

**Returns**: Success message

**Example**:
```typescript
const newPrompt = `# Project Assistant

You are a helpful assistant for this project. Please:
- Follow the coding standards
- Write comprehensive tests
- Document your changes
`;

await api.saveClaudeMdFile('/path/to/project/CLAUDE.md', newPrompt);
```

## Settings Management

### `getClaudeSettings()`

Retrieves the current Claude Code settings from `~/.claude/settings.json`.

```typescript
async getClaudeSettings(): Promise<ClaudeSettings>
```

**Returns**: Settings object with configuration data

**Example**:
```typescript
const settings = await api.getClaudeSettings();

console.log('Default model:', settings.default_model);
console.log('API key configured:', !!settings.api_key);
console.log('All settings:', settings);
```

### `saveClaudeSettings(settings)`

Saves settings to the Claude Code configuration file.

```typescript
async saveClaudeSettings(settings: ClaudeSettings): Promise<string>
```

**Parameters**:
- `settings` - Settings object to save

**Returns**: Success message

**Example**:
```typescript
const newSettings = {
  ...await api.getClaudeSettings(),
  default_model: 'claude-sonnet-4-20250514',
  max_tokens: 4096
};

await api.saveClaudeSettings(newSettings);
```

### `getSystemPrompt()`

Gets the global system prompt from the default CLAUDE.md file.

```typescript
async getSystemPrompt(): Promise<string>
```

**Returns**: System prompt content

### `saveSystemPrompt(content)`

Saves the global system prompt to the default CLAUDE.md file.

```typescript
async saveSystemPrompt(content: string): Promise<string>
```

**Parameters**:
- `content` - New system prompt content

**Returns**: Success message

## File System Operations

### `listDirectoryContents(directoryPath)`

Lists files and directories within a specified path.

```typescript
async listDirectoryContents(directoryPath: string): Promise<FileEntry[]>
```

**Parameters**:
- `directoryPath` - Path to list contents of

**Returns**: Array of file/directory entries

**Example**:
```typescript
const entries = await api.listDirectoryContents('/path/to/project');

entries.forEach(entry => {
  const type = entry.is_directory ? 'DIR' : 'FILE';
  console.log(`${type}: ${entry.name} (${entry.size} bytes)`);
});
```

### `searchFiles(basePath, query)`

Searches for files matching a pattern within a base path.

```typescript
async searchFiles(basePath: string, query: string): Promise<FileEntry[]>
```

**Parameters**:
- `basePath` - Base directory to search within
- `query` - Search pattern/query

**Returns**: Array of matching file entries

**Example**:
```typescript
// Find all TypeScript files
const tsFiles = await api.searchFiles('/path/to/project', '*.ts');

// Find files containing 'component'
const componentFiles = await api.searchFiles('/path/to/project', '*component*');
```

## Claude Binary Management

### `checkClaudeVersion()`

Checks if Claude Code is installed and retrieves version information.

```typescript
async checkClaudeVersion(): Promise<ClaudeVersionStatus>
```

**Returns**: Version status and installation information

**Example**:
```typescript
const status = await api.checkClaudeVersion();

if (status.is_installed) {
  console.log(`Claude Code v${status.version} is installed`);
} else {
  console.error('Claude Code not found:', status.output);
}
```

### `getClaudeBinaryPath()`

Gets the currently configured Claude binary path.

```typescript
async getClaudeBinaryPath(): Promise<string | null>
```

**Returns**: Path to Claude binary or null if not set

### `setClaudeBinaryPath(path)`

Sets a custom path to the Claude binary.

```typescript
async setClaudeBinaryPath(path: string): Promise<void>
```

**Parameters**:
- `path` - Absolute path to the Claude binary

### `listClaudeInstallations()`

Lists all detected Claude installations on the system.

```typescript
async listClaudeInstallations(): Promise<ClaudeInstallation[]>
```

**Returns**: Array of found Claude installations

**Example**:
```typescript
const installations = await api.listClaudeInstallations();

installations.forEach(install => {
  console.log(`Found: ${install.path}`);
  console.log(`Version: ${install.version}`);
  console.log(`Source: ${install.source}`);
});
```

## Examples

### Complete Project Browser

```typescript
async function browseProjects() {
  // Get all projects
  const projects = await api.listProjects();
  
  for (const project of projects) {
    console.log(`\n📁 Project: ${project.path}`);
    console.log(`   Created: ${new Date(project.created_at * 1000).toLocaleDateString()}`);
    
    // Get sessions for this project
    const sessions = await api.getProjectSessions(project.id);
    console.log(`   Sessions: ${sessions.length}`);
    
    // Show recent sessions
    const recentSessions = sessions.slice(-3);
    for (const session of recentSessions) {
      console.log(`   💬 ${session.id}`);
      if (session.first_message) {
        const preview = session.first_message.slice(0, 60) + '...';
        console.log(`      "${preview}"`);
      }
    }
    
    // Find CLAUDE.md files
    const claudeFiles = await api.findClaudeMdFiles(project.path);
    if (claudeFiles.length > 0) {
      console.log(`   📝 System prompts: ${claudeFiles.length}`);
    }
  }
}
```

### Project Setup Assistant

```typescript
async function setupProject(projectPath: string) {
  console.log(`Setting up project: ${projectPath}`);
  
  // Check if project already exists in Claude
  const projects = await api.listProjects();
  const existing = projects.find(p => p.path === projectPath);
  
  if (existing) {
    console.log('✅ Project already tracked by Claude Code');
    const sessions = await api.getProjectSessions(existing.id);
    console.log(`   ${sessions.length} existing sessions`);
  } else {
    console.log('🆕 New project - creating first session');
    await api.openNewSession(projectPath);
  }
  
  // Check for CLAUDE.md files
  const claudeFiles = await api.findClaudeMdFiles(projectPath);
  
  if (claudeFiles.length === 0) {
    console.log('📝 No CLAUDE.md found - creating default');
    const defaultPrompt = `# ${projectPath.split('/').pop()} Assistant

You are a helpful coding assistant for this project.
Please follow best practices and maintain code quality.`;
    
    await api.saveClaudeMdFile(`${projectPath}/CLAUDE.md`, defaultPrompt);
  } else {
    console.log(`✅ Found ${claudeFiles.length} CLAUDE.md files`);
  }
  
  console.log('🎉 Project setup complete!');
}
```

---

**Next**: Learn about [Session Management API](./session-management-api.md) for executing Claude Code sessions.