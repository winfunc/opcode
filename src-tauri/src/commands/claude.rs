use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

/// Global state to track current Claude process
pub struct ClaudeProcessState {
    pub current_process: Arc<Mutex<Option<Child>>>,
}

impl Default for ClaudeProcessState {
    fn default() -> Self {
        Self {
            current_process: Arc::new(Mutex::new(None)),
        }
    }
}

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
    /// Unix timestamp of the most recent session (if any)
    pub most_recent_session: Option<u64>,
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

/// Finds the full path to the claude binary
/// This is necessary because macOS apps have a limited PATH environment
fn find_claude_binary(app_handle: &AppHandle) -> Result<String, String> {
    crate::claude_binary::find_claude_binary(app_handle)
}

/// Gets the path to the ~/.claude directory
fn get_claude_dir() -> Result<PathBuf> {
    dirs::home_dir()
        .context("Could not find home directory")?
        .join(".claude")
        .canonicalize()
        .context("Could not find ~/.claude directory")
}

/// Maximum number of lines inspected per session file when looking for `cwd`.
///
/// Newer Claude Code session files can start with several entries that carry
/// no `cwd` (e.g. `last-prompt`, `permission-mode`), so the first handful of
/// lines is not enough. The cap keeps the worst case bounded.
const MAX_CWD_SCAN_LINES: usize = 200;

/// Maximum number of session files inspected per project directory.
const MAX_CWD_SCAN_FILES: usize = 5;

/// Lines longer than this are skipped without being parsed, so a huge line
/// can never blow up memory use.
const MAX_CWD_SCAN_LINE_BYTES: u64 = 1024 * 1024;

/// Reads one line into `buf` (cleared first), reading at most
/// `MAX_CWD_SCAN_LINE_BYTES` of it. Any remainder of an over-long line is
/// discarded. Returns `Ok(None)` at end of file, `Ok(Some(true))` when the
/// line fits in `buf` and `Ok(Some(false))` when it was too long to keep.
fn read_line_capped<R: BufRead>(
    reader: &mut R,
    buf: &mut Vec<u8>,
) -> std::io::Result<Option<bool>> {
    use std::io::Read;

    buf.clear();
    let read = reader
        .by_ref()
        .take(MAX_CWD_SCAN_LINE_BYTES)
        .read_until(b'\n', buf)?;
    if read == 0 {
        return Ok(None);
    }
    if buf.last() == Some(&b'\n') || (read as u64) < MAX_CWD_SCAN_LINE_BYTES {
        return Ok(Some(true));
    }

    // Over-long line: drop the rest of it without buffering.
    loop {
        let (consumed, done) = {
            let available = reader.fill_buf()?;
            if available.is_empty() {
                (0, true)
            } else if let Some(pos) = available.iter().position(|&b| b == b'\n') {
                (pos + 1, true)
            } else {
                (available.len(), false)
            }
        };
        reader.consume(consumed);
        if done {
            break;
        }
    }
    buf.clear();
    Ok(Some(false))
}

/// Looks for a non-empty top-level `cwd` in one session file.
///
/// Streams the file line by line, stops at the first match and never reads
/// more than `MAX_CWD_SCAN_LINES` lines, so the common case (cwd within the
/// first few lines) costs the same as before.
fn find_cwd_in_session_file(path: &std::path::Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let mut buf = Vec::new();

    for _ in 0..MAX_CWD_SCAN_LINES {
        match read_line_capped(&mut reader, &mut buf) {
            Ok(Some(true)) => {}
            Ok(Some(false)) => continue,
            Ok(None) | Err(_) => break,
        }
        // Cheap pre-filter: skip JSON parsing for lines that cannot hold a cwd.
        if !buf.windows(5).any(|w| w == b"\"cwd\"") {
            continue;
        }
        if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&buf) {
            if let Some(cwd) = json.get("cwd").and_then(|v| v.as_str()) {
                if !cwd.is_empty() {
                    return Some(cwd.to_string());
                }
            }
        }
    }
    None
}

/// Gets the actual project path by reading the cwd from the JSONL entries
fn get_project_path_from_sessions(project_dir: &PathBuf) -> Result<String, String> {
    // Try the JSONL files in the directory until one yields a cwd
    let entries = fs::read_dir(project_dir)
        .map_err(|e| format!("Failed to read project directory: {}", e))?;

    let mut files_tried = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
            if let Some(cwd) = find_cwd_in_session_file(&path) {
                return Ok(cwd);
            }
            files_tried += 1;
            if files_tried >= MAX_CWD_SCAN_FILES {
                break;
            }
        }
    }

    Err("Could not determine project path from session files".to_string())
}

/// Encodes a project path into the directory name Claude Code uses under
/// `~/.claude/projects`.
///
/// Claude Code replaces every character that is not an ASCII letter or digit
/// with `-` (so `/`, `\`, `:`, `_`, `-`, `.` and spaces all collapse to the same
/// character). It does this per UTF-16 code unit, so a character outside the
/// Basic Multilingual Plane becomes two dashes. This mirrors that behaviour in
/// a single allocation-light pass; the result is *not* reversible, see
/// [`decode_project_path`].
pub(crate) fn encode_project_path(path: &str) -> String {
    let mut encoded = String::with_capacity(path.len());
    for c in path.chars() {
        if c.is_ascii_alphanumeric() {
            encoded.push(c);
        } else {
            for _ in 0..c.len_utf16() {
                encoded.push('-');
            }
        }
    }
    encoded
}

/// Path of a session's JSONL file inside Claude's projects directory, using
/// Claude Code's folder naming for `project_path` (see [`encode_project_path`]).
pub(crate) fn session_jsonl_path(
    projects_dir: &std::path::Path,
    project_path: &str,
    session_id: &str,
) -> PathBuf {
    projects_dir
        .join(encode_project_path(project_path))
        .join(format!("{}.jsonl", session_id))
}

/// Decodes a project directory name back to its original path
/// The directory names in ~/.claude/projects are encoded paths
///
/// Prefer [`get_project_path_from_sessions`]; this is only the fallback for
/// projects whose session files carry no `cwd`. The encoding is lossy (`/`,
/// `_`, `-`, `.` and spaces all become `-`), so the real path is recovered by
/// matching the name against what actually exists on disk, see
/// [`resolve_project_dir_name`]. If nothing on disk matches, the old
/// best-effort guess (every `-` becomes `/`) is returned.
fn decode_project_path(encoded: &str) -> String {
    resolve_project_dir_name(encoded).unwrap_or_else(|| match split_encoded_root(encoded) {
        Some((root, sep, rest)) => format!("{}{}", root, rest.replace('-', &sep.to_string())),
        None => encoded.replace('-', "/"),
    })
}

/// Read-only view of the filesystem used to resolve project folder names.
/// Abstracted so the matching logic can be unit-tested (including Windows-style
/// layouts) without touching the real disk. Paths are plain strings in the
/// platform's own syntax (`/a/b` or `C:\a\b`).
trait PathProbe {
    /// Names of the entries directly inside `dir` (no metadata lookups).
    fn child_names(&self, dir: &str) -> Vec<String>;
    /// Whether `path` is a directory (symlinks are followed).
    fn is_dir(&self, path: &str) -> bool;
}

/// [`PathProbe`] backed by the real filesystem.
struct RealFs;

impl PathProbe for RealFs {
    fn child_names(&self, dir: &str) -> Vec<String> {
        match fs::read_dir(dir) {
            Ok(entries) => entries
                .flatten()
                .filter_map(|e| e.file_name().into_string().ok())
                .collect(),
            Err(_) => Vec::new(),
        }
    }

    fn is_dir(&self, path: &str) -> bool {
        std::path::Path::new(path).is_dir()
    }
}

/// Splits a project folder name into `(root, separator, remainder)`.
///
/// * Unix paths start with the encoded root separator: `-Users-me-app` is
///   rooted at `/`.
/// * Windows paths start with a drive letter followed by the encoded `:\`,
///   i.e. `C--Users-me-app` is rooted at `C:\`.
///
/// Anything else (for example UNC paths) is not supported and yields `None`.
fn split_encoded_root(encoded: &str) -> Option<(String, char, &str)> {
    if let Some(rest) = encoded.strip_prefix('-') {
        return Some(("/".to_string(), '/', rest)).filter(|(_, _, r)| !r.is_empty());
    }
    let bytes = encoded.as_bytes();
    if bytes.len() > 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b'-' && bytes[2] == b'-' {
        return Some((format!("{}:\\", bytes[0] as char), '\\', &encoded[3..]));
    }
    None
}

/// Resolves a `~/.claude/projects` folder name to the real directory it was
/// created from, or `None` if no existing directory encodes to that name.
fn resolve_project_dir_name(encoded: &str) -> Option<String> {
    resolve_project_dir_name_with(encoded, &RealFs)
}

/// Returns the number of bytes of `rest` that the encoding of `name` occupies
/// if `rest` starts with that encoding. Allocation-free equivalent of
/// `rest.starts_with(&encode_project_path(name))`.
fn encoded_name_prefix_len(name: &str, rest: &str) -> Option<usize> {
    let rest = rest.as_bytes();
    let mut i = 0;
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            if rest.get(i) != Some(&(c as u8)) {
                return None;
            }
            i += 1;
        } else {
            for _ in 0..c.len_utf16() {
                if rest.get(i) != Some(&b'-') {
                    return None;
                }
                i += 1;
            }
        }
    }
    Some(i)
}

/// Core of [`resolve_project_dir_name`], generic over the filesystem view.
///
/// Instead of guessing which `-` was a separator, walk down from the root:
/// at each level keep only the child directories whose encoded name matches
/// the front of what is left of the folder name, then recurse. That costs one
/// directory listing per path level (not exponential) and, when several
/// layouts encode identically, deterministically picks the first match in
/// name order.
fn resolve_project_dir_name_with(encoded: &str, probe: &dyn PathProbe) -> Option<String> {
    let (root, sep, rest) = split_encoded_root(encoded)?;
    if rest.is_empty() {
        return None;
    }
    resolve_below(&root, sep, rest, probe)
}

fn resolve_below(dir: &str, sep: char, rest: &str, probe: &dyn PathProbe) -> Option<String> {
    // (name, remaining encoded text after this component, or None if this
    // component consumes the whole remainder)
    let mut candidates: Vec<(String, Option<usize>)> = probe
        .child_names(dir)
        .into_iter()
        .filter_map(|name| {
            let len = encoded_name_prefix_len(&name, rest)?;
            if len == rest.len() {
                Some((name, None))
            } else if rest.as_bytes()[len] == b'-' {
                Some((name, Some(len + 1)))
            } else {
                None
            }
        })
        .collect();
    candidates.sort_by(|a, b| a.0.cmp(&b.0));

    for (name, next) in candidates {
        let child = if dir.ends_with(sep) {
            format!("{}{}", dir, name)
        } else {
            format!("{}{}{}", dir, sep, name)
        };
        if !probe.is_dir(&child) {
            continue;
        }
        match next {
            None => return Some(child),
            Some(offset) => {
                if let Some(found) = resolve_below(&child, sep, &rest[offset..], probe) {
                    return Some(found);
                }
            }
        }
    }
    None
}

/// Resolved project paths keyed by project folder, valid while the folder's
/// modification time is unchanged (it changes whenever a session file is
/// added or removed). Avoids re-reading session files and re-walking the
/// filesystem on every `list_projects` call.
static PROJECT_PATH_CACHE: std::sync::OnceLock<std::sync::Mutex<ProjectPathCache>> =
    std::sync::OnceLock::new();

/// Project folder -> (folder mtime when resolved, resolved path).
type ProjectPathCache = std::collections::HashMap<PathBuf, (Option<SystemTime>, String)>;

/// Works out the real directory a `~/.claude/projects/<name>` folder belongs to.
///
/// Order of trust: (1) the `cwd` recorded in the session files, (2) the folder
/// name resolved against the real filesystem, (3) a best-effort guess. Only
/// the first two are cached, so a guess is retried once the directory exists.
fn resolve_project_path(project_dir: &PathBuf, dir_name: &str) -> String {
    let modified = fs::metadata(project_dir).and_then(|m| m.modified()).ok();
    let cache = PROJECT_PATH_CACHE.get_or_init(Default::default);

    if let Ok(guard) = cache.lock() {
        if let Some((cached_at, path)) = guard.get(project_dir) {
            if modified.is_some() && *cached_at == modified {
                return path.clone();
            }
        }
    }

    let resolved = match get_project_path_from_sessions(project_dir) {
        Ok(path) => Some(path),
        Err(e) => {
            log::debug!(
                "No cwd in sessions for {} ({}), resolving from folder name",
                dir_name,
                e
            );
            resolve_project_dir_name(dir_name)
        }
    };

    match resolved {
        Some(path) => {
            if let Ok(mut guard) = cache.lock() {
                guard.insert(project_dir.clone(), (modified, path.clone()));
            }
            path
        }
        None => {
            log::warn!(
                "Could not resolve the project path for {}; using a best-effort guess",
                dir_name
            );
            decode_project_path(dir_name)
        }
    }
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
                            if content.starts_with("<command-name>")
                                || content.starts_with("<local-command-stdout>")
                            {
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
    // Convert std::process::Command to tokio::process::Command
    let _std_cmd = crate::claude_binary::create_command_with_env(program);

    // Create a new tokio Command from the program path
    let mut tokio_cmd = Command::new(program);

    // Copy over all environment variables
    for (key, value) in std::env::vars() {
        if key == "PATH"
            || key == "HOME"
            || key == "USER"
            || key == "SHELL"
            || key == "LANG"
            || key == "LC_ALL"
            || key.starts_with("LC_")
            || key == "NODE_PATH"
            || key == "NVM_DIR"
            || key == "NVM_BIN"
            || key == "HOMEBREW_PREFIX"
            || key == "HOMEBREW_CELLAR"
        {
            log::debug!("Inheriting env var: {}={}", key, value);
            tokio_cmd.env(&key, &value);
        }
    }

    // Add NVM support if the program is in an NVM directory
    if program.contains("/.nvm/versions/node/") {
        if let Some(node_bin_dir) = std::path::Path::new(program).parent() {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let node_bin_str = node_bin_dir.to_string_lossy();
            if !current_path.contains(&node_bin_str.as_ref()) {
                let new_path = format!("{}:{}", node_bin_str, current_path);
                tokio_cmd.env("PATH", new_path);
            }
        }
    }

    // Add Homebrew support if the program is in a Homebrew directory
    if program.contains("/homebrew/") || program.contains("/opt/homebrew/") {
        if let Some(program_dir) = std::path::Path::new(program).parent() {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let homebrew_bin_str = program_dir.to_string_lossy();
            if !current_path.contains(&homebrew_bin_str.as_ref()) {
                let new_path = format!("{}:{}", homebrew_bin_str, current_path);
                log::debug!(
                    "Adding Homebrew bin directory to PATH: {}",
                    homebrew_bin_str
                );
                tokio_cmd.env("PATH", new_path);
            }
        }
    }

    tokio_cmd
}

/// Creates a system binary command with the given arguments
fn create_system_command(claude_path: &str, args: Vec<String>, project_path: &str) -> Command {
    let mut cmd = create_command_with_env(claude_path);

    // Add all arguments
    for arg in args {
        cmd.arg(arg);
    }

    cmd.current_dir(project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    cmd
}

/// Gets the user's home directory path
#[tauri::command]
pub async fn get_home_directory() -> Result<String, String> {
    dirs::home_dir()
        .and_then(|path| path.to_str().map(|s| s.to_string()))
        .ok_or_else(|| "Could not determine home directory".to_string())
}

/// Lists all projects in the ~/.claude/projects directory
#[tauri::command]
pub async fn list_projects() -> Result<Vec<Project>, String> {
    // Blocking filesystem work: keep it off the async runtime threads.
    tokio::task::spawn_blocking(list_projects_blocking)
        .await
        .map_err(|e| format!("Failed to list projects: {}", e))?
}

fn list_projects_blocking() -> Result<Vec<Project>, String> {
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

            // Resolve the real project path (session cwd, then filesystem match)
            let project_path = resolve_project_path(&path, dir_name);

            // List all JSONL files (sessions) in this project directory
            let mut sessions = Vec::new();
            let mut most_recent_session: Option<u64> = None;

            if let Ok(session_entries) = fs::read_dir(&path) {
                for session_entry in session_entries.flatten() {
                    let session_path = session_entry.path();
                    if session_path.is_file()
                        && session_path.extension().and_then(|s| s.to_str()) == Some("jsonl")
                    {
                        if let Some(session_id) = session_path.file_stem().and_then(|s| s.to_str())
                        {
                            sessions.push(session_id.to_string());

                            // Track the most recent session timestamp
                            if let Ok(metadata) = fs::metadata(&session_path) {
                                let modified = metadata
                                    .modified()
                                    .unwrap_or(SystemTime::UNIX_EPOCH)
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs();

                                most_recent_session = Some(match most_recent_session {
                                    Some(current) => current.max(modified),
                                    None => modified,
                                });
                            }
                        }
                    }
                }
            }

            projects.push(Project {
                id: dir_name.to_string(),
                path: project_path,
                sessions,
                created_at,
                most_recent_session,
            });
        }
    }

    // Sort projects by most recent session activity, then by creation time
    projects.sort_by(|a, b| {
        // First compare by most recent session
        match (a.most_recent_session, b.most_recent_session) {
            (Some(a_time), Some(b_time)) => b_time.cmp(&a_time),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => b.created_at.cmp(&a.created_at),
        }
    });

    log::info!("Found {} projects", projects.len());
    Ok(projects)
}

/// Creates a new project for the given directory path
#[tauri::command]
pub async fn create_project(path: String) -> Result<Project, String> {
    log::info!("Creating project for path: {}", path);

    // Encode the path to create a project ID
    let project_id = encode_project_path(&path);

    // Get claude directory
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let projects_dir = claude_dir.join("projects");

    // Create projects directory if it doesn't exist
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir)
            .map_err(|e| format!("Failed to create projects directory: {}", e))?;
    }

    // Create project directory if it doesn't exist
    let project_dir = projects_dir.join(&project_id);
    if !project_dir.exists() {
        fs::create_dir_all(&project_dir)
            .map_err(|e| format!("Failed to create project directory: {}", e))?;
    }

    // Get creation time
    let metadata = fs::metadata(&project_dir)
        .map_err(|e| format!("Failed to read directory metadata: {}", e))?;

    let created_at = metadata
        .created()
        .or_else(|_| metadata.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Return the created project
    Ok(Project {
        id: project_id,
        path,
        sessions: Vec::new(),
        created_at,
        most_recent_session: None,
    })
}

/// Gets sessions for a specific project
#[tauri::command]
pub async fn get_project_sessions(project_id: String) -> Result<Vec<Session>, String> {
    // Blocking filesystem work: keep it off the async runtime threads.
    tokio::task::spawn_blocking(move || get_project_sessions_blocking(project_id))
        .await
        .map_err(|e| format!("Failed to get project sessions: {}", e))?
}

fn get_project_sessions_blocking(project_id: String) -> Result<Vec<Session>, String> {
    log::info!("Getting sessions for project: {}", project_id);

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    let todos_dir = claude_dir.join("todos");

    if !project_dir.exists() {
        return Err(format!("Project directory not found: {}", project_id));
    }

    // Resolve the real project path (session cwd, then filesystem match)
    let project_path = resolve_project_path(&project_dir, &project_id);

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

    log::info!(
        "Found {} sessions for project {}",
        sessions.len(),
        project_id
    );
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

    #[cfg(not(debug_assertions))]
    let _claude_path = find_claude_binary(&app)?;

    #[cfg(debug_assertions)]
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

    fs::read_to_string(&claude_md_path).map_err(|e| format!("Failed to read CLAUDE.md: {}", e))
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

    use log::debug;
    debug!("Claude path: {}", claude_path);

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

                // Use regex to directly extract version pattern (e.g., "1.0.41")
                let version_regex =
                    regex::Regex::new(r"(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?)")
                        .ok();

                let version = if let Some(regex) = version_regex {
                    regex
                        .captures(&stdout)
                        .and_then(|captures| captures.get(1))
                        .map(|m| m.as_str().to_string())
                } else {
                    None
                };

                let full_output = if stderr.is_empty() {
                    stdout.clone()
                } else {
                    format!("{}\n{}", stdout, stderr)
                };

                // Check if the output matches the expected format
                // Expected format: "1.0.17 (Claude Code)" or similar
                let is_valid = stdout.contains("(Claude Code)") || stdout.contains("Claude Code");

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

    fs::write(&claude_md_path, content).map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;

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

        // Skip hidden files/directories
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') {
                continue;
            }
        }

        if path.is_dir() {
            // Skip common directories that shouldn't be searched
            if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                if matches!(
                    dir_name,
                    "node_modules" | "target" | ".git" | "dist" | "build" | ".next" | "__pycache__"
                ) {
                    continue;
                }
            }

            find_claude_md_recursive(&path, project_root, claude_files)?;
        } else if path.is_file() {
            // Check if it's a CLAUDE.md file (case insensitive)
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if file_name.eq_ignore_ascii_case("CLAUDE.md") {
                    let metadata = fs::metadata(&path)
                        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

                    let relative_path = path
                        .strip_prefix(project_root)
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

    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
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

    fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok("File saved successfully".to_string())
}

/// Loads the JSONL history for a specific session
#[tauri::command]
pub async fn load_session_history(
    session_id: String,
    project_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    log::info!(
        "Loading session history for session: {} in project: {}",
        session_id,
        project_id
    );

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let session_path = claude_dir
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", session_id));

    if !session_path.exists() {
        return Err(format!("Session file not found: {}", session_id));
    }

    let file =
        fs::File::open(&session_path).map_err(|e| format!("Failed to open session file: {}", e))?;

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
    project_path: String,
    prompt: String,
    model: String,
) -> Result<(), String> {
    log::info!(
        "Starting new Claude Code session in: {} with model: {}",
        project_path,
        model
    );

    let claude_path = find_claude_binary(&app)?;

    let args = vec![
        "-p".to_string(),
        prompt.clone(),
        "--model".to_string(),
        model.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--dangerously-skip-permissions".to_string(),
    ];

    let cmd = create_system_command(&claude_path, args, &project_path);
    spawn_claude_process(app, cmd, prompt, model, project_path).await
}

/// Continue an existing Claude Code conversation with streaming output
#[tauri::command]
pub async fn continue_claude_code(
    app: AppHandle,
    project_path: String,
    prompt: String,
    model: String,
) -> Result<(), String> {
    log::info!(
        "Continuing Claude Code conversation in: {} with model: {}",
        project_path,
        model
    );

    let claude_path = find_claude_binary(&app)?;

    let args = vec![
        "-c".to_string(), // Continue flag
        "-p".to_string(),
        prompt.clone(),
        "--model".to_string(),
        model.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--dangerously-skip-permissions".to_string(),
    ];

    let cmd = create_system_command(&claude_path, args, &project_path);
    spawn_claude_process(app, cmd, prompt, model, project_path).await
}

/// Resume an existing Claude Code session by ID with streaming output
#[tauri::command]
pub async fn resume_claude_code(
    app: AppHandle,
    project_path: String,
    session_id: String,
    prompt: String,
    model: String,
) -> Result<(), String> {
    log::info!(
        "Resuming Claude Code session: {} in: {} with model: {}",
        session_id,
        project_path,
        model
    );

    let claude_path = find_claude_binary(&app)?;

    let args = vec![
        "--resume".to_string(),
        session_id.clone(),
        "-p".to_string(),
        prompt.clone(),
        "--model".to_string(),
        model.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--dangerously-skip-permissions".to_string(),
    ];

    let cmd = create_system_command(&claude_path, args, &project_path);
    spawn_claude_process(app, cmd, prompt, model, project_path).await
}

/// Cancel the currently running Claude Code execution
#[tauri::command]
pub async fn cancel_claude_execution(
    app: AppHandle,
    session_id: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Cancelling Claude Code execution for session: {:?}",
        session_id
    );

    let mut killed = false;
    let mut attempted_methods = Vec::new();

    // Method 1: Try to find and kill via ProcessRegistry using session ID
    if let Some(sid) = &session_id {
        let registry = app.state::<crate::process::ProcessRegistryState>();
        match registry.0.get_claude_session_by_id(sid) {
            Ok(Some(process_info)) => {
                log::info!(
                    "Found process in registry for session {}: run_id={}, PID={}",
                    sid,
                    process_info.run_id,
                    process_info.pid
                );
                match registry.0.kill_process(process_info.run_id).await {
                    Ok(success) => {
                        if success {
                            log::info!("Successfully killed process via registry");
                            killed = true;
                        } else {
                            log::warn!("Registry kill returned false");
                        }
                    }
                    Err(e) => {
                        log::warn!("Failed to kill via registry: {}", e);
                    }
                }
                attempted_methods.push("registry");
            }
            Ok(None) => {
                log::warn!("Session {} not found in ProcessRegistry", sid);
            }
            Err(e) => {
                log::error!("Error querying ProcessRegistry: {}", e);
            }
        }
    }

    // Method 2: Try the legacy approach via ClaudeProcessState
    if !killed {
        let claude_state = app.state::<ClaudeProcessState>();
        let mut current_process = claude_state.current_process.lock().await;

        if let Some(mut child) = current_process.take() {
            // Try to get the PID before killing
            let pid = child.id();
            log::info!(
                "Attempting to kill Claude process via ClaudeProcessState with PID: {:?}",
                pid
            );

            // Kill the process
            match child.kill().await {
                Ok(_) => {
                    log::info!("Successfully killed Claude process via ClaudeProcessState");
                    killed = true;
                }
                Err(e) => {
                    log::error!(
                        "Failed to kill Claude process via ClaudeProcessState: {}",
                        e
                    );

                    // Method 3: If we have a PID, try system kill as last resort
                    if let Some(pid) = pid {
                        log::info!("Attempting system kill as last resort for PID: {}", pid);
                        let kill_result = if cfg!(target_os = "windows") {
                            std::process::Command::new("taskkill")
                                .args(["/F", "/PID", &pid.to_string()])
                                .output()
                        } else {
                            std::process::Command::new("kill")
                                .args(["-KILL", &pid.to_string()])
                                .output()
                        };

                        match kill_result {
                            Ok(output) if output.status.success() => {
                                log::info!("Successfully killed process via system command");
                                killed = true;
                            }
                            Ok(output) => {
                                let stderr = String::from_utf8_lossy(&output.stderr);
                                log::error!("System kill failed: {}", stderr);
                            }
                            Err(e) => {
                                log::error!("Failed to execute system kill command: {}", e);
                            }
                        }
                    }
                }
            }
            attempted_methods.push("claude_state");
        } else {
            log::warn!("No active Claude process in ClaudeProcessState");
        }
    }

    if !killed && attempted_methods.is_empty() {
        log::warn!("No active Claude process found to cancel");
    }

    // Always emit cancellation events for UI consistency
    if let Some(sid) = session_id {
        let _ = app.emit(&format!("claude-cancelled:{}", sid), true);
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        let _ = app.emit(&format!("claude-complete:{}", sid), false);
    }

    // Also emit generic events for backward compatibility
    let _ = app.emit("claude-cancelled", true);
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    let _ = app.emit("claude-complete", false);

    if killed {
        log::info!("Claude process cancellation completed successfully");
    } else if !attempted_methods.is_empty() {
        log::warn!("Claude process cancellation attempted but process may have already exited. Attempted methods: {:?}", attempted_methods);
    }

    Ok(())
}

/// Get all running Claude sessions
#[tauri::command]
pub async fn list_running_claude_sessions(
    registry: tauri::State<'_, crate::process::ProcessRegistryState>,
) -> Result<Vec<crate::process::ProcessInfo>, String> {
    registry.0.get_running_claude_sessions()
}

/// Get live output from a Claude session
#[tauri::command]
pub async fn get_claude_session_output(
    registry: tauri::State<'_, crate::process::ProcessRegistryState>,
    session_id: String,
) -> Result<String, String> {
    // Find the process by session ID
    if let Some(process_info) = registry.0.get_claude_session_by_id(&session_id)? {
        registry.0.get_live_output(process_info.run_id)
    } else {
        Ok(String::new())
    }
}

/// Checks that the working directory handed to the `claude` process exists.
///
/// A non-existent directory makes the spawn fail with an opaque OS error, so
/// check up front and return a message that names the offending path.
fn validate_project_dir(project_path: &str) -> Result<(), String> {
    if project_path.trim().is_empty() {
        return Err("Project path is empty".to_string());
    }
    if !std::path::Path::new(project_path).is_dir() {
        return Err(format!(
            "Project directory not found: {}. Check that the folder still exists and has not been moved or renamed.",
            project_path
        ));
    }
    Ok(())
}

/// Helper function to spawn Claude process and handle streaming
async fn spawn_claude_process(
    app: AppHandle,
    mut cmd: Command,
    prompt: String,
    model: String,
    project_path: String,
) -> Result<(), String> {
    use std::sync::Mutex;
    use tokio::io::{AsyncBufReadExt, BufReader};

    validate_project_dir(&project_path)?;

    // Spawn the process
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn Claude: {}", e))?;

    // Get stdout and stderr
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;

    // Get the child PID for logging
    let pid = child.id().unwrap_or(0);
    log::info!("Spawned Claude process with PID: {:?}", pid);

    // Create readers first (before moving child)
    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);

    // We'll extract the session ID from Claude's init message
    let session_id_holder: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let run_id_holder: Arc<Mutex<Option<i64>>> = Arc::new(Mutex::new(None));

    // Store the child process in the global state (for backward compatibility)
    let claude_state = app.state::<ClaudeProcessState>();
    {
        let mut current_process = claude_state.current_process.lock().await;
        // If there's already a process running, kill it first
        if let Some(mut existing_child) = current_process.take() {
            log::warn!("Killing existing Claude process before starting new one");
            let _ = existing_child.kill().await;
        }
        *current_process = Some(child);
    }

    // Spawn tasks to read stdout and stderr
    let app_handle = app.clone();
    let session_id_holder_clone = session_id_holder.clone();
    let run_id_holder_clone = run_id_holder.clone();
    let registry = app.state::<crate::process::ProcessRegistryState>();
    let registry_clone = registry.0.clone();
    let project_path_clone = project_path.clone();
    let prompt_clone = prompt.clone();
    let model_clone = model.clone();
    let stdout_task = tokio::spawn(async move {
        let mut lines = stdout_reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            log::debug!("Claude stdout: {}", line);

            // Parse the line to check for init message with session ID
            if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&line) {
                if msg["type"] == "system" && msg["subtype"] == "init" {
                    if let Some(claude_session_id) = msg["session_id"].as_str() {
                        let mut session_id_guard = session_id_holder_clone.lock().unwrap();
                        if session_id_guard.is_none() {
                            *session_id_guard = Some(claude_session_id.to_string());
                            log::info!("Extracted Claude session ID: {}", claude_session_id);

                            // Now register with ProcessRegistry using Claude's session ID
                            match registry_clone.register_claude_session(
                                claude_session_id.to_string(),
                                pid,
                                project_path_clone.clone(),
                                prompt_clone.clone(),
                                model_clone.clone(),
                            ) {
                                Ok(run_id) => {
                                    log::info!("Registered Claude session with run_id: {}", run_id);
                                    let mut run_id_guard = run_id_holder_clone.lock().unwrap();
                                    *run_id_guard = Some(run_id);
                                }
                                Err(e) => {
                                    log::error!("Failed to register Claude session: {}", e);
                                }
                            }
                        }
                    }
                }
            }

            // Store live output in registry if we have a run_id
            if let Some(run_id) = *run_id_holder_clone.lock().unwrap() {
                let _ = registry_clone.append_live_output(run_id, &line);
            }

            // Emit the line to the frontend with session isolation if we have session ID
            if let Some(ref session_id) = *session_id_holder_clone.lock().unwrap() {
                let _ = app_handle.emit(&format!("claude-output:{}", session_id), &line);
            }
            // Also emit to the generic event for backward compatibility
            let _ = app_handle.emit("claude-output", &line);
        }
    });

    let app_handle_stderr = app.clone();
    let session_id_holder_clone2 = session_id_holder.clone();
    let stderr_task = tokio::spawn(async move {
        let mut lines = stderr_reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            log::error!("Claude stderr: {}", line);
            // Emit error lines to the frontend with session isolation if we have session ID
            if let Some(ref session_id) = *session_id_holder_clone2.lock().unwrap() {
                let _ = app_handle_stderr.emit(&format!("claude-error:{}", session_id), &line);
            }
            // Also emit to the generic event for backward compatibility
            let _ = app_handle_stderr.emit("claude-error", &line);
        }
    });

    // Wait for the process to complete
    let app_handle_wait = app.clone();
    let claude_state_wait = claude_state.current_process.clone();
    let session_id_holder_clone3 = session_id_holder.clone();
    let run_id_holder_clone2 = run_id_holder.clone();
    let registry_clone2 = registry.0.clone();
    tokio::spawn(async move {
        let _ = stdout_task.await;
        let _ = stderr_task.await;

        // Get the child from the state to wait on it
        let mut current_process = claude_state_wait.lock().await;
        if let Some(mut child) = current_process.take() {
            match child.wait().await {
                Ok(status) => {
                    log::info!("Claude process exited with status: {}", status);
                    // Add a small delay to ensure all messages are processed
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    if let Some(ref session_id) = *session_id_holder_clone3.lock().unwrap() {
                        let _ = app_handle_wait
                            .emit(&format!("claude-complete:{}", session_id), status.success());
                    }
                    // Also emit to the generic event for backward compatibility
                    let _ = app_handle_wait.emit("claude-complete", status.success());
                }
                Err(e) => {
                    log::error!("Failed to wait for Claude process: {}", e);
                    // Add a small delay to ensure all messages are processed
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    if let Some(ref session_id) = *session_id_holder_clone3.lock().unwrap() {
                        let _ =
                            app_handle_wait.emit(&format!("claude-complete:{}", session_id), false);
                    }
                    // Also emit to the generic event for backward compatibility
                    let _ = app_handle_wait.emit("claude-complete", false);
                }
            }
        }

        // Unregister from ProcessRegistry if we have a run_id
        if let Some(run_id) = *run_id_holder_clone2.lock().unwrap() {
            let _ = registry_clone2.unregister_process(run_id);
        }

        // Clear the process from state
        *current_process = None;
    });

    Ok(())
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

    let dir_entries =
        fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in dir_entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let entry_path = entry.path();
        let metadata = entry
            .metadata()
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
            entry_path
                .extension()
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
    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
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
                let metadata = entry
                    .metadata()
                    .map_err(|e| format!("Failed to read metadata: {}", e))?;

                let extension = if metadata.is_file() {
                    entry_path
                        .extension()
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
                if matches!(
                    dir_name,
                    "node_modules" | "target" | ".git" | "dist" | "build" | ".next" | "__pycache__"
                ) {
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
    log::info!(
        "Creating checkpoint for session: {} in project: {}",
        session_id,
        project_id
    );

    let manager = app
        .get_or_create_manager(
            session_id.clone(),
            project_id.clone(),
            PathBuf::from(&project_path),
        )
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

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
                manager
                    .track_message(line)
                    .await
                    .map_err(|e| format!("Failed to track message: {}", e))?;
            }
            line_count += 1;
        }
    }

    manager
        .create_checkpoint(description, None)
        .await
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
    log::info!(
        "Restoring checkpoint: {} for session: {}",
        checkpoint_id,
        session_id
    );

    let manager = app
        .get_or_create_manager(
            session_id.clone(),
            project_id.clone(),
            PathBuf::from(&project_path),
        )
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

    let result = manager
        .restore_checkpoint(&checkpoint_id)
        .await
        .map_err(|e| format!("Failed to restore checkpoint: {}", e))?;

    // Update the session JSONL file with restored messages
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let session_path = claude_dir
        .join("projects")
        .join(&result.checkpoint.project_id)
        .join(format!("{}.jsonl", session_id));

    // The manager has already restored the messages internally,
    // but we need to update the actual session file
    let (_, _, messages) = manager
        .storage
        .load_checkpoint(&result.checkpoint.project_id, &session_id, &checkpoint_id)
        .map_err(|e| format!("Failed to load checkpoint data: {}", e))?;

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
    log::info!(
        "Listing checkpoints for session: {} in project: {}",
        session_id,
        project_id
    );

    let manager = app
        .get_or_create_manager(session_id, project_id, PathBuf::from(&project_path))
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

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
    log::info!(
        "Forking from checkpoint: {} to new session: {}",
        checkpoint_id,
        new_session_id
    );

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
    let manager = app
        .get_or_create_manager(
            new_session_id.clone(),
            project_id,
            PathBuf::from(&project_path),
        )
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

    manager
        .fork_from_checkpoint(&checkpoint_id, description)
        .await
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
    log::info!(
        "Getting timeline for session: {} in project: {}",
        session_id,
        project_id
    );

    let manager = app
        .get_or_create_manager(session_id, project_id, PathBuf::from(&project_path))
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

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
        _ => {
            return Err(format!(
                "Invalid checkpoint strategy: {}",
                checkpoint_strategy
            ))
        }
    };

    let manager = app
        .get_or_create_manager(session_id, project_id, PathBuf::from(&project_path))
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

    manager
        .update_settings(auto_checkpoint_enabled, strategy)
        .await
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

    log::info!(
        "Getting diff between checkpoints: {} -> {}",
        from_checkpoint_id,
        to_checkpoint_id
    );

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let storage = CheckpointStorage::new(claude_dir);

    // Load both checkpoints
    let (from_checkpoint, from_files, _) = storage
        .load_checkpoint(&project_id, &session_id, &from_checkpoint_id)
        .map_err(|e| format!("Failed to load source checkpoint: {}", e))?;
    let (to_checkpoint, to_files, _) = storage
        .load_checkpoint(&project_id, &session_id, &to_checkpoint_id)
        .map_err(|e| format!("Failed to load target checkpoint: {}", e))?;

    // Build file maps
    let mut from_map: std::collections::HashMap<PathBuf, &crate::checkpoint::FileSnapshot> =
        std::collections::HashMap::new();
    for file in &from_files {
        from_map.insert(file.file_path.clone(), file);
    }

    let mut to_map: std::collections::HashMap<PathBuf, &crate::checkpoint::FileSnapshot> =
        std::collections::HashMap::new();
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
    let token_delta = (to_checkpoint.metadata.total_tokens as i64)
        - (from_checkpoint.metadata.total_tokens as i64);

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

    let manager = app
        .get_or_create_manager(session_id, project_id, PathBuf::from(project_path))
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

    manager
        .track_message(message)
        .await
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

    let manager = app
        .get_or_create_manager(session_id.clone(), project_id, PathBuf::from(project_path))
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

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
    log::info!(
        "Cleaning up old checkpoints for session: {}, keeping {}",
        session_id,
        keep_count
    );

    let manager = app
        .get_or_create_manager(
            session_id.clone(),
            project_id.clone(),
            PathBuf::from(project_path),
        )
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

    manager
        .storage
        .cleanup_old_checkpoints(&project_id, &session_id, keep_count)
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

    let manager = app
        .get_or_create_manager(session_id, project_id, PathBuf::from(project_path))
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

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

    log::info!(
        "Getting files modified in the last {} minutes for session: {}",
        minutes,
        session_id
    );

    let manager = app
        .get_or_create_manager(session_id, project_id, PathBuf::from(project_path))
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

    let since = Utc::now() - Duration::minutes(minutes);
    let modified_files = manager.get_files_modified_since(since).await;

    // Also log the last modification time
    if let Some(last_mod) = manager.get_last_modification_time().await {
        log::info!("Last file modification was at: {}", last_mod);
    }

    Ok(modified_files
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

/// Track session messages from the frontend for checkpointing
#[tauri::command]
pub async fn track_session_messages(
    state: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
    messages: Vec<String>,
) -> Result<(), String> {
    log::info!(
        "Tracking {} messages for session {}",
        messages.len(),
        session_id
    );

    let manager = state
        .get_or_create_manager(
            session_id.clone(),
            project_id.clone(),
            PathBuf::from(&project_path),
        )
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

    for message in messages {
        manager
            .track_message(message)
            .await
            .map_err(|e| format!("Failed to track message: {}", e))?;
    }

    Ok(())
}

/// Gets hooks configuration from settings at specified scope
#[tauri::command]
pub async fn get_hooks_config(
    scope: String,
    project_path: Option<String>,
) -> Result<serde_json::Value, String> {
    log::info!(
        "Getting hooks config for scope: {}, project: {:?}",
        scope,
        project_path
    );

    let settings_path = match scope.as_str() {
        "user" => get_claude_dir()
            .map_err(|e| e.to_string())?
            .join("settings.json"),
        "project" => {
            let path = project_path.ok_or("Project path required for project scope")?;
            PathBuf::from(path).join(".claude").join("settings.json")
        }
        "local" => {
            let path = project_path.ok_or("Project path required for local scope")?;
            PathBuf::from(path)
                .join(".claude")
                .join("settings.local.json")
        }
        _ => return Err("Invalid scope".to_string()),
    };

    if !settings_path.exists() {
        log::info!(
            "Settings file does not exist at {:?}, returning empty hooks",
            settings_path
        );
        return Ok(serde_json::json!({}));
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;

    let settings: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))?;

    Ok(settings
        .get("hooks")
        .cloned()
        .unwrap_or(serde_json::json!({})))
}

/// Updates hooks configuration in settings at specified scope
#[tauri::command]
pub async fn update_hooks_config(
    scope: String,
    hooks: serde_json::Value,
    project_path: Option<String>,
) -> Result<String, String> {
    log::info!(
        "Updating hooks config for scope: {}, project: {:?}",
        scope,
        project_path
    );

    let settings_path = match scope.as_str() {
        "user" => get_claude_dir()
            .map_err(|e| e.to_string())?
            .join("settings.json"),
        "project" => {
            let path = project_path.ok_or("Project path required for project scope")?;
            let claude_dir = PathBuf::from(path).join(".claude");
            fs::create_dir_all(&claude_dir)
                .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
            claude_dir.join("settings.json")
        }
        "local" => {
            let path = project_path.ok_or("Project path required for local scope")?;
            let claude_dir = PathBuf::from(path).join(".claude");
            fs::create_dir_all(&claude_dir)
                .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
            claude_dir.join("settings.local.json")
        }
        _ => return Err("Invalid scope".to_string()),
    };

    // Read existing settings or create new
    let mut settings = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))?
    } else {
        serde_json::json!({})
    };

    // Update hooks section
    settings["hooks"] = hooks;

    // Write back with pretty formatting
    let json_string = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, json_string)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok("Hooks configuration updated successfully".to_string())
}

/// Validates a hook command by dry-running it
#[tauri::command]
pub async fn validate_hook_command(command: String) -> Result<serde_json::Value, String> {
    log::info!("Validating hook command syntax");

    // Validate syntax without executing
    let mut cmd = std::process::Command::new("bash");
    cmd.arg("-n") // Syntax check only
        .arg("-c")
        .arg(&command);

    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                Ok(serde_json::json!({
                    "valid": true,
                    "message": "Command syntax is valid"
                }))
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Ok(serde_json::json!({
                    "valid": false,
                    "message": format!("Syntax error: {}", stderr)
                }))
            }
        }
        Err(e) => Err(format!("Failed to validate command: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    /// Helper function to create a test session file
    fn create_test_session_file(
        dir: &PathBuf,
        filename: &str,
        content: &str,
    ) -> Result<(), std::io::Error> {
        let file_path = dir.join(filename);
        let mut file = fs::File::create(file_path)?;
        file.write_all(content.as_bytes())?;
        Ok(())
    }

    #[test]
    fn test_get_project_path_from_sessions_normal_case() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();

        // Create a session file with cwd on the first line
        let content = r#"{"type":"system","cwd":"/Users/test/my-project"}"#;
        create_test_session_file(&project_dir, "session1.jsonl", content).unwrap();

        let result = get_project_path_from_sessions(&project_dir);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "/Users/test/my-project");
    }

    #[test]
    fn test_get_project_path_from_sessions_with_hyphen() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();

        // This is the bug scenario - project path contains hyphens
        let content = r#"{"type":"system","cwd":"/Users/test/data-discovery"}"#;
        create_test_session_file(&project_dir, "session1.jsonl", content).unwrap();

        let result = get_project_path_from_sessions(&project_dir);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "/Users/test/data-discovery");
    }

    #[test]
    fn test_get_project_path_from_sessions_null_cwd_first_line() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();

        // First line has null cwd, second line has valid path
        let content = format!(
            "{}\n{}",
            r#"{"type":"system","cwd":null}"#,
            r#"{"type":"system","cwd":"/Users/test/valid-path"}"#
        );
        create_test_session_file(&project_dir, "session1.jsonl", &content).unwrap();

        let result = get_project_path_from_sessions(&project_dir);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "/Users/test/valid-path");
    }

    #[test]
    fn test_get_project_path_from_sessions_multiple_lines() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();

        // Multiple lines with cwd appearing on line 5
        let content = format!(
            "{}\n{}\n{}\n{}\n{}",
            r#"{"type":"other"}"#,
            r#"{"type":"system","cwd":null}"#,
            r#"{"type":"message"}"#,
            r#"{"type":"system"}"#,
            r#"{"type":"system","cwd":"/Users/test/project"}"#
        );
        create_test_session_file(&project_dir, "session1.jsonl", &content).unwrap();

        let result = get_project_path_from_sessions(&project_dir);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "/Users/test/project");
    }

    #[test]
    fn test_get_project_path_from_sessions_empty_dir() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();

        let result = get_project_path_from_sessions(&project_dir);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            "Could not determine project path from session files"
        );
    }

    #[test]
    fn test_get_project_path_from_sessions_no_jsonl_files() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();

        // Create a non-JSONL file
        create_test_session_file(&project_dir, "readme.txt", "Some text").unwrap();

        let result = get_project_path_from_sessions(&project_dir);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_project_path_from_sessions_no_cwd() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();

        // JSONL file without any cwd field
        let content = format!(
            "{}\n{}\n{}",
            r#"{"type":"system"}"#, r#"{"type":"message"}"#, r#"{"type":"other"}"#
        );
        create_test_session_file(&project_dir, "session1.jsonl", &content).unwrap();

        let result = get_project_path_from_sessions(&project_dir);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_project_path_from_sessions_multiple_sessions() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();

        // Create multiple session files - should return from first valid one
        create_test_session_file(
            &project_dir,
            "session1.jsonl",
            r#"{"type":"system","cwd":"/path1"}"#,
        )
        .unwrap();
        create_test_session_file(
            &project_dir,
            "session2.jsonl",
            r#"{"type":"system","cwd":"/path2"}"#,
        )
        .unwrap();

        let result = get_project_path_from_sessions(&project_dir);
        assert!(result.is_ok());
        // Should get one of the paths (implementation checks first file it finds)
        let path = result.unwrap();
        assert!(path == "/path1" || path == "/path2");
    }

    // ---------------------------------------------------------------------
    // Issue #465 regression tests
    // ---------------------------------------------------------------------

    /// Independent re-implementation of Claude Code's folder naming
    /// (every non-alphanumeric character becomes `-`), kept local to the
    /// tests so they do not depend on the production helper.
    fn claude_dir_name(path: &str) -> String {
        path.chars()
            .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
            .collect()
    }

    /// Creates `<temp>/<rel>` on disk and returns (real path, Claude folder name).
    fn make_real_project(temp: &TempDir, rel: &str) -> (String, String) {
        let real = temp.path().join(rel);
        fs::create_dir_all(&real).unwrap();
        let real = real.to_string_lossy().to_string();
        let encoded = claude_dir_name(&real);
        (real, encoded)
    }

    #[test]
    fn test_issue_465_cwd_found_after_many_lines_without_cwd() {
        // Newer Claude Code session files start with entries that carry no `cwd`
        // (e.g. `last-prompt`, `permission-mode`). The lookup must keep scanning.
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();

        let mut content = String::new();
        content.push_str("{\"type\":\"permission-mode\",\"mode\":\"default\"}\n");
        for i in 0..40 {
            content.push_str(&format!("{{\"type\":\"last-prompt\",\"n\":{}}}\n", i));
        }
        content.push_str(r#"{"type":"user","cwd":"/home/michal_mikes/my-project"}"#);
        create_test_session_file(&project_dir, "session1.jsonl", &content).unwrap();

        let result = get_project_path_from_sessions(&project_dir);
        assert_eq!(result.unwrap(), "/home/michal_mikes/my-project");
    }

    #[test]
    fn test_encode_project_path_matches_claude_code_naming() {
        assert_eq!(encode_project_path("/Users/me/app"), "-Users-me-app");
        assert_eq!(
            encode_project_path("/home/michal_mikes/projects"),
            "-home-michal-mikes-projects"
        );
        assert_eq!(
            encode_project_path("/Users/me/.projects/myproject"),
            "-Users-me--projects-myproject"
        );
        assert_eq!(encode_project_path("/a/my-app_v2.0"), "-a-my-app-v2-0");
        assert_eq!(encode_project_path("/a/with space"), "-a-with-space");
        assert_eq!(encode_project_path(""), "");
    }

    #[test]
    fn test_encode_project_path_windows_and_unicode() {
        assert_eq!(
            encode_project_path(r"C:\Users\john_doe\app"),
            "C--Users-john-doe-app"
        );
        // Claude Code (JavaScript) replaces per UTF-16 code unit: a BMP char is
        // one dash, a supplementary-plane char (surrogate pair) is two.
        assert_eq!(encode_project_path("/a/caf\u{e9}"), "-a-caf-");
        assert_eq!(encode_project_path("/a/\u{1F600}"), "-a---");
    }

    #[test]
    fn test_encode_project_path_is_idempotent_on_encoded_names() {
        let once = encode_project_path("/Users/me/.projects/my_app");
        assert_eq!(encode_project_path(&once), once);
    }

    #[test]
    fn test_resolve_project_path_prefers_cwd_from_sessions() {
        let temp = TempDir::new().unwrap();
        let project_dir = temp.path().join("-home-john-doe-app");
        fs::create_dir_all(&project_dir).unwrap();
        create_test_session_file(
            &project_dir,
            "s.jsonl",
            "{\"type\":\"permission-mode\"}\n{\"cwd\":\"/home/john_doe/app\"}\n",
        )
        .unwrap();

        assert_eq!(
            resolve_project_path(&project_dir, "-home-john-doe-app"),
            "/home/john_doe/app"
        );
    }

    #[test]
    fn test_resolve_project_path_falls_back_to_filesystem_without_sessions() {
        // New project: folder exists but has no session files yet (the case that
        // used to produce "Failed to send prompt").
        let temp = TempDir::new().unwrap();
        let (real, encoded) = make_real_project(&temp, "john_doe/my-app");
        let project_dir = temp.path().join("claude-projects").join(&encoded);
        fs::create_dir_all(&project_dir).unwrap();

        assert_eq!(resolve_project_path(&project_dir, &encoded), real);
    }

    #[test]
    fn test_resolve_project_path_does_not_cache_a_guess() {
        let temp = TempDir::new().unwrap();
        let encoded = claude_dir_name(&format!("{}/later_created", temp.path().display()));
        let project_dir = temp.path().join("claude-projects").join(&encoded);
        fs::create_dir_all(&project_dir).unwrap();

        // Directory does not exist yet: best-effort guess, must not be cached.
        let guess = resolve_project_path(&project_dir, &encoded);
        assert!(!std::path::Path::new(&guess).exists());

        // Once the real directory appears the next call must find it.
        let real = temp.path().join("later_created");
        fs::create_dir_all(&real).unwrap();
        assert_eq!(
            resolve_project_path(&project_dir, &encoded),
            real.to_string_lossy()
        );
    }

    #[test]
    fn test_session_jsonl_path_uses_claude_folder_naming() {
        let projects = std::path::Path::new("/home/u/.claude/projects");
        assert_eq!(
            session_jsonl_path(projects, "/home/michal_mikes/my-app", "abc"),
            PathBuf::from("/home/u/.claude/projects/-home-michal-mikes-my-app/abc.jsonl")
        );
        assert_eq!(
            session_jsonl_path(projects, "/Users/me/.projects/x", "s1"),
            PathBuf::from("/home/u/.claude/projects/-Users-me--projects-x/s1.jsonl")
        );
    }

    #[test]
    fn test_validate_project_dir() {
        let temp = TempDir::new().unwrap();
        let ok = temp.path().to_string_lossy().to_string();
        assert!(validate_project_dir(&ok).is_ok());

        let missing = temp.path().join("michal/mikes/projects");
        let err = validate_project_dir(&missing.to_string_lossy()).unwrap_err();
        assert!(err.contains("Project directory not found"), "{}", err);
        assert!(err.contains("michal/mikes/projects"), "{}", err);

        let file = temp.path().join("a_file");
        fs::write(&file, "x").unwrap();
        assert!(validate_project_dir(&file.to_string_lossy()).is_err());

        let err = validate_project_dir("  ").unwrap_err();
        assert!(err.contains("empty"), "{}", err);
    }

    #[test]
    fn test_issue_465_cwd_scan_is_bounded() {
        // A cwd that only appears after MAX_CWD_SCAN_LINES lines is not searched
        // for: the scan must stay cheap on huge sessions.
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();

        let mut content = String::new();
        for _ in 0..(MAX_CWD_SCAN_LINES + 50) {
            content.push_str("{\"type\":\"assistant\"}\n");
        }
        content.push_str(r#"{"type":"user","cwd":"/too/late"}"#);
        create_test_session_file(&project_dir, "session1.jsonl", &content).unwrap();

        assert!(get_project_path_from_sessions(&project_dir).is_err());
    }

    #[test]
    fn test_issue_465_cwd_scan_skips_oversized_and_invalid_lines() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();

        let mut content: Vec<u8> = Vec::new();
        content.extend_from_slice(b"{\"cwd\":\"");
        content.extend(std::iter::repeat_n(
            b'x',
            MAX_CWD_SCAN_LINE_BYTES as usize + 10,
        ));
        content.extend_from_slice(b"\"}\n");
        content.extend_from_slice(&[0xff, 0xfe, b'\n']); // invalid UTF-8 line
        content.extend_from_slice(b"{\"type\":\"user\",\"cwd\":\"/ok/path_1\"}\n");
        fs::write(project_dir.join("session1.jsonl"), content).unwrap();

        assert_eq!(
            get_project_path_from_sessions(&project_dir).unwrap(),
            "/ok/path_1"
        );
    }

    #[test]
    fn test_issue_465_cwd_found_in_later_file_when_first_has_none() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().to_path_buf();
        create_test_session_file(&project_dir, "a.jsonl", "{\"type\":\"summary\"}\n").unwrap();
        create_test_session_file(&project_dir, "b.jsonl", "{\"cwd\":\"/b/c_d\"}\n").unwrap();

        assert_eq!(
            get_project_path_from_sessions(&project_dir).unwrap(),
            "/b/c_d"
        );
    }

    /// In-memory filesystem used to test path resolution without touching disk.
    /// Paths are plain strings so Windows-style layouts (`C:\\Users\\x`) can be
    /// tested on any host.
    struct FakeFs {
        children: std::collections::HashMap<String, Vec<String>>,
        dirs: std::collections::HashSet<String>,
        lists: std::cell::Cell<usize>,
    }

    impl FakeFs {
        fn new(paths: &[&str]) -> Self {
            let mut children: std::collections::HashMap<String, Vec<String>> = Default::default();
            let mut dirs = std::collections::HashSet::new();
            for p in paths {
                let (root, sep, rest) = if let Some(rest) = p.strip_prefix('/') {
                    ("/".to_string(), '/', rest)
                } else {
                    (p[..3].to_string(), '\\', &p[3..])
                };
                dirs.insert(root.clone());
                let mut cur = root;
                for comp in rest.split(sep).filter(|c| !c.is_empty()) {
                    let list = children.entry(cur.clone()).or_default();
                    if !list.iter().any(|c| c == comp) {
                        list.push(comp.to_string());
                    }
                    cur = if cur.ends_with(sep) {
                        format!("{}{}", cur, comp)
                    } else {
                        format!("{}{}{}", cur, sep, comp)
                    };
                    dirs.insert(cur.clone());
                }
            }
            Self {
                children,
                dirs,
                lists: std::cell::Cell::new(0),
            }
        }
    }

    impl PathProbe for FakeFs {
        fn child_names(&self, dir: &str) -> Vec<String> {
            self.lists.set(self.lists.get() + 1);
            self.children.get(dir).cloned().unwrap_or_default()
        }
        fn is_dir(&self, path: &str) -> bool {
            self.dirs.contains(path)
        }
    }

    #[test]
    fn test_resolve_windows_drive_paths() {
        let fs = FakeFs::new(&[
            r"C:\Users\john_doe\app",
            r"C:\dev\my-app",
            r"C:\Users\me\.cfg\tool",
        ]);
        assert_eq!(
            resolve_project_dir_name_with("C--Users-john-doe-app", &fs).as_deref(),
            Some(r"C:\Users\john_doe\app")
        );
        assert_eq!(
            resolve_project_dir_name_with("C--dev-my-app", &fs).as_deref(),
            Some(r"C:\dev\my-app")
        );
        assert_eq!(
            resolve_project_dir_name_with("C--Users-me--cfg-tool", &fs).as_deref(),
            Some(r"C:\Users\me\.cfg\tool")
        );
    }

    #[test]
    fn test_resolve_windows_unsupported_and_missing_return_none() {
        let fs = FakeFs::new(&[r"C:\Users\x"]);
        // UNC paths (\\server\share) are not supported: no drive letter
        assert_eq!(resolve_project_dir_name_with("--server-share-x", &fs), None);
        // Drive that does not exist in the view
        assert_eq!(resolve_project_dir_name_with("D--Users-x", &fs), None);
        // Drive prefix with nothing after it
        assert_eq!(resolve_project_dir_name_with("C--", &fs), None);
    }

    #[test]
    fn test_decode_project_path_best_effort_guess_keeps_platform_shape() {
        // Nothing on disk matches these names, so the last-resort guess is used.
        assert_eq!(
            decode_project_path("-nonexistent-zzz-qqq"),
            "/nonexistent/zzz/qqq"
        );
        assert_eq!(
            decode_project_path("Q--nonexistent-zzz"),
            r"Q:\nonexistent\zzz"
        );
    }

    #[test]
    fn test_resolve_prefers_deterministic_match_when_ambiguous() {
        // Both /a/b-c and /a/b/c exist: encoded names are identical.
        let fs = FakeFs::new(&["/a/b-c", "/a/b/c"]);
        let first = resolve_project_dir_name_with("-a-b-c", &fs);
        let second = resolve_project_dir_name_with("-a-b-c", &fs);
        assert_eq!(first, second);
        assert!(first.is_some());
    }

    #[test]
    fn test_resolve_backtracks_out_of_dead_ends() {
        // "/a/b" exists but has no matching child, and the real project is
        // /a/b-c/d, so the search must abandon the "b" branch and backtrack.
        let fs = FakeFs::new(&["/a/b", "/a/b-c/d"]);
        assert_eq!(
            resolve_project_dir_name_with("-a-b-c-d", &fs).as_deref(),
            Some("/a/b-c/d")
        );
    }

    #[test]
    fn test_resolve_returns_none_when_nothing_matches() {
        let fs = FakeFs::new(&["/a/b"]);
        assert_eq!(resolve_project_dir_name_with("-a-x-y", &fs), None);
        assert_eq!(resolve_project_dir_name_with("", &fs), None);
        assert_eq!(resolve_project_dir_name_with("no-leading-dash", &fs), None);
    }

    #[test]
    fn test_resolve_lists_each_directory_level_once() {
        let fs = FakeFs::new(&["/Users/john_doe/my-app/src"]);
        let got = resolve_project_dir_name_with("-Users-john-doe-my-app-src", &fs);
        assert_eq!(got.as_deref(), Some("/Users/john_doe/my-app/src"));
        // root + Users + john_doe + my-app = 4 listings, never exponential.
        assert!(fs.lists.get() <= 4, "listed {} dirs", fs.lists.get());
    }

    #[test]
    fn test_issue_465_decode_underscore_in_path() {
        let temp_dir = TempDir::new().unwrap();
        let (real, encoded) = make_real_project(&temp_dir, "michal_mikes/projects");
        assert_eq!(decode_project_path(&encoded), real);
    }

    #[test]
    fn test_issue_465_decode_hyphen_in_path() {
        let temp_dir = TempDir::new().unwrap();
        let (real, encoded) = make_real_project(&temp_dir, "user/my-project");
        assert_eq!(decode_project_path(&encoded), real);
    }

    #[test]
    fn test_issue_465_decode_dot_folder_in_path() {
        let temp_dir = TempDir::new().unwrap();
        let (real, encoded) = make_real_project(&temp_dir, "me/.projects/myproject");
        assert_eq!(decode_project_path(&encoded), real);
    }

    #[test]
    fn test_issue_465_decode_mixed_separators_in_path() {
        let temp_dir = TempDir::new().unwrap();
        let (real, encoded) = make_real_project(&temp_dir, "john_doe/.cfg/my-app_v2.0");
        assert_eq!(decode_project_path(&encoded), real);
    }

    /// Baseline timing for the hot path (run with
    /// `cargo test --release -- --ignored --nocapture bench_`).
    #[test]
    #[ignore]
    fn bench_project_path_lookup_baseline() {
        use std::time::Instant;

        let temp_dir = TempDir::new().unwrap();
        let root = temp_dir.path().to_path_buf();

        // 200 normal projects: cwd on the first line.
        let mut dirs = Vec::new();
        for i in 0..200 {
            let d = root.join(format!("p{}", i));
            fs::create_dir_all(&d).unwrap();
            create_test_session_file(
                &d,
                "s.jsonl",
                &format!("{{\"type\":\"user\",\"cwd\":\"/Users/test/proj{}\"}}\n", i),
            )
            .unwrap();
            dirs.push(d);
        }
        let start = Instant::now();
        for d in &dirs {
            let _ = get_project_path_from_sessions(d);
        }
        println!("BASELINE 200 normal projects: {:?}", start.elapsed());

        let start = Instant::now();
        for (i, d) in dirs.iter().enumerate() {
            let _ = resolve_project_path(d, &format!("p{}", i));
        }
        println!(
            "NEW resolve_project_path cold, 200 projects: {:?}",
            start.elapsed()
        );
        let start = Instant::now();
        for (i, d) in dirs.iter().enumerate() {
            let _ = resolve_project_path(d, &format!("p{}", i));
        }
        println!(
            "NEW resolve_project_path cached, 200 projects: {:?}",
            start.elapsed()
        );

        // One project with a ~100 MB session file (cwd on line 1).
        let big = root.join("big");
        fs::create_dir_all(&big).unwrap();
        let mut f = fs::File::create(big.join("s.jsonl")).unwrap();
        f.write_all(b"{\"type\":\"user\",\"cwd\":\"/Users/test/big\"}\n")
            .unwrap();
        let line = format!(
            "{{\"type\":\"assistant\",\"pad\":\"{}\"}}\n",
            "x".repeat(1000)
        );
        for _ in 0..100_000 {
            f.write_all(line.as_bytes()).unwrap();
        }
        drop(f);
        let start = Instant::now();
        let _ = get_project_path_from_sessions(&big);
        println!("BASELINE 1 project, ~100MB session: {:?}", start.elapsed());
    }
}
