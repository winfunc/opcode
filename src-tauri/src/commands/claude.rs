use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use std::io::{BufRead, BufReader};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::process::{Command, Child};

/// Represents a project in the ~/.claude/projects directory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    /// The project ID (derived from the directory name)
    pub id: String,
    /// The original project path (decoded from the directory name)
    pub path: String,
    /// List of session IDs (JSONL file names without extension)
    pub sessions: Vec<String>,
    /// Unix timestamp when the project directory was created
    pub created_at: u64,
}

/// Represents a session with its metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// The session ID (UUID)
    pub id: String,
    /// The project ID this session belongs to
    pub project_id: String,
    /// The project path
    pub project_path: String,
    /// Optional todo data associated with this session
    pub todo_data: Option<serde_json::Value>,
    /// Unix timestamp when the session file was created
    pub created_at: u64,
    /// First user message content (if available)
    pub first_message: Option<String>,
    /// Timestamp of the first user message (if available)
    pub message_timestamp: Option<String>,
}

/// Represents a message entry in the JSONL file
#[derive(Debug, Deserialize)]
struct JsonlEntry {
    #[serde(rename = "type")]
    #[allow(dead_code)]
    entry_type: Option<String>,
    message: Option<MessageContent>,
    timestamp: Option<String>,
}

/// Represents the message content
#[derive(Debug, Deserialize)]
struct MessageContent {
    role: Option<String>,
    content: Option<String>,
}

/// Represents the settings from ~/.claude/settings.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSettings {
    #[serde(flatten)]
    pub data: serde_json::Value,
}

impl Default for ClaudeSettings {
    fn default() -> Self {
        Self {
            data: serde_json::json!({}),
        }
    }
}

/// Represents the Claude Code version status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeVersionStatus {
    /// Whether Claude Code is installed and working
    pub is_installed: bool,
    /// The version string if available
    pub version: Option<String>,
    /// The full output from the command
    pub output: String,
}

/// Represents a CLAUDE.md file found in the project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeMdFile {
    /// Relative path from the project root
    pub relative_path: String,
    /// Absolute path to the file
    pub absolute_path: String,
    /// File size in bytes
    pub size: u64,
    /// Last modified timestamp
    pub modified: u64,
}

/// Represents a file or directory entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    /// The name of the file or directory
    pub name: String,
    /// The full path
    pub path: String,
    /// Whether this is a directory
    pub is_directory: bool,
    /// File size in bytes (0 for directories)
    pub size: u64,
    /// File extension (if applicable)
    pub extension: Option<String>,
}

/// State for tracking the current Claude Code process
pub struct ClaudeProcessState {
    current_process: Arc<Mutex<Option<Child>>>,
}

impl ClaudeProcessState {
    pub fn new() -> Self {
        Self {
            current_process: Arc::new(Mutex::new(None)),
        }
    }
    
    pub fn set_process(&self, child: Child) {
        let mut process = self.current_process.lock().unwrap();
        *process = Some(child);
    }
    
    pub async fn kill_current_process(&self) -> Result<bool, String> {
        // Take the process out of the mutex to avoid holding the lock across await
        let child_opt = {
            let mut process = self.current_process.lock().unwrap();
            process.take()
        };
        
        if let Some(mut child) = child_opt {
            match child.kill().await {
                Ok(_) => Ok(true),
                Err(e) => {
                    // If kill failed, put the process back
                    let mut process = self.current_process.lock().unwrap();
                    *process = Some(child);
                    Err(format!("Failed to kill process: {}", e))
                }
            }
        } else {
            Ok(false) // No process running
        }
    }
}

impl Default for ClaudeProcessState {
    fn default() -> Self {
        Self::new()
    }
}

/// Finds the full path to the claude binary
/// This is necessary because macOS apps have a limited PATH environment
fn find_claude_binary(app_handle: &AppHandle) -> Result<String, String> {
    log::info!("Searching for claude binary...");
    
    // First check if we have a stored path in the database
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        let db_path = app_data_dir.join("agents.db");
        if db_path.exists() {
            if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                if let Ok(stored_path) = conn.query_row(
                    "SELECT value FROM app_settings WHERE key = 'claude_binary_path'",
                    [],
                    |row| row.get::<_, String>(0),
                ) {
                    log::info!("Found stored claude path in database: {}", stored_path);
                    let path_buf = PathBuf::from(&stored_path);
                    if path_buf.exists() && path_buf.is_file() {
                        return Ok(stored_path);
                    } else {
                        log::warn!("Stored claude path no longer exists: {}", stored_path);
                    }
                }
            }
        }
    }
    
    // Common installation paths for claude
    let mut paths_to_check: Vec<String> = vec![
        "/usr/local/bin/claude".to_string(),
        "/opt/homebrew/bin/claude".to_string(),
        "/usr/bin/claude".to_string(),
        "/bin/claude".to_string(),
    ];
    
    // Also check user-specific paths
    if let Ok(home) = std::env::var("HOME") {
        paths_to_check.extend(vec![
            format!("{}/.claude/local/claude", home),
            format!("{}/.local/bin/claude", home),
            format!("{}/.npm-global/bin/claude", home),
            format!("{}/.yarn/bin/claude", home),
            format!("{}/.bun/bin/claude", home),
            format!("{}/bin/claude", home),
            // Check common node_modules locations
            format!("{}/node_modules/.bin/claude", home),
            format!("{}/.config/yarn/global/node_modules/.bin/claude", home),
        ]);
    }
    
    // Check each path
    for path in paths_to_check {
        let path_buf = PathBuf::from(&path);
        if path_buf.exists() && path_buf.is_file() {
            log::info!("Found claude at: {}", path);
            return Ok(path);
        }
    }
    
    // In production builds, skip the 'which' command as it's blocked by Tauri
    #[cfg(not(debug_assertions))]
    {
        log::warn!("Cannot use 'which' command in production build, checking if claude is in PATH");
        // In production, just return "claude" and let the execution fail with a proper error
        // if it's not actually available. The user can then set the path manually.
        return Ok("claude".to_string());
    }
    
    // Only try 'which' in development builds
    #[cfg(debug_assertions)]
    {
        // Fallback: try using 'which' command
        log::info!("Trying 'which claude' to find binary...");
        if let Ok(output) = std::process::Command::new("which")
            .arg("claude")
            .output()
        {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    log::info!("'which' found claude at: {}", path);
                    return Ok(path);
                }
            }
        }
        
        // Additional fallback: check if claude is in the current PATH
        // This might work in dev mode
        if let Ok(output) = std::process::Command::new("claude")
            .arg("--version")
            .output()
        {
            if output.status.success() {
                log::info!("claude is available in PATH (dev mode?)");
                return Ok("claude".to_string());
            }
        }
    }
    
    log::error!("Could not find claude binary in any common location");
    Err("Claude Code not found. Please ensure it's installed and in one of these locations: /usr/local/bin, /opt/homebrew/bin, ~/.claude/local, ~/.local/bin, or in your PATH".to_string())
}

/// Gets the path to the ~/.claude directory
fn get_claude_dir() -> Result<PathBuf> {
    dirs::home_dir()
        .context("Could not find home directory")?
        .join(".claude")
        .canonicalize()
        .context("Could not find ~/.claude directory")
}

/// Gets the actual project path by reading the cwd from the first JSONL entry
fn get_project_path_from_sessions(project_dir: &PathBuf) -> Result<String, String> {
    // Try to read any JSONL file in the directory
    let entries = fs::read_dir(project_dir)
        .map_err(|e| format!("Failed to read project directory: {}", e))?;
    
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                // Read the first line of the JSONL file
                if let Ok(file) = fs::File::open(&path) {
                    let reader = BufReader::new(file);
                    if let Some(Ok(first_line)) = reader.lines().next() {
                        // Parse the JSON and extract cwd
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&first_line) {
                            if let Some(cwd) = json.get("cwd").and_then(|v| v.as_str()) {
                                return Ok(cwd.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    
    Err("Could not determine project path from session files".to_string())
}

/// Decodes a project directory name back to its original path
/// The directory names in ~/.claude/projects are encoded paths
/// DEPRECATED: Use get_project_path_from_sessions instead when possible
fn decode_project_path(encoded: &str) -> String {
    // This is a fallback - the encoding isn't reversible when paths contain hyphens
    // For example: -Users-mufeedvh-dev-jsonl-viewer could be /Users/mufeedvh/dev/jsonl-viewer
    // or /Users/mufeedvh/dev/jsonl/viewer
    encoded.replace('-', "/")
}

/// Extracts the first valid user message from a JSONL file
fn extract_first_user_message(jsonl_path: &PathBuf) -> (Option<String>, Option<String>) {
    let file = match fs::File::open(jsonl_path) {
        Ok(file) => file,
        Err(_) => return (None, None),
    };
    
    let reader = BufReader::new(file);
    
    for line in reader.lines() {
        if let Ok(line) = line {
            if let Ok(entry) = serde_json::from_str::<JsonlEntry>(&line) {
                if let Some(message) = entry.message {
                    if message.role.as_deref() == Some("user") {
                        if let Some(content) = message.content {
                            // Skip if it contains the caveat message
                            if content.contains("Caveat: The messages below were generated by the user while running local commands") {
                                continue;
                            }
                            
                            // Skip if it starts with command tags
                            if content.starts_with("<command-name>") || content.starts_with("<local-command-stdout>") {
                                continue;
                            }
                            
                            // Found a valid user message
                            return (Some(content), entry.timestamp);
                        }
                    }
                }
            }
        }
    }
    
    (None, None)
}

/// Helper function to create a tokio Command with proper environment variables
/// This ensures commands like Claude can find Node.js and other dependencies
fn create_command_with_env(program: &str) -> Command {
    let mut cmd = Command::new(program);
    
    // Inherit essential environment variables from parent process
    // This is crucial for commands like Claude that need to find Node.js
    for (key, value) in std::env::vars() {
        // Pass through PATH and other essential environment variables
        if key == "PATH" || key == "HOME" || key == "USER" 
            || key == "SHELL" || key == "LANG" || key == "LC_ALL" || key.starts_with("LC_")
            || key == "NODE_PATH" || key == "NVM_DIR" || key == "NVM_BIN" 
            || key == "HOMEBREW_PREFIX" || key == "HOMEBREW_CELLAR" {
            log::debug!("Inheriting env var: {}={}", key, value);
            cmd.env(&key, &value);
        }
    }
    
    cmd
}

/// Lists all projects in the ~/.claude/projects directory
#[tauri::command]
pub async fn list_projects() -> Result<Vec<Project>, String> {
    log::info!("Listing projects from ~/.claude/projects");
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let projects_dir = claude_dir.join("projects");
    
    if !projects_dir.exists() {
        log::warn!("Projects directory does not exist: {:?}", projects_dir);
        return Ok(Vec::new());
    }
    
    let mut projects = Vec::new();
    
    // Read all directories in the projects folder
    let entries = fs::read_dir(&projects_dir)
        .map_err(|e| format!("Failed to read projects directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.is_dir() {
            let dir_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| "Invalid directory name".to_string())?;
            
            // Get directory creation time
            let metadata = fs::metadata(&path)
                .map_err(|e| format!("Failed to read directory metadata: {}", e))?;
            
            let created_at = metadata
                .created()
                .or_else(|_| metadata.modified())
                .unwrap_or(SystemTime::UNIX_EPOCH)
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            
            // Get the actual project path from JSONL files
            let project_path = match get_project_path_from_sessions(&path) {
                Ok(path) => path,
                Err(e) => {
                    log::warn!("Failed to get project path from sessions for {}: {}, falling back to decode", dir_name, e);
                    decode_project_path(dir_name)
                }
            };
            
            // List all JSONL files (sessions) in this project directory
            let mut sessions = Vec::new();
            if let Ok(session_entries) = fs::read_dir(&path) {
                for session_entry in session_entries.flatten() {
                    let session_path = session_entry.path();
                    if session_path.is_file() && session_path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                        if let Some(session_id) = session_path.file_stem().and_then(|s| s.to_str()) {
                            sessions.push(session_id.to_string());
                        }
                    }
                }
            }
            
            projects.push(Project {
                id: dir_name.to_string(),
                path: project_path,
                sessions,
                created_at,
            });
        }
    }
    
    // Sort projects by creation time (newest first)
    projects.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    log::info!("Found {} projects", projects.len());
    Ok(projects)
}

/// Gets sessions for a specific project
#[tauri::command]
pub async fn get_project_sessions(project_id: String) -> Result<Vec<Session>, String> {
    log::info!("Getting sessions for project: {}", project_id);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    let todos_dir = claude_dir.join("todos");
    
    if !project_dir.exists() {
        return Err(format!("Project directory not found: {}", project_id));
    }
    
    // Get the actual project path from JSONL files
    let project_path = match get_project_path_from_sessions(&project_dir) {
        Ok(path) => path,
        Err(e) => {
            log::warn!("Failed to get project path from sessions for {}: {}, falling back to decode", project_id, e);
            decode_project_path(&project_id)
        }
    };
    
    let mut sessions = Vec::new();
    
    // Read all JSONL files in the project directory
    let entries = fs::read_dir(&project_dir)
        .map_err(|e| format!("Failed to read project directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
            if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                // Get file creation time
                let metadata = fs::metadata(&path)
                    .map_err(|e| format!("Failed to read file metadata: {}", e))?;
                
                let created_at = metadata
                    .created()
                    .or_else(|_| metadata.modified())
                    .unwrap_or(SystemTime::UNIX_EPOCH)
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                
                // Extract first user message and timestamp
                let (first_message, message_timestamp) = extract_first_user_message(&path);
                
                // Try to load associated todo data
                let todo_path = todos_dir.join(format!("{}.json", session_id));
                let todo_data = if todo_path.exists() {
                    fs::read_to_string(&todo_path)
                        .ok()
                        .and_then(|content| serde_json::from_str(&content).ok())
                } else {
                    None
                };
                
                sessions.push(Session {
                    id: session_id.to_string(),
                    project_id: project_id.clone(),
                    project_path: project_path.clone(),
                    todo_data,
                    created_at,
                    first_message,
                    message_timestamp,
                });
            }
        }
    }
    
    // Sort sessions by creation time (newest first)
    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    log::info!("Found {} sessions for project {}", sessions.len(), project_id);
    Ok(sessions)
}

/// Reads the Claude settings file
#[tauri::command]
pub async fn get_claude_settings() -> Result<ClaudeSettings, String> {
    log::info!("Reading Claude settings");
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let settings_path = claude_dir.join("settings.json");
    
    if !settings_path.exists() {
        log::warn!("Settings file not found, returning empty settings");
        return Ok(ClaudeSettings {
            data: serde_json::json!({}),
        });
    }
    
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;
    
    let data: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings JSON: {}", e))?;
    
    Ok(ClaudeSettings { data })
}

/// Opens a new Claude Code session by executing the claude command
#[tauri::command]
pub async fn open_new_session(app: AppHandle, path: Option<String>) -> Result<String, String> {
    log::info!("Opening new Claude Code session at path: {:?}", path);
    
    let claude_path = find_claude_binary(&app)?;
    
    // In production, we can't use std::process::Command directly
    // The user should launch Claude Code through other means or use the execute_claude_code command
    #[cfg(not(debug_assertions))]
    {
        log::error!("Cannot spawn processes directly in production builds");
        return Err("Direct process spawning is not available in production builds. Please use Claude Code directly or use the integrated execution commands.".to_string());
    }
    
    #[cfg(debug_assertions)]
    {
        let mut cmd = std::process::Command::new(claude_path);
        
        // If a path is provided, use it; otherwise use current directory
        if let Some(project_path) = path {
            cmd.current_dir(&project_path);
        }
        
        // Execute the command
        match cmd.spawn() {
            Ok(_) => {
                log::info!("Successfully launched Claude Code");
                Ok("Claude Code session started".to_string())
            }
            Err(e) => {
                log::error!("Failed to launch Claude Code: {}", e);
                Err(format!("Failed to launch Claude Code: {}", e))
            }
        }
    }
}

/// Reads the CLAUDE.md system prompt file
#[tauri::command]
pub async fn get_system_prompt() -> Result<String, String> {
    log::info!("Reading CLAUDE.md system prompt");
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let claude_md_path = claude_dir.join("CLAUDE.md");
    
    if !claude_md_path.exists() {
        log::warn!("CLAUDE.md not found");
        return Ok(String::new());
    }
    
    fs::read_to_string(&claude_md_path)
        .map_err(|e| format!("Failed to read CLAUDE.md: {}", e))
}

/// Checks if Claude Code is installed and gets its version
#[tauri::command]
pub async fn check_claude_version(app: AppHandle) -> Result<ClaudeVersionStatus, String> {
    log::info!("Checking Claude Code version");
    
    let claude_path = match find_claude_binary(&app) {
        Ok(path) => path,
        Err(e) => {
            return Ok(ClaudeVersionStatus {
                is_installed: false,
                version: None,
                output: e,
            });
        }
    };
    
    // In production builds, we can't check the version directly
    #[cfg(not(debug_assertions))]
    {
        log::warn!("Cannot check claude version in production build");
        // If we found a path (either stored or in common locations), assume it's installed
        if claude_path != "claude" && PathBuf::from(&claude_path).exists() {
            return Ok(ClaudeVersionStatus {
                is_installed: true,
                version: None,
                output: "Claude binary found at: ".to_string() + &claude_path,
            });
        } else {
            return Ok(ClaudeVersionStatus {
                is_installed: false,
                version: None,
                output: "Cannot verify Claude installation in production build. Please ensure Claude Code is installed.".to_string(),
            });
        }
    }
    
    #[cfg(debug_assertions)]
    {
        let output = std::process::Command::new(claude_path)
            .arg("--version")
            .output();
        
        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let full_output = if stderr.is_empty() { stdout.clone() } else { format!("{}\n{}", stdout, stderr) };
                
                // Check if the output matches the expected format
                // Expected format: "1.0.17 (Claude Code)" or similar
                let is_valid = stdout.contains("(Claude Code)") || stdout.contains("Claude Code");
                
                // Extract version number if valid
                let version = if is_valid {
                    // Try to extract just the version number
                    stdout.split_whitespace()
                        .next()
                        .map(|s| s.to_string())
                } else {
                    None
                };
                
                Ok(ClaudeVersionStatus {
                    is_installed: is_valid && output.status.success(),
                    version,
                    output: full_output.trim().to_string(),
                })
            }
            Err(e) => {
                log::error!("Failed to run claude command: {}", e);
                Ok(ClaudeVersionStatus {
                    is_installed: false,
                    version: None,
                    output: format!("Command not found: {}", e),
                })
            }
        }
    }
}

/// Saves the CLAUDE.md system prompt file
#[tauri::command]
pub async fn save_system_prompt(content: String) -> Result<String, String> {
    log::info!("Saving CLAUDE.md system prompt");
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let claude_md_path = claude_dir.join("CLAUDE.md");
    
    fs::write(&claude_md_path, content)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;
    
    Ok("System prompt saved successfully".to_string())
}

/// Saves the Claude settings file
#[tauri::command]
pub async fn save_claude_settings(settings: serde_json::Value) -> Result<String, String> {
    log::info!("Saving Claude settings");
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let settings_path = claude_dir.join("settings.json");
    
    // Pretty print the JSON with 2-space indentation
    let json_string = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(&settings_path, json_string)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;
    
    Ok("Settings saved successfully".to_string())
}

/// Recursively finds all CLAUDE.md files in a project directory
#[tauri::command]
pub async fn find_claude_md_files(project_path: String) -> Result<Vec<ClaudeMdFile>, String> {
    log::info!("Finding CLAUDE.md files in project: {}", project_path);
    
    let path = PathBuf::from(&project_path);
    if !path.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }
    
    let mut claude_files = Vec::new();
    find_claude_md_recursive(&path, &path, &mut claude_files)?;
    
    // Sort by relative path
    claude_files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    
    log::info!("Found {} CLAUDE.md files", claude_files.len());
    Ok(claude_files)
}

/// Helper function to recursively find CLAUDE.md files
fn find_claude_md_recursive(
    current_path: &PathBuf,
    project_root: &PathBuf,
    claude_files: &mut Vec<ClaudeMdFile>,
) -> Result<(), String> {
    let entries = fs::read_dir(current_path)
        .map_err(|e| format!("Failed to read directory {:?}: {}", current_path, e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        // Skip hidden directories and files
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') && name != ".claude" {
                continue;
            }
        }
        
        if path.is_dir() {
            // Skip common directories that shouldn't be scanned
            if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                if matches!(dir_name, "node_modules" | "target" | ".git" | "dist" | "build" | ".next" | "__pycache__") {
                    continue;
                }
            }
            
            // Recurse into subdirectory
            find_claude_md_recursive(&path, project_root, claude_files)?;
        } else if path.is_file() {
            // Check if it's a CLAUDE.md file (case insensitive)
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if file_name.eq_ignore_ascii_case("CLAUDE.md") {
                    let metadata = fs::metadata(&path)
                        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
                    
                    let relative_path = path.strip_prefix(project_root)
                        .map_err(|e| format!("Failed to get relative path: {}", e))?
                        .to_string_lossy()
                        .to_string();
                    
                    let modified = metadata
                        .modified()
                        .unwrap_or(SystemTime::UNIX_EPOCH)
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();
                    
                    claude_files.push(ClaudeMdFile {
                        relative_path,
                        absolute_path: path.to_string_lossy().to_string(),
                        size: metadata.len(),
                        modified,
                    });
                }
            }
        }
    }
    
    Ok(())
}

/// Reads a specific CLAUDE.md file by its absolute path
#[tauri::command]
pub async fn read_claude_md_file(file_path: String) -> Result<String, String> {
    log::info!("Reading CLAUDE.md file: {}", file_path);
    
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Saves a specific CLAUDE.md file by its absolute path
#[tauri::command]
pub async fn save_claude_md_file(file_path: String, content: String) -> Result<String, String> {
    log::info!("Saving CLAUDE.md file: {}", file_path);
    
    let path = PathBuf::from(&file_path);
    
    // Ensure the parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok("File saved successfully".to_string())
}

/// Loads the JSONL history for a specific session
#[tauri::command]
pub async fn load_session_history(session_id: String, project_id: String) -> Result<Vec<serde_json::Value>, String> {
    log::info!("Loading session history for session: {} in project: {}", session_id, project_id);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let session_path = claude_dir.join("projects").join(&project_id).join(format!("{}.jsonl", session_id));
    
    if !session_path.exists() {
        return Err(format!("Session file not found: {}", session_id));
    }
    
    let file = fs::File::open(&session_path)
        .map_err(|e| format!("Failed to open session file: {}", e))?;
    
    let reader = BufReader::new(file);
    let mut messages = Vec::new();
    
    for line in reader.lines() {
        if let Ok(line) = line {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                messages.push(json);
            }
        }
    }
    
    Ok(messages)
}

/// Execute a new interactive Claude Code session with streaming output
#[tauri::command]
pub async fn execute_claude_code(
    app: AppHandle,
    state: State<'_, ClaudeProcessState>,
    project_path: String,
    prompt: String,
    model: String,
) -> Result<(), String> {
    log::info!("Starting new Claude Code session in: {} with model: {}", project_path, model);
    
    // Check if sandboxing should be used
    let use_sandbox = should_use_sandbox(&app)?;
    
    let mut cmd = if use_sandbox {
        create_sandboxed_claude_command(&app, &project_path)?
    } else {
        let claude_path = find_claude_binary(&app)?;
        create_command_with_env(&claude_path)
    };
    
    cmd.arg("-p")
        .arg(&prompt)
        .arg("--model")
        .arg(&model)
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose")
        .arg("--dangerously-skip-permissions")
        .current_dir(&project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    spawn_claude_process(app, state, cmd).await
}

/// Continue an existing Claude Code conversation with streaming output
#[tauri::command]
pub async fn continue_claude_code(
    app: AppHandle,
    state: State<'_, ClaudeProcessState>,
    project_path: String,
    prompt: String,
    model: String,
) -> Result<(), String> {
    log::info!("Continuing Claude Code conversation in: {} with model: {}", project_path, model);
    
    // Check if sandboxing should be used
    let use_sandbox = should_use_sandbox(&app)?;
    
    let mut cmd = if use_sandbox {
        create_sandboxed_claude_command(&app, &project_path)?
    } else {
        let claude_path = find_claude_binary(&app)?;
        create_command_with_env(&claude_path)
    };
    
    cmd.arg("-c")  // Continue flag
        .arg("-p")
        .arg(&prompt)
        .arg("--model")
        .arg(&model)
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose")
        .arg("--dangerously-skip-permissions")
        .current_dir(&project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    spawn_claude_process(app, state, cmd).await
}

/// Resume an existing Claude Code session by ID with streaming output
#[tauri::command]
pub async fn resume_claude_code(
    app: AppHandle,
    state: State<'_, ClaudeProcessState>,
    project_path: String,
    session_id: String,
    prompt: String,
    model: String,
) -> Result<(), String> {
    log::info!("Resuming Claude Code session: {} in: {} with model: {}", session_id, project_path, model);
    
    // First, validate the session file to ensure it doesn't have unpaired tool_use blocks
    match validate_session_file(&session_id, &project_path).await {
        Ok(_) => {
            log::info!("Session validation passed for session: {}", session_id);
        }
        Err(e) => {
            log::warn!("Session validation failed for session {}: {}. Starting fresh conversation instead.", session_id, e);
            // If validation fails, start a fresh conversation instead of resuming
            // This prevents the tool_use/tool_result mismatch error
            return execute_claude_code(app, state, project_path, prompt, model).await;
        }
    }
    
    // Check if sandboxing should be used
    let use_sandbox = should_use_sandbox(&app)?;
    
    let mut cmd = if use_sandbox {
        create_sandboxed_claude_command(&app, &project_path)?
    } else {
        let claude_path = find_claude_binary(&app)?;
        create_command_with_env(&claude_path)
    };
    
    cmd.arg("--resume")
        .arg(&session_id)
        .arg("-p")
        .arg(&prompt)
        .arg("--model")
        .arg(&model)
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose")
        .arg("--dangerously-skip-permissions")
        .current_dir(&project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    spawn_claude_process(app, state, cmd).await
}

/// Validates a session file to ensure it doesn't have unpaired tool_use blocks
async fn validate_session_file(session_id: &str, project_path: &str) -> Result<(), String> {
    // Claude encodes project paths by replacing "/" with "-"
    let project_id = project_path.replace("/", "-");
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let session_path = claude_dir.join("projects").join(&project_id).join(format!("{}.jsonl", session_id));
    
    if !session_path.exists() {
        return Err(format!("Session file not found: {}", session_id));
    }
    
    let file = fs::File::open(&session_path)
        .map_err(|e| format!("Failed to open session file: {}", e))?;
    
    let reader = BufReader::new(file);
    let mut pending_tool_use_ids: Vec<String> = Vec::new();
    
    log::debug!("Validating session file: {:?}", session_path);
    
    for (line_num, line) in reader.lines().enumerate() {
        if let Ok(line) = line {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                // Check if this is a message with content
                if let Some(message) = json.get("message") {
                    if let Some(content_array) = message.get("content").and_then(|c| c.as_array()) {
                        for content in content_array {
                            if let Some(content_type) = content.get("type").and_then(|t| t.as_str()) {
                                match content_type {
                                    "tool_use" => {
                                        if let Some(id) = content.get("id").and_then(|i| i.as_str()) {
                                            log::debug!("Line {}: Found tool_use with id: {}", line_num, id);
                                            pending_tool_use_ids.push(id.to_string());
                                        }
                                    }
                                    "tool_result" => {
                                        if let Some(tool_use_id) = content.get("tool_use_id").and_then(|i| i.as_str()) {
                                            log::debug!("Line {}: Found tool_result for id: {}", line_num, tool_use_id);
                                            pending_tool_use_ids.retain(|id| id != tool_use_id);
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    if !pending_tool_use_ids.is_empty() {
        return Err(format!(
            "Session has {} unpaired tool_use blocks. This can cause API errors.",
            pending_tool_use_ids.len()
        ));
    }
    
    Ok(())
}

/// Helper function to check if sandboxing should be used based on settings
fn should_use_sandbox(app: &AppHandle) -> Result<bool, String> {
    // First check if sandboxing is even available on this platform
    if !crate::sandbox::platform::is_sandboxing_available() {
        log::info!("Sandboxing not available on this platform");
        return Ok(false);
    }
    
    // Check if a setting exists to enable/disable sandboxing
    let settings = get_claude_settings_sync(app)?;
    
    // Check for a sandboxing setting in the settings
    if let Some(sandbox_enabled) = settings.data.get("sandboxEnabled").and_then(|v| v.as_bool()) {
        return Ok(sandbox_enabled);
    }
    
    // Default to true (sandboxing enabled) on supported platforms
    Ok(true)
}

/// Helper function to create a sandboxed Claude command
fn create_sandboxed_claude_command(app: &AppHandle, project_path: &str) -> Result<Command, String> {
    use crate::sandbox::{profile::ProfileBuilder, executor::create_sandboxed_command};
    use std::path::PathBuf;
    
    // Get the database connection
    let conn = {
        let app_data_dir = app.path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;
        let db_path = app_data_dir.join("agents.db");
        rusqlite::Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?
    };

    // Query for the default active sandbox profile
    let profile_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM sandbox_profiles WHERE is_default = 1 AND is_active = 1",
            [],
            |row| row.get(0),
        )
        .ok();
    
    match profile_id {
        Some(profile_id) => {
            log::info!("Using default sandbox profile: {} (id: {})", profile_id, profile_id);
            
            // Get all rules for this profile
            let mut stmt = conn.prepare(
                "SELECT operation_type, pattern_type, pattern_value, enabled, platform_support 
                 FROM sandbox_rules WHERE profile_id = ?1 AND enabled = 1"
            ).map_err(|e| e.to_string())?;
            
            let rules = stmt.query_map(rusqlite::params![profile_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, bool>(3)?,
                    row.get::<_, Option<String>>(4)?
                ))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
            
            log::info!("Building sandbox profile with {} rules", rules.len());
            
            // Build the gaol profile
            let project_path_buf = PathBuf::from(project_path);
            
            match ProfileBuilder::new(project_path_buf.clone()) {
                Ok(builder) => {
                    // Convert database rules to SandboxRule structs
                    let mut sandbox_rules = Vec::new();
                    
                    for (idx, (op_type, pattern_type, pattern_value, enabled, platform_support)) in rules.into_iter().enumerate() {
                        // Check if this rule applies to the current platform
                        if let Some(platforms_json) = &platform_support {
                            if let Ok(platforms) = serde_json::from_str::<Vec<String>>(platforms_json) {
                                let current_platform = if cfg!(target_os = "linux") {
                                    "linux"
                                } else if cfg!(target_os = "macos") {
                                    "macos"
                                } else if cfg!(target_os = "freebsd") {
                                    "freebsd"
                                } else {
                                    "unsupported"
                                };
                                
                                if !platforms.contains(&current_platform.to_string()) {
                                    continue;
                                }
                            }
                        }
                        
                        // Create SandboxRule struct
                        let rule = crate::sandbox::profile::SandboxRule {
                            id: Some(idx as i64),
                            profile_id: 0,
                            operation_type: op_type,
                            pattern_type,
                            pattern_value,
                            enabled,
                            platform_support,
                            created_at: String::new(),
                        };
                        
                        sandbox_rules.push(rule);
                    }
                    
                    // Try to build the profile
                    match builder.build_profile(sandbox_rules) {
                        Ok(profile) => {
                            log::info!("Successfully built sandbox profile '{}'", profile_id);
                            
                            // Use the helper function to create sandboxed command
                            let claude_path = find_claude_binary(app)?;
                            Ok(create_sandboxed_command(&claude_path, &[], &project_path_buf, profile, project_path_buf.clone()))
                        }
                        Err(e) => {
                            log::error!("Failed to build sandbox profile: {}, falling back to non-sandboxed", e);
                            let claude_path = find_claude_binary(app)?;
                            Ok(create_command_with_env(&claude_path))
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to create ProfileBuilder: {}, falling back to non-sandboxed", e);
                    let claude_path = find_claude_binary(app)?;
                    Ok(create_command_with_env(&claude_path))
                }
            }
        }
        None => {
            log::info!("No default active sandbox profile found: proceeding without sandbox");
            let claude_path = find_claude_binary(app)?;
            Ok(create_command_with_env(&claude_path))
        }
    }
}

/// Synchronous version of get_claude_settings for use in non-async contexts
fn get_claude_settings_sync(_app: &AppHandle) -> Result<ClaudeSettings, String> {
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let settings_path = claude_dir.join("settings.json");

    if !settings_path.exists() {
        return Ok(ClaudeSettings::default());
    }
    
    let content = std::fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;
    
    let data: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings JSON: {}", e))?;
    
    Ok(ClaudeSettings { data })
}

/// Helper function to spawn Claude process and handle streaming
async fn spawn_claude_process(app: AppHandle, state: State<'_, ClaudeProcessState>, mut cmd: Command) -> Result<(), String> {
    use tokio::io::{AsyncBufReadExt, BufReader};
    
    // Spawn the process
    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn Claude: {}", e))?;
    
    // Get stdout and stderr
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;
    
    // Create readers
    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);
    
    // Spawn tasks to read stdout and stderr
    let app_handle = app.clone();
    let stdout_task = tokio::spawn(async move {
        let mut lines = stdout_reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            log::debug!("Claude stdout: {}", line);
            // Emit the line to the frontend
            let _ = app_handle.emit("claude-output", &line);
        }
    });
    
    let app_handle_stderr = app.clone();
    let stderr_task = tokio::spawn(async move {
        let mut lines = stderr_reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            log::error!("Claude stderr: {}", line);
            // Emit error lines to the frontend
            let _ = app_handle_stderr.emit("claude-error", &line);
        }
    });
    
    // Clone the Arc<Mutex<Option<Child>>> before storing the child
    let process_handle = state.current_process.clone();
    
    // Store the child process in state
    state.set_process(child);
    
    // Wait for the process to complete
    let app_completion = app.clone();
    tokio::spawn(async move {
        let _ = stdout_task.await;
        let _ = stderr_task.await;
        
        // Wait for the process without taking it from state
        // This allows the cancel function to still access it
        loop {
            // Check if process is still running
            let should_wait = {
                let process_guard = process_handle.lock().unwrap();
                process_guard.is_some()
            };
            
            if !should_wait {
                // Process was removed (likely by cancel or kill)
                log::info!("Claude process was removed from state");
                break;
            }
            
            // Try to check process status without removing it
            let status_opt = {
                let mut process_guard = process_handle.lock().unwrap();
                if let Some(ref mut child) = process_guard.as_mut() {
                    match child.try_wait() {
                        Ok(Some(status)) => {
                            log::info!("Claude process exited with status: {}", status);
                            let success = status.success();
                            // Now we can take it since it's done
                            process_guard.take();
                            Some((true, success))
                        }
                        Ok(None) => None, // Still running
                        Err(e) => {
                            log::error!("Failed to check Claude process status: {}", e);
                            // Remove the failed process
                            process_guard.take();
                            Some((false, false))
                        }
                    }
                } else {
                    None
                }
            };
            
            if let Some((completed, success)) = status_opt {
                if completed {
                    // Add a small delay to ensure all messages are processed
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    let _ = app_completion.emit("claude-complete", success);
                }
                break;
            }
            
            // Sleep a bit before checking again
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    });
    
    Ok(())
}

/// Cancel the currently running Claude Code process
#[tauri::command]
pub async fn cancel_claude_code(
    app: AppHandle,
    state: State<'_, ClaudeProcessState>,
) -> Result<bool, String> {
    log::info!("Cancel Claude Code process requested");
    
    // Check if there's a process before trying to kill
    let has_process = {
        let process_guard = state.current_process.lock().unwrap();
        process_guard.is_some()
    };
    
    log::info!("Current process exists: {}", has_process);
    
    let killed = state.kill_current_process().await?;
    
    if killed {
        log::info!("Claude Code process killed successfully");
        // Emit a cancellation event to the frontend
        let _ = app.emit("claude-cancelled", true);
        // Also emit a completion event to ensure UI updates
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        let _ = app.emit("claude-complete", false);
    } else {
        log::info!("No Claude Code process was running to cancel");
    }
    
    Ok(killed)
}

/// Lists files and directories in a given path
#[tauri::command]
pub async fn list_directory_contents(directory_path: String) -> Result<Vec<FileEntry>, String> {
    log::info!("Listing directory contents: '{}'", directory_path);
    
    // Check if path is empty
    if directory_path.trim().is_empty() {
        log::error!("Directory path is empty or whitespace");
        return Err("Directory path cannot be empty".to_string());
    }
    
    let path = PathBuf::from(&directory_path);
    log::debug!("Resolved path: {:?}", path);
    
    if !path.exists() {
        log::error!("Path does not exist: {:?}", path);
        return Err(format!("Path does not exist: {}", directory_path));
    }
    
    if !path.is_dir() {
        log::error!("Path is not a directory: {:?}", path);
        return Err(format!("Path is not a directory: {}", directory_path));
    }
    
    let mut entries = Vec::new();
    
    let dir_entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in dir_entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let entry_path = entry.path();
        let metadata = entry.metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        
        // Skip hidden files/directories unless they are .claude directories
        if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') && name != ".claude" {
                continue;
            }
        }
        
        let name = entry_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        
        let extension = if metadata.is_file() {
            entry_path.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_string())
        } else {
            None
        };
        
        entries.push(FileEntry {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            size: metadata.len(),
            extension,
        });
    }
    
    // Sort: directories first, then files, alphabetically within each group
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(entries)
}

/// Search for files and directories matching a pattern
#[tauri::command]
pub async fn search_files(base_path: String, query: String) -> Result<Vec<FileEntry>, String> {
    log::info!("Searching files in '{}' for: '{}'", base_path, query);
    
    // Check if path is empty
    if base_path.trim().is_empty() {
        log::error!("Base path is empty or whitespace");
        return Err("Base path cannot be empty".to_string());
    }
    
    // Check if query is empty
    if query.trim().is_empty() {
        log::warn!("Search query is empty, returning empty results");
        return Ok(Vec::new());
    }
    
    let path = PathBuf::from(&base_path);
    log::debug!("Resolved search base path: {:?}", path);
    
    if !path.exists() {
        log::error!("Base path does not exist: {:?}", path);
        return Err(format!("Path does not exist: {}", base_path));
    }
    
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    
    search_files_recursive(&path, &path, &query_lower, &mut results, 0)?;
    
    // Sort by relevance: exact matches first, then by name
    results.sort_by(|a, b| {
        let a_exact = a.name.to_lowercase() == query_lower;
        let b_exact = b.name.to_lowercase() == query_lower;
        
        match (a_exact, b_exact) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    // Limit results to prevent overwhelming the UI
    results.truncate(50);
    
    Ok(results)
}

fn search_files_recursive(
    current_path: &PathBuf,
    base_path: &PathBuf,
    query: &str,
    results: &mut Vec<FileEntry>,
    depth: usize,
) -> Result<(), String> {
    // Limit recursion depth to prevent excessive searching
    if depth > 5 || results.len() >= 50 {
        return Ok(());
    }
    
    let entries = fs::read_dir(current_path)
        .map_err(|e| format!("Failed to read directory {:?}: {}", current_path, e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let entry_path = entry.path();
        
        // Skip hidden files/directories
        if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') {
                continue;
            }
            
            // Check if name matches query
            if name.to_lowercase().contains(query) {
                let metadata = entry.metadata()
                    .map_err(|e| format!("Failed to read metadata: {}", e))?;
                
                let extension = if metadata.is_file() {
                    entry_path.extension()
                        .and_then(|e| e.to_str())
                        .map(|e| e.to_string())
                } else {
                    None
                };
                
                results.push(FileEntry {
                    name: name.to_string(),
                    path: entry_path.to_string_lossy().to_string(),
                    is_directory: metadata.is_dir(),
                    size: metadata.len(),
                    extension,
                });
            }
        }
        
        // Recurse into directories
        if entry_path.is_dir() {
            // Skip common directories that shouldn't be searched
            if let Some(dir_name) = entry_path.file_name().and_then(|n| n.to_str()) {
                if matches!(dir_name, "node_modules" | "target" | ".git" | "dist" | "build" | ".next" | "__pycache__") {
                    continue;
                }
            }
            
            search_files_recursive(&entry_path, base_path, query, results, depth + 1)?;
        }
    }
    
    Ok(())
}

/// Creates a checkpoint for the current session state
#[tauri::command]
pub async fn create_checkpoint(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
    message_index: Option<usize>,
    description: Option<String>,
) -> Result<crate::checkpoint::CheckpointResult, String> {
    log::info!("Creating checkpoint for session: {} in project: {}", session_id, project_id);
    
    let manager = app.get_or_create_manager(
        session_id.clone(),
        project_id.clone(),
        PathBuf::from(&project_path),
    ).await.map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;
    
    // Always load current session messages from the JSONL file
    let session_path = get_claude_dir()
        .map_err(|e| e.to_string())?
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", session_id));
        
    if session_path.exists() {
        let file = fs::File::open(&session_path)
            .map_err(|e| format!("Failed to open session file: {}", e))?;
        let reader = BufReader::new(file);
        
        let mut line_count = 0;
        for line in reader.lines() {
            if let Some(index) = message_index {
                if line_count > index {
                    break;
                }
            }
            if let Ok(line) = line {
                manager.track_message(line).await
                    .map_err(|e| format!("Failed to track message: {}", e))?;
            }
            line_count += 1;
        }
    }
    
    manager.create_checkpoint(description, None).await
        .map_err(|e| format!("Failed to create checkpoint: {}", e))
}

/// Restores a session to a specific checkpoint
#[tauri::command]
pub async fn restore_checkpoint(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    checkpoint_id: String,
    session_id: String,
    project_id: String,
    project_path: String,
) -> Result<crate::checkpoint::CheckpointResult, String> {
    log::info!("Restoring checkpoint: {} for session: {}", checkpoint_id, session_id);
    
    let manager = app.get_or_create_manager(
        session_id.clone(),
        project_id.clone(),
        PathBuf::from(&project_path),
    ).await.map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;
    
    let result = manager.restore_checkpoint(&checkpoint_id).await
        .map_err(|e| format!("Failed to restore checkpoint: {}", e))?;
        
    // Update the session JSONL file with restored messages
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let session_path = claude_dir
        .join("projects")
        .join(&result.checkpoint.project_id)
        .join(format!("{}.jsonl", session_id));
        
    // The manager has already restored the messages internally,
    // but we need to update the actual session file
    let (_, _, messages) = manager.storage.load_checkpoint(
        &result.checkpoint.project_id,
        &session_id,
        &checkpoint_id,
    ).map_err(|e| format!("Failed to load checkpoint data: {}", e))?;
    
    fs::write(&session_path, messages)
        .map_err(|e| format!("Failed to update session file: {}", e))?;
    
    Ok(result)
}

/// Lists all checkpoints for a session
#[tauri::command]
pub async fn list_checkpoints(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
) -> Result<Vec<crate::checkpoint::Checkpoint>, String> {
    log::info!("Listing checkpoints for session: {} in project: {}", session_id, project_id);
    
    let manager = app.get_or_create_manager(
        session_id,
        project_id,
        PathBuf::from(&project_path),
    ).await.map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;
    
    Ok(manager.list_checkpoints().await)
}

/// Forks a new timeline branch from a checkpoint
#[tauri::command]
pub async fn fork_from_checkpoint(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    checkpoint_id: String,
    session_id: String,
    project_id: String,
    project_path: String,
    new_session_id: String,
    description: Option<String>,
) -> Result<crate::checkpoint::CheckpointResult, String> {
    log::info!("Forking from checkpoint: {} to new session: {}", checkpoint_id, new_session_id);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    
    // First, copy the session file to the new session
    let source_session_path = claude_dir
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", session_id));
    let new_session_path = claude_dir
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", new_session_id));
        
    if source_session_path.exists() {
        fs::copy(&source_session_path, &new_session_path)
            .map_err(|e| format!("Failed to copy session file: {}", e))?;
    }
    
    // Create manager for the new session
    let manager = app.get_or_create_manager(
        new_session_id.clone(),
        project_id,
        PathBuf::from(&project_path),
    ).await.map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;
    
    manager.fork_from_checkpoint(&checkpoint_id, description).await
        .map_err(|e| format!("Failed to fork checkpoint: {}", e))
}

/// Gets the timeline for a session
#[tauri::command]
pub async fn get_session_timeline(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
) -> Result<crate::checkpoint::SessionTimeline, String> {
    log::info!("Getting timeline for session: {} in project: {}", session_id, project_id);
    
    let manager = app.get_or_create_manager(
        session_id,
        project_id,
        PathBuf::from(&project_path),
    ).await.map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;
    
    Ok(manager.get_timeline().await)
}

/// Updates checkpoint settings for a session
#[tauri::command]
pub async fn update_checkpoint_settings(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
    auto_checkpoint_enabled: bool,
    checkpoint_strategy: String,
) -> Result<(), String> {
    use crate::checkpoint::CheckpointStrategy;
    
    log::info!("Updating checkpoint settings for session: {}", session_id);
    
    let strategy = match checkpoint_strategy.as_str() {
        "manual" => CheckpointStrategy::Manual,
        "per_prompt" => CheckpointStrategy::PerPrompt,
        "per_tool_use" => CheckpointStrategy::PerToolUse,
        "smart" => CheckpointStrategy::Smart,
        _ => return Err(format!("Invalid checkpoint strategy: {}", checkpoint_strategy)),
    };
    
    let manager = app.get_or_create_manager(
        session_id,
        project_id,
        PathBuf::from(&project_path),
    ).await.map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;
    
    manager.update_settings(auto_checkpoint_enabled, strategy).await
        .map_err(|e| format!("Failed to update settings: {}", e))
}

/// Gets diff between two checkpoints
#[tauri::command]
pub async fn get_checkpoint_diff(
    from_checkpoint_id: String,
    to_checkpoint_id: String,
    session_id: String,
    project_id: String,
) -> Result<crate::checkpoint::CheckpointDiff, String> {
    use crate::checkpoint::storage::CheckpointStorage;
    
    log::info!("Getting diff between checkpoints: {} -> {}", from_checkpoint_id, to_checkpoint_id);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let storage = CheckpointStorage::new(claude_dir);
    
    // Load both checkpoints
    let (from_checkpoint, from_files, _) = storage.load_checkpoint(&project_id, &session_id, &from_checkpoint_id)
        .map_err(|e| format!("Failed to load source checkpoint: {}", e))?;
    let (to_checkpoint, to_files, _) = storage.load_checkpoint(&project_id, &session_id, &to_checkpoint_id)
        .map_err(|e| format!("Failed to load target checkpoint: {}", e))?;
    
    // Build file maps
    let mut from_map: std::collections::HashMap<PathBuf, &crate::checkpoint::FileSnapshot> = std::collections::HashMap::new();
    for file in &from_files {
        from_map.insert(file.file_path.clone(), file);
    }
    
    let mut to_map: std::collections::HashMap<PathBuf, &crate::checkpoint::FileSnapshot> = std::collections::HashMap::new();
    for file in &to_files {
        to_map.insert(file.file_path.clone(), file);
    }
    
    // Calculate differences
    let mut modified_files = Vec::new();
    let mut added_files = Vec::new();
    let mut deleted_files = Vec::new();
    
    // Check for modified and deleted files
    for (path, from_file) in &from_map {
        if let Some(to_file) = to_map.get(path) {
            if from_file.hash != to_file.hash {
                // File was modified
                let additions = to_file.content.lines().count();
                let deletions = from_file.content.lines().count();
                
                modified_files.push(crate::checkpoint::FileDiff {
                    path: path.clone(),
                    additions,
                    deletions,
                    diff_content: None, // TODO: Generate actual diff
                });
            }
        } else {
            // File was deleted
            deleted_files.push(path.clone());
        }
    }
    
    // Check for added files
    for (path, _) in &to_map {
        if !from_map.contains_key(path) {
            added_files.push(path.clone());
        }
    }
    
    // Calculate token delta
    let token_delta = (to_checkpoint.metadata.total_tokens as i64) - (from_checkpoint.metadata.total_tokens as i64);
    
    Ok(crate::checkpoint::CheckpointDiff {
        from_checkpoint_id,
        to_checkpoint_id,
        modified_files,
        added_files,
        deleted_files,
        token_delta,
    })
}

/// Tracks a message for checkpointing
#[tauri::command]
pub async fn track_checkpoint_message(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
    message: String,
) -> Result<(), String> {
    log::info!("Tracking message for session: {}", session_id);
    
    let manager = app.get_or_create_manager(
        session_id,
        project_id,
        PathBuf::from(project_path),
    ).await.map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;
    
    manager.track_message(message).await
        .map_err(|e| format!("Failed to track message: {}", e))
}

/// Checks if auto-checkpoint should be triggered
#[tauri::command]
pub async fn check_auto_checkpoint(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
    message: String,
) -> Result<bool, String> {
    log::info!("Checking auto-checkpoint for session: {}", session_id);
    
    let manager = app.get_or_create_manager(
        session_id.clone(),
        project_id,
        PathBuf::from(project_path),
    ).await.map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;
    
    Ok(manager.should_auto_checkpoint(&message).await)
}

/// Triggers cleanup of old checkpoints
#[tauri::command]
pub async fn cleanup_old_checkpoints(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
    keep_count: usize,
) -> Result<usize, String> {
    log::info!("Cleaning up old checkpoints for session: {}, keeping {}", session_id, keep_count);
    
    let manager = app.get_or_create_manager(
        session_id.clone(),
        project_id.clone(),
        PathBuf::from(project_path),
    ).await.map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;
    
    manager.storage.cleanup_old_checkpoints(&project_id, &session_id, keep_count)
        .map_err(|e| format!("Failed to cleanup checkpoints: {}", e))
}

/// Gets checkpoint settings for a session
#[tauri::command]
pub async fn get_checkpoint_settings(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
) -> Result<serde_json::Value, String> {
    log::info!("Getting checkpoint settings for session: {}", session_id);
    
    let manager = app.get_or_create_manager(
        session_id,
        project_id,
        PathBuf::from(project_path),
    ).await.map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;
    
    let timeline = manager.get_timeline().await;
    
    Ok(serde_json::json!({
        "auto_checkpoint_enabled": timeline.auto_checkpoint_enabled,
        "checkpoint_strategy": timeline.checkpoint_strategy,
        "total_checkpoints": timeline.total_checkpoints,
        "current_checkpoint_id": timeline.current_checkpoint_id,
    }))
}

/// Clears checkpoint manager for a session (cleanup on session end)
#[tauri::command]
pub async fn clear_checkpoint_manager(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
) -> Result<(), String> {
    log::info!("Clearing checkpoint manager for session: {}", session_id);
    
    app.remove_manager(&session_id).await;
    Ok(())
}

/// Gets checkpoint state statistics (for debugging/monitoring)
#[tauri::command]
pub async fn get_checkpoint_state_stats(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
) -> Result<serde_json::Value, String> {
    let active_count = app.active_count().await;
    let active_sessions = app.list_active_sessions().await;
    
    Ok(serde_json::json!({
        "active_managers": active_count,
        "active_sessions": active_sessions,
    }))
}

/// Gets files modified in the last N minutes for a session
#[tauri::command]
pub async fn get_recently_modified_files(
    app: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
    minutes: i64,
) -> Result<Vec<String>, String> {
    use chrono::{Duration, Utc};
    
    log::info!("Getting files modified in the last {} minutes for session: {}", minutes, session_id);
    
    let manager = app.get_or_create_manager(
        session_id,
        project_id,
        PathBuf::from(project_path),
    ).await.map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;
    
    let since = Utc::now() - Duration::minutes(minutes);
    let modified_files = manager.get_files_modified_since(since).await;
    
    // Also log the last modification time
    if let Some(last_mod) = manager.get_last_modification_time().await {
        log::info!("Last file modification was at: {}", last_mod);
    }
    
    Ok(modified_files.into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

/// Tracks multiple session messages at once (batch operation)
#[tauri::command]
pub async fn track_session_messages(
    state: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
    messages: Vec<String>,
) -> Result<(), String> {
    let mgr = state.get_or_create_manager(
        session_id, project_id, std::path::PathBuf::from(project_path)
    ).await.map_err(|e| e.to_string())?;

    for m in messages {
        mgr.track_message(m).await.map_err(|e| e.to_string())?;
    }
    Ok(())
} 