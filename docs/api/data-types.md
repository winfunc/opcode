# Data Types Reference

This document provides a comprehensive reference of all TypeScript interfaces, types, and data structures used in the Claudia API.

## Table of Contents
- [Core Project Types](#core-project-types)
- [Agent System Types](#agent-system-types)
- [Session Management Types](#session-management-types)
- [Checkpoint System Types](#checkpoint-system-types)
- [MCP Integration Types](#mcp-integration-types)
- [Usage Analytics Types](#usage-analytics-types)
- [File System Types](#file-system-types)
- [Utility Types](#utility-types)

## Core Project Types

### Project

Represents a Claude Code project discovered in `~/.claude/projects/`.

```typescript
interface Project {
  /** The project ID (URL-encoded directory name) */
  id: string;
  /** The original project path (decoded from directory name) */
  path: string;
  /** List of session IDs (JSONL file names without extension) */
  sessions: string[];
  /** Unix timestamp when the project directory was created */
  created_at: number;
}
```

**Example**:
```typescript
const project: Project = {
  id: "example.com%2Fuser%2Frepo",
  path: "/Users/dev/projects/my-app",
  sessions: ["uuid-123", "uuid-456", "uuid-789"],
  created_at: 1704067200
};
```

### Session

Represents a Claude Code session with metadata.

```typescript
interface Session {
  /** The session ID (UUID) */
  id: string;
  /** The project ID this session belongs to */
  project_id: string;
  /** The project path */
  project_path: string;
  /** Optional todo data associated with this session */
  todo_data?: any;
  /** Unix timestamp when the session file was created */
  created_at: number;
  /** First user message content (if available) */
  first_message?: string;
  /** Timestamp of the first user message (if available) */
  message_timestamp?: string;
}
```

### ClaudeSettings

Configuration settings from `~/.claude/settings.json`.

```typescript
interface ClaudeSettings {
  [key: string]: any;
}
```

**Common Properties**:
```typescript
// Typical settings structure
interface TypicalClaudeSettings {
  default_model?: string;
  api_key?: string;
  max_tokens?: number;
  temperature?: number;
  api_base_url?: string;
}
```

### ClaudeVersionStatus

Information about Claude Code installation.

```typescript
interface ClaudeVersionStatus {
  /** Whether Claude Code is installed and working */
  is_installed: boolean;
  /** The version string if available */
  version?: string;
  /** The full output from the command */
  output: string;
}
```

### ClaudeInstallation

Information about a detected Claude installation.

```typescript
interface ClaudeInstallation {
  /** Full path to the Claude binary */
  path: string;
  /** Version string if available */
  version?: string;
  /** Source of discovery (e.g., "nvm", "system", "homebrew", "which") */
  source: string;
}
```

## Agent System Types

### Agent

Core agent configuration and metadata.

```typescript
interface Agent {
  /** Unique agent identifier (auto-generated) */
  id?: number;
  /** Display name for the agent */
  name: string;
  /** Icon identifier ('bot', 'shield', 'code', etc.) */
  icon: string;
  /** Custom system instructions for the agent */
  system_prompt: string;
  /** Optional default task description */
  default_task?: string;
  /** Claude model to use ('sonnet', 'haiku', 'opus') */
  model: string;
  /** Creation timestamp (ISO format) */
  created_at: string;
  /** Last modification timestamp (ISO format) */
  updated_at: string;
}
```

**Available Icons**:
- `bot` - 🤖 General purpose
- `shield` - 🛡️ Security related
- `code` - 💻 Development
- `terminal` - 🖥️ System/CLI
- `database` - 🗄️ Data operations
- `globe` - 🌐 Network/Web
- `file-text` - 📄 Documentation
- `git-branch` - 🌿 Version control

### AgentRun

Represents an agent execution with basic information.

```typescript
interface AgentRun {
  /** Unique run identifier */
  id?: number;
  /** ID of the agent being executed */
  agent_id: number;
  /** Name of the agent */
  agent_name: string;
  /** Icon of the agent */
  agent_icon: string;
  /** Task description for this execution */
  task: string;
  /** Claude model used for execution */
  model: string;
  /** Project path where agent is running */
  project_path: string;
  /** Session ID generated for this run */
  session_id: string;
  /** Current execution status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Process ID (if running) */
  pid?: number;
  /** Process start timestamp */
  process_started_at?: string;
  /** Run creation timestamp */
  created_at: string;
  /** Run completion timestamp */
  completed_at?: string;
}
```

### AgentRunMetrics

Performance metrics for an agent run.

```typescript
interface AgentRunMetrics {
  /** Total execution duration in milliseconds */
  duration_ms?: number;
  /** Total tokens consumed (input + output) */
  total_tokens?: number;
  /** Total cost in USD */
  cost_usd?: number;
  /** Number of messages exchanged */
  message_count?: number;
}
```

### AgentRunWithMetrics

Extended agent run information including performance metrics.

```typescript
interface AgentRunWithMetrics extends AgentRun {
  /** Performance metrics for this run */
  metrics?: AgentRunMetrics;
  /** Real-time JSONL content output */
  output?: string;
}
```

### AgentExport

Format for agent import/export operations.

```typescript
interface AgentExport {
  /** Export format version */
  version: number;
  /** Export timestamp (ISO format) */
  exported_at: string;
  /** Agent configuration data */
  agent: {
    name: string;
    icon: string;
    system_prompt: string;
    default_task?: string;
    model: string;
  };
}
```

### GitHubAgentFile

Information about an agent file available on GitHub.

```typescript
interface GitHubAgentFile {
  /** File name */
  name: string;
  /** Repository path */
  path: string;
  /** Direct download URL */
  download_url: string;
  /** File size in bytes */
  size: number;
  /** Git SHA hash */
  sha: string;
}
```

## Session Management Types

### ProcessType

Type discriminator for different process types.

```typescript
type ProcessType = 
  | { AgentRun: { agent_id: number; agent_name: string } }
  | { ClaudeSession: { session_id: string } };
```

### ProcessInfo

Information about a running process.

```typescript
interface ProcessInfo {
  /** Unique run identifier */
  run_id: number;
  /** Type of process (agent or session) */
  process_type: ProcessType;
  /** System process ID */
  pid: number;
  /** Process start timestamp */
  started_at: string;
  /** Project path */
  project_path: string;
  /** Task description */
  task: string;
  /** Claude model being used */
  model: string;
}
```

## Checkpoint System Types

### Checkpoint

Represents a session state snapshot.

```typescript
interface Checkpoint {
  /** Unique checkpoint identifier */
  id: string;
  /** Associated session ID */
  sessionId: string;
  /** Project identifier */
  projectId: string;
  /** Message index in conversation */
  messageIndex: number;
  /** Creation timestamp (ISO format) */
  timestamp: string;
  /** Optional description */
  description?: string;
  /** Parent checkpoint ID (for branching) */
  parentCheckpointId?: string;
  /** Additional checkpoint metadata */
  metadata: CheckpointMetadata;
}
```

### CheckpointMetadata

Additional information stored with each checkpoint.

```typescript
interface CheckpointMetadata {
  /** Total tokens at checkpoint */
  totalTokens: number;
  /** Claude model used */
  modelUsed: string;
  /** User prompt that triggered checkpoint */
  userPrompt: string;
  /** Number of file changes */
  fileChanges: number;
  /** Size of snapshot data in bytes */
  snapshotSize: number;
}
```

### CheckpointStrategy

Strategy for automatic checkpoint creation.

```typescript
type CheckpointStrategy = 'manual' | 'per_prompt' | 'per_tool_use' | 'smart';
```

### CheckpointResult

Result of a checkpoint operation.

```typescript
interface CheckpointResult {
  /** The created/restored checkpoint */
  checkpoint: Checkpoint;
  /** Number of files processed */
  filesProcessed: number;
  /** Any warnings or issues */
  warnings: string[];
}
```

### TimelineNode

Node in the session timeline tree structure.

```typescript
interface TimelineNode {
  /** Checkpoint data */
  checkpoint: Checkpoint;
  /** Child nodes (branches) */
  children: TimelineNode[];
  /** File snapshot identifiers */
  fileSnapshotIds: string[];
}
```

### SessionTimeline

Complete timeline structure for a session.

```typescript
interface SessionTimeline {
  /** Session identifier */
  sessionId: string;
  /** Root timeline node */
  rootNode?: TimelineNode;
  /** Currently active checkpoint */
  currentCheckpointId?: string;
  /** Whether auto-checkpoint is enabled */
  autoCheckpointEnabled: boolean;
  /** Checkpoint creation strategy */
  checkpointStrategy: CheckpointStrategy;
  /** Total number of checkpoints */
  totalCheckpoints: number;
}
```

### FileSnapshot

Snapshot of a file at a specific checkpoint.

```typescript
interface FileSnapshot {
  /** Associated checkpoint ID */
  checkpointId: string;
  /** Relative file path */
  filePath: string;
  /** File content at checkpoint */
  content: string;
  /** Content hash for deduplication */
  hash: string;
  /** Whether file was deleted */
  isDeleted: boolean;
  /** File permissions */
  permissions?: number;
  /** File size in bytes */
  size: number;
}
```

### CheckpointDiff

Comparison between two checkpoints.

```typescript
interface CheckpointDiff {
  /** Source checkpoint ID */
  fromCheckpointId: string;
  /** Target checkpoint ID */
  toCheckpointId: string;
  /** Files that were modified */
  modifiedFiles: FileDiff[];
  /** Files that were added */
  addedFiles: string[];
  /** Files that were deleted */
  deletedFiles: string[];
  /** Change in token count */
  tokenDelta: number;
}
```

### FileDiff

Diff information for a single file.

```typescript
interface FileDiff {
  /** File path */
  path: string;
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
  /** Optional diff content */
  diffContent?: string;
}
```

## MCP Integration Types

### MCPServer

Configuration for an MCP (Model Context Protocol) server.

```typescript
interface MCPServer {
  /** Unique server identifier */
  name: string;
  /** Transport type: "stdio" or "sse" */
  transport: string;
  /** Command to execute (for stdio) */
  command?: string;
  /** Command arguments (for stdio) */
  args: string[];
  /** Environment variables */
  env: Record<string, string>;
  /** URL endpoint (for SSE) */
  url?: string;
  /** Configuration scope */
  scope: 'local' | 'project' | 'user';
  /** Whether the server is currently active */
  is_active: boolean;
  /** Current server status */
  status: ServerStatus;
}
```

### ServerStatus

Status information for an MCP server.

```typescript
interface ServerStatus {
  /** Whether the server is currently running */
  running: boolean;
  /** Last error message if any */
  error?: string;
  /** Last status check timestamp */
  last_checked?: number;
}
```

### MCPProjectConfig

MCP configuration stored in project `.mcp.json` files.

```typescript
interface MCPProjectConfig {
  /** Map of server name to configuration */
  mcpServers: Record<string, MCPServerConfig>;
}
```

### MCPServerConfig

Individual server configuration in project files.

```typescript
interface MCPServerConfig {
  /** Executable command */
  command: string;
  /** Command arguments */
  args: string[];
  /** Environment variables */
  env: Record<string, string>;
}
```

### AddServerResult

Result of adding an MCP server.

```typescript
interface AddServerResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result message */
  message: string;
  /** Name of the added server */
  server_name?: string;
}
```

### ImportResult

Result of importing multiple MCP servers.

```typescript
interface ImportResult {
  /** Number of successfully imported servers */
  imported_count: number;
  /** Number of failed imports */
  failed_count: number;
  /** Detailed results for each server */
  servers: ImportServerResult[];
}
```

### ImportServerResult

Result for individual server import.

```typescript
interface ImportServerResult {
  /** Server name */
  name: string;
  /** Whether import succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}
```

## Usage Analytics Types

### UsageEntry

Individual usage record for analytics.

```typescript
interface UsageEntry {
  /** Project identifier */
  project: string;
  /** Usage timestamp (ISO format) */
  timestamp: string;
  /** Claude model used */
  model: string;
  /** Input tokens consumed */
  input_tokens: number;
  /** Output tokens generated */
  output_tokens: number;
  /** Cache write tokens */
  cache_write_tokens: number;
  /** Cache read tokens */
  cache_read_tokens: number;
  /** Total cost in USD */
  cost: number;
}
```

### ModelUsage

Aggregated usage statistics for a specific model.

```typescript
interface ModelUsage {
  /** Model identifier */
  model: string;
  /** Total cost for this model */
  total_cost: number;
  /** Total tokens consumed */
  total_tokens: number;
  /** Input tokens only */
  input_tokens: number;
  /** Output tokens only */
  output_tokens: number;
  /** Cache creation tokens */
  cache_creation_tokens: number;
  /** Cache read tokens */
  cache_read_tokens: number;
  /** Number of sessions using this model */
  session_count: number;
}
```

### DailyUsage

Usage statistics aggregated by day.

```typescript
interface DailyUsage {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Total cost for the day */
  total_cost: number;
  /** Total tokens for the day */
  total_tokens: number;
  /** Models used on this day */
  models_used: string[];
}
```

### ProjectUsage

Usage statistics aggregated by project.

```typescript
interface ProjectUsage {
  /** Full project path */
  project_path: string;
  /** Project display name */
  project_name: string;
  /** Total cost for this project */
  total_cost: number;
  /** Total tokens for this project */
  total_tokens: number;
  /** Number of sessions in this project */
  session_count: number;
  /** Last usage timestamp */
  last_used: string;
}
```

### UsageStats

Comprehensive usage statistics.

```typescript
interface UsageStats {
  /** Total cost across all usage */
  total_cost: number;
  /** Total tokens consumed */
  total_tokens: number;
  /** Total input tokens */
  total_input_tokens: number;
  /** Total output tokens */
  total_output_tokens: number;
  /** Total cache creation tokens */
  total_cache_creation_tokens: number;
  /** Total cache read tokens */
  total_cache_read_tokens: number;
  /** Total number of sessions */
  total_sessions: number;
  /** Usage breakdown by model */
  by_model: ModelUsage[];
  /** Usage breakdown by date */
  by_date: DailyUsage[];
  /** Usage breakdown by project */
  by_project: ProjectUsage[];
}
```

## File System Types

### FileEntry

Represents a file or directory entry.

```typescript
interface FileEntry {
  /** File or directory name */
  name: string;
  /** Full path */
  path: string;
  /** Whether this is a directory */
  is_directory: boolean;
  /** File size in bytes */
  size: number;
  /** File extension (if applicable) */
  extension?: string;
}
```

### ClaudeMdFile

Information about a CLAUDE.md file in a project.

```typescript
interface ClaudeMdFile {
  /** Relative path from project root */
  relative_path: string;
  /** Absolute path to the file */
  absolute_path: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  modified: number;
}
```

## Utility Types

### Common Patterns

#### Optional ID Pattern
Many entities use optional IDs for creation vs. retrieval:

```typescript
// For creation (ID auto-generated)
const newAgent: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: "My Agent",
  icon: "bot",
  system_prompt: "...",
  model: "sonnet"
};

// For retrieval (ID included)
const existingAgent: Agent = {
  id: 123,
  name: "My Agent",
  // ... other properties
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z"
};
```

#### Timestamp Patterns
Timestamps use different formats in different contexts:

```typescript
// Unix timestamps (seconds since epoch)
interface UnixTimestamp {
  created_at: number; // 1704067200
}

// ISO string timestamps
interface ISOTimestamp {
  created_at: string; // "2024-01-01T00:00:00Z"
}
```

#### Status Enums
Common status values used throughout the API:

```typescript
// Agent run statuses
type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// Server statuses
type ServerRunningStatus = boolean; // true = running, false = stopped

// Checkpoint strategies
type CheckpointStrategy = 'manual' | 'per_prompt' | 'per_tool_use' | 'smart';

// Configuration scopes
type ConfigScope = 'local' | 'user' | 'project';

// Transport types
type TransportType = 'stdio' | 'sse';
```

#### Result Patterns
Many operations return result objects with success/failure information:

```typescript
interface OperationResult {
  success: boolean;
  message: string;
  // Optional additional data
  [key: string]: any;
}

// Examples
type AddServerResult = OperationResult & { server_name?: string };
type ImportResult = OperationResult & { 
  imported_count: number; 
  failed_count: number; 
  servers: ImportServerResult[] 
};
```

## Type Guards and Validation

### Process Type Guards

```typescript
function isAgentRun(processType: ProcessType): processType is { AgentRun: { agent_id: number; agent_name: string } } {
  return 'AgentRun' in processType;
}

function isClaudeSession(processType: ProcessType): processType is { ClaudeSession: { session_id: string } } {
  return 'ClaudeSession' in processType;
}
```

### Status Type Guards

```typescript
function isCompleted(run: AgentRun): run is AgentRun & { status: 'completed'; completed_at: string } {
  return run.status === 'completed' && !!run.completed_at;
}

function isRunning(run: AgentRun): run is AgentRun & { status: 'running'; pid: number } {
  return run.status === 'running' && !!run.pid;
}
```

### Validation Helpers

```typescript
function validateAgent(agent: Partial<Agent>): agent is Omit<Agent, 'id' | 'created_at' | 'updated_at'> {
  return !!(agent.name && agent.icon && agent.system_prompt && agent.model);
}

function validateMCPServer(server: Partial<MCPServer>): server is MCPServer {
  if (!server.name || !server.transport) return false;
  
  if (server.transport === 'stdio') {
    return !!server.command;
  } else if (server.transport === 'sse') {
    return !!server.url;
  }
  
  return false;
}
```

## JSON Schema Examples

For external integrations, here are JSON Schema representations of key types:

### Agent Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "number" },
    "name": { "type": "string", "minLength": 1 },
    "icon": { 
      "type": "string", 
      "enum": ["bot", "shield", "code", "terminal", "database", "globe", "file-text", "git-branch"]
    },
    "system_prompt": { "type": "string", "minLength": 1 },
    "default_task": { "type": "string" },
    "model": { 
      "type": "string", 
      "enum": ["sonnet", "haiku", "opus"]
    },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" }
  },
  "required": ["name", "icon", "system_prompt", "model"]
}
```

### MCP Server Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "transport": { "type": "string", "enum": ["stdio", "sse"] },
    "command": { "type": "string" },
    "args": { 
      "type": "array", 
      "items": { "type": "string" } 
    },
    "env": { 
      "type": "object", 
      "additionalProperties": { "type": "string" } 
    },
    "url": { "type": "string", "format": "uri" },
    "scope": { "type": "string", "enum": ["local", "user", "project"] }
  },
  "required": ["name", "transport", "args", "env", "scope"],
  "if": { "properties": { "transport": { "const": "stdio" } } },
  "then": { "required": ["command"] },
  "else": { "required": ["url"] }
}
```

---

This comprehensive data types reference should help developers understand and work with all Claudia API interfaces effectively. All types are fully typed in TypeScript for excellent IDE support and compile-time validation.