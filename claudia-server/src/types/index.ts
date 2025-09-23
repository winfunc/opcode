/**
 * Core type definitions for Claudia Server
 * These mirror the types from the original Tauri app
 */

export type ProcessType =
  | { AgentRun: { agent_id: number; agent_name: string } }
  | { ClaudeSession: { session_id: string } };

export interface ProcessInfo {
  run_id: number;
  process_type: ProcessType;
  pid: number;
  started_at: string;
  project_path: string;
  task: string;
  model: string;
}

/**
 * Represents a project in the ~/.claude/projects directory
 */
export interface Project {
  /** The project ID (derived from the directory name) */
  id: string;
  /** The original project path (decoded from the directory name) */
  path: string;
  /** List of session IDs (JSONL file names without extension) */
  sessions: string[];
  /** Unix timestamp when the project directory was created */
  created_at: number;
  /** Unix timestamp of the most recent session (if any) */
  most_recent_session?: number;
}

/**
 * Represents a session with its metadata
 */
export interface Session {
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

/**
 * Represents the settings from ~/.claude/settings.json
 */
export interface ClaudeSettings {
  [key: string]: any;
}

/**
 * Represents the Claude Code version status
 */
export interface ClaudeVersionStatus {
  /** Whether Claude Code is installed and working */
  is_installed: boolean;
  /** The version string if available */
  version?: string;
  /** The full output from the command */
  output: string;
}

/**
 * Represents a CLAUDE.md file found in the project
 */
export interface ClaudeMdFile {
  /** Relative path from the project root */
  relative_path: string;
  /** Absolute path to the file */
  absolute_path: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  modified: number;
}

/**
 * Represents a file or directory entry
 */
export interface FileEntry {
  /** The name of the file or directory */
  name: string;
  /** The full path */
  path: string;
  /** Whether this is a directory */
  is_directory: boolean;
  /** File size in bytes (0 for directories) */
  size: number;
  /** File extension (if applicable) */
  extension?: string;
}

/**
 * Claude streaming message types
 */
export interface ClaudeStreamMessage {
  type: 'start' | 'partial' | 'complete' | 'error';
  content?: string;
  role?: 'user' | 'assistant';
  tool_calls?: any[];
  timestamp: string;
  session_id?: string;
}

/**
 * API Request types
 */
export interface ExecuteClaudeRequest {
  project_path: string;
  prompt: string;
  model: string;
}

export interface ContinueClaudeRequest {
  project_path: string;
  prompt: string;
  model: string;
}

export interface ResumeClaudeRequest {
  project_path: string;
  session_id: string;
  prompt: string;
  model: string;
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'claude_stream' | 'error' | 'status';
  data?: any;
  session_id?: string;
  timestamp: string;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  cors_origin: string[];
  max_concurrent_sessions: number;
  session_timeout_ms: number;
  claude_binary_path?: string;
  claude_home_dir?: string;
}

/**
 * Error response type
 */
export interface ErrorResponse {
  error: string;
  code: string;
  timestamp: string;
  details?: any;
}

/**
 * Success response type
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
}