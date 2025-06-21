use crate::sandbox::profile::ProfileBuilder;
use anyhow::Result;
use chrono;
use log::{debug, error, info, warn};
use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

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
                    let path_buf = std::path::PathBuf::from(&stored_path);
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
        let path_buf = std::path::PathBuf::from(&path);
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

/// Represents a CC Agent stored in the database
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Agent {
    pub id: Option<i64>,
    pub name: String,
    pub icon: String,
    pub system_prompt: String,
    pub default_task: Option<String>,
    pub model: String,
    pub sandbox_enabled: bool,
    pub enable_file_read: bool,
    pub enable_file_write: bool,
    pub enable_network: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Represents an agent execution run
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentRun {
    pub id: Option<i64>,
    pub agent_id: i64,
    pub agent_name: String,
    pub agent_icon: String,
    pub task: String,
    pub model: String,
    pub project_path: String,
    pub session_id: String, // UUID session ID from Claude Code
    pub status: String, // 'pending', 'running', 'completed', 'failed', 'cancelled'
    pub pid: Option<u32>,
    pub process_started_at: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

/// Represents runtime metrics calculated from JSONL
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentRunMetrics {
    pub duration_ms: Option<i64>,
    pub total_tokens: Option<i64>,
    pub cost_usd: Option<f64>,
    pub message_count: Option<i64>,
}

/// Combined agent run with real-time metrics
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentRunWithMetrics {
    #[serde(flatten)]
    pub run: AgentRun,
    pub metrics: Option<AgentRunMetrics>,
    pub output: Option<String>, // Real-time JSONL content
}

/// Database connection state
pub struct AgentDb(pub Mutex<Connection>);

/// Real-time JSONL reading and processing functions
impl AgentRunMetrics {
    /// Calculate metrics from JSONL content
    pub fn from_jsonl(jsonl_content: &str) -> Self {
        let mut total_tokens = 0i64;
        let mut cost_usd = 0.0f64;
        let mut message_count = 0i64;
        let mut start_time: Option<chrono::DateTime<chrono::Utc>> = None;
        let mut end_time: Option<chrono::DateTime<chrono::Utc>> = None;

        for line in jsonl_content.lines() {
            if let Ok(json) = serde_json::from_str::<JsonValue>(line) {
                message_count += 1;

                // Track timestamps
                if let Some(timestamp_str) = json.get("timestamp").and_then(|t| t.as_str()) {
                    if let Ok(timestamp) = chrono::DateTime::parse_from_rfc3339(timestamp_str) {
                        let utc_time = timestamp.with_timezone(&chrono::Utc);
                        if start_time.is_none() || utc_time < start_time.unwrap() {
                            start_time = Some(utc_time);
                        }
                        if end_time.is_none() || utc_time > end_time.unwrap() {
                            end_time = Some(utc_time);
                        }
                    }
                }

                // Extract token usage - check both top-level and nested message.usage
                let usage = json.get("usage")
                    .or_else(|| json.get("message").and_then(|m| m.get("usage")));
                
                if let Some(usage) = usage {
                    if let Some(input_tokens) = usage.get("input_tokens").and_then(|t| t.as_i64()) {
                        total_tokens += input_tokens;
                    }
                    if let Some(output_tokens) = usage.get("output_tokens").and_then(|t| t.as_i64()) {
                        total_tokens += output_tokens;
                    }
                }

                // Extract cost information
                if let Some(cost) = json.get("cost").and_then(|c| c.as_f64()) {
                    cost_usd += cost;
                }
            }
        }

        let duration_ms = match (start_time, end_time) {
            (Some(start), Some(end)) => Some((end - start).num_milliseconds()),
            _ => None,
        };

        Self {
            duration_ms,
            total_tokens: if total_tokens > 0 { Some(total_tokens) } else { None },
            cost_usd: if cost_usd > 0.0 { Some(cost_usd) } else { None },
            message_count: if message_count > 0 { Some(message_count) } else { None },
        }
    }
}

/// Read JSONL content from a session file
pub async fn read_session_jsonl(session_id: &str, project_path: &str) -> Result<String, String> {
    let claude_dir = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude")
        .join("projects");

    // Encode project path to match Claude Code's directory naming
    let encoded_project = project_path.replace('/', "-");
    let project_dir = claude_dir.join(&encoded_project);
    let session_file = project_dir.join(format!("{}.jsonl", session_id));

    if !session_file.exists() {
        return Err(format!("Session file not found: {}", session_file.display()));
    }

    match tokio::fs::read_to_string(&session_file).await {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read session file: {}", e)),
    }
}

/// Get agent run with real-time metrics
pub async fn get_agent_run_with_metrics(run: AgentRun) -> AgentRunWithMetrics {
    match read_session_jsonl(&run.session_id, &run.project_path).await {
        Ok(jsonl_content) => {
            let metrics = AgentRunMetrics::from_jsonl(&jsonl_content);
            AgentRunWithMetrics {
                run,
                metrics: Some(metrics),
                output: Some(jsonl_content),
            }
        }
        Err(e) => {
            log::warn!("Failed to read JSONL for session {}: {}", run.session_id, e);
            AgentRunWithMetrics {
                run,
                metrics: None,
                output: None,
            }
        }
    }
}

/// Initialize the agents database
pub fn init_database(app: &AppHandle) -> SqliteResult<Connection> {
    let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
    
    let db_path = app_dir.join("agents.db");
    let conn = Connection::open(db_path)?;
    
    // Create agents table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT NOT NULL,
            system_prompt TEXT NOT NULL,
            default_task TEXT,
            model TEXT NOT NULL DEFAULT 'sonnet',
            sandbox_enabled BOOLEAN NOT NULL DEFAULT 1,
            enable_file_read BOOLEAN NOT NULL DEFAULT 1,
            enable_file_write BOOLEAN NOT NULL DEFAULT 1,
            enable_network BOOLEAN NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    
    // Add columns to existing table if they don't exist
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN default_task TEXT", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN model TEXT DEFAULT 'sonnet'", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN sandbox_profile_id INTEGER REFERENCES sandbox_profiles(id)", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN sandbox_enabled BOOLEAN DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN enable_file_read BOOLEAN DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN enable_file_write BOOLEAN DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN enable_network BOOLEAN DEFAULT 0", []);
    
    // Create agent_runs table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agent_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id INTEGER NOT NULL,
            agent_name TEXT NOT NULL,
            agent_icon TEXT NOT NULL,
            task TEXT NOT NULL,
            model TEXT NOT NULL,
            project_path TEXT NOT NULL,
            session_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            pid INTEGER,
            process_started_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT,
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Migrate existing agent_runs table if needed
    let _ = conn.execute("ALTER TABLE agent_runs ADD COLUMN session_id TEXT", []);
    let _ = conn.execute("ALTER TABLE agent_runs ADD COLUMN status TEXT DEFAULT 'pending'", []);
    let _ = conn.execute("ALTER TABLE agent_runs ADD COLUMN pid INTEGER", []);
    let _ = conn.execute("ALTER TABLE agent_runs ADD COLUMN process_started_at TEXT", []);
    
    // Drop old columns that are no longer needed (data is now read from JSONL files)
    // Note: SQLite doesn't support DROP COLUMN, so we'll ignore errors for existing columns
    let _ = conn.execute("UPDATE agent_runs SET session_id = '' WHERE session_id IS NULL", []);
    let _ = conn.execute("UPDATE agent_runs SET status = 'completed' WHERE status IS NULL AND completed_at IS NOT NULL", []);
    let _ = conn.execute("UPDATE agent_runs SET status = 'failed' WHERE status IS NULL AND completed_at IS NOT NULL AND session_id = ''", []);
    let _ = conn.execute("UPDATE agent_runs SET status = 'pending' WHERE status IS NULL", []);
    
    // Create trigger to update the updated_at timestamp
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS update_agent_timestamp 
         AFTER UPDATE ON agents 
         FOR EACH ROW
         BEGIN
             UPDATE agents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END",
        [],
    )?;
    
    // Create sandbox profiles table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sandbox_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 0,
            is_default BOOLEAN NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    
    // Create sandbox rules table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sandbox_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER NOT NULL,
            operation_type TEXT NOT NULL,
            pattern_type TEXT NOT NULL,
            pattern_value TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT 1,
            platform_support TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (profile_id) REFERENCES sandbox_profiles(id) ON DELETE CASCADE
        )",
        [],
    )?;
    
    // Create trigger to update sandbox profile timestamp
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS update_sandbox_profile_timestamp 
         AFTER UPDATE ON sandbox_profiles 
         FOR EACH ROW
         BEGIN
             UPDATE sandbox_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END",
        [],
    )?;
    
    // Create sandbox violations table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sandbox_violations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER,
            agent_id INTEGER,
            agent_run_id INTEGER,
            operation_type TEXT NOT NULL,
            pattern_value TEXT,
            process_name TEXT,
            pid INTEGER,
            denied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (profile_id) REFERENCES sandbox_profiles(id) ON DELETE CASCADE,
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
            FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
        )",
        [],
    )?;
    
    // Create index for efficient querying
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sandbox_violations_denied_at 
         ON sandbox_violations(denied_at DESC)",
        [],
    )?;
    
    // Create default sandbox profiles if they don't exist
    crate::sandbox::defaults::create_default_profiles(&conn)?;
    
    // Create settings table for app-wide settings
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    
    // Create trigger to update the updated_at timestamp
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS update_app_settings_timestamp 
         AFTER UPDATE ON app_settings 
         FOR EACH ROW
         BEGIN
             UPDATE app_settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
         END",
        [],
    )?;
    
    Ok(conn)
}

/// List all agents
#[tauri::command]
pub async fn list_agents(db: State<'_, AgentDb>) -> Result<Vec<Agent>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, name, icon, system_prompt, default_task, model, sandbox_enabled, enable_file_read, enable_file_write, enable_network, created_at, updated_at FROM agents ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    
    let agents = stmt
        .query_map([], |row| {
            Ok(Agent {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                icon: row.get(2)?,
                system_prompt: row.get(3)?,
                default_task: row.get(4)?,
                model: row.get::<_, String>(5).unwrap_or_else(|_| "sonnet".to_string()),
                sandbox_enabled: row.get::<_, bool>(6).unwrap_or(true),
                enable_file_read: row.get::<_, bool>(7).unwrap_or(true),
                enable_file_write: row.get::<_, bool>(8).unwrap_or(true),
                enable_network: row.get::<_, bool>(9).unwrap_or(false),
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(agents)
}

/// Create a new agent
#[tauri::command]
pub async fn create_agent(
    db: State<'_, AgentDb>,
    name: String,
    icon: String,
    system_prompt: String,
    default_task: Option<String>,
    model: Option<String>,
    sandbox_enabled: Option<bool>,
    enable_file_read: Option<bool>,
    enable_file_write: Option<bool>,
    enable_network: Option<bool>,
) -> Result<Agent, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let model = model.unwrap_or_else(|| "sonnet".to_string());
    let sandbox_enabled = sandbox_enabled.unwrap_or(true);
    let enable_file_read = enable_file_read.unwrap_or(true);
    let enable_file_write = enable_file_write.unwrap_or(true);
    let enable_network = enable_network.unwrap_or(false);
    
    conn.execute(
        "INSERT INTO agents (name, icon, system_prompt, default_task, model, sandbox_enabled, enable_file_read, enable_file_write, enable_network) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![name, icon, system_prompt, default_task, model, sandbox_enabled, enable_file_read, enable_file_write, enable_network],
    )
    .map_err(|e| e.to_string())?;
    
    let id = conn.last_insert_rowid();
    
    // Fetch the created agent
    let agent = conn
        .query_row(
            "SELECT id, name, icon, system_prompt, default_task, model, sandbox_enabled, enable_file_read, enable_file_write, enable_network, created_at, updated_at FROM agents WHERE id = ?1",
            params![id],
            |row| {
                Ok(Agent {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    system_prompt: row.get(3)?,
                    default_task: row.get(4)?,
                    model: row.get(5)?,
                    sandbox_enabled: row.get(6)?,
                    enable_file_read: row.get(7)?,
                    enable_file_write: row.get(8)?,
                    enable_network: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    
    Ok(agent)
}

/// Update an existing agent
#[tauri::command]
pub async fn update_agent(
    db: State<'_, AgentDb>,
    id: i64,
    name: String,
    icon: String,
    system_prompt: String,
    default_task: Option<String>,
    model: Option<String>,
    sandbox_enabled: Option<bool>,
    enable_file_read: Option<bool>,
    enable_file_write: Option<bool>,
    enable_network: Option<bool>,
) -> Result<Agent, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let model = model.unwrap_or_else(|| "sonnet".to_string());
    
    // Build dynamic query based on provided parameters
    let mut query = "UPDATE agents SET name = ?1, icon = ?2, system_prompt = ?3, default_task = ?4, model = ?5".to_string();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![
        Box::new(name),
        Box::new(icon),
        Box::new(system_prompt),
        Box::new(default_task),
        Box::new(model),
    ];
    let mut param_count = 5;
    
    if let Some(se) = sandbox_enabled {
        param_count += 1;
        query.push_str(&format!(", sandbox_enabled = ?{}", param_count));
        params_vec.push(Box::new(se));
    }
    if let Some(efr) = enable_file_read {
        param_count += 1;
        query.push_str(&format!(", enable_file_read = ?{}", param_count));
        params_vec.push(Box::new(efr));
    }
    if let Some(efw) = enable_file_write {
        param_count += 1;
        query.push_str(&format!(", enable_file_write = ?{}", param_count));
        params_vec.push(Box::new(efw));
    }
    if let Some(en) = enable_network {
        param_count += 1;
        query.push_str(&format!(", enable_network = ?{}", param_count));
        params_vec.push(Box::new(en));
    }
    
    param_count += 1;
    query.push_str(&format!(" WHERE id = ?{}", param_count));
    params_vec.push(Box::new(id));
    
    conn.execute(&query, rusqlite::params_from_iter(params_vec.iter().map(|p| p.as_ref())))
        .map_err(|e| e.to_string())?;
    
    // Fetch the updated agent
    let agent = conn
        .query_row(
            "SELECT id, name, icon, system_prompt, default_task, model, sandbox_enabled, enable_file_read, enable_file_write, enable_network, created_at, updated_at FROM agents WHERE id = ?1",
            params![id],
            |row| {
                Ok(Agent {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    system_prompt: row.get(3)?,
                    default_task: row.get(4)?,
                    model: row.get(5)?,
                    sandbox_enabled: row.get(6)?,
                    enable_file_read: row.get(7)?,
                    enable_file_write: row.get(8)?,
                    enable_network: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    
    Ok(agent)
}

/// Delete an agent
#[tauri::command]
pub async fn delete_agent(db: State<'_, AgentDb>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM agents WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Get a single agent by ID
#[tauri::command]
pub async fn get_agent(db: State<'_, AgentDb>, id: i64) -> Result<Agent, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let agent = conn
        .query_row(
            "SELECT id, name, icon, system_prompt, default_task, model, sandbox_enabled, enable_file_read, enable_file_write, enable_network, created_at, updated_at FROM agents WHERE id = ?1",
            params![id],
            |row| {
                Ok(Agent {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    system_prompt: row.get(3)?,
                    default_task: row.get(4)?,
                    model: row.get::<_, String>(5).unwrap_or_else(|_| "sonnet".to_string()),
                    sandbox_enabled: row.get::<_, bool>(6).unwrap_or(true),
                    enable_file_read: row.get::<_, bool>(7).unwrap_or(true),
                    enable_file_write: row.get::<_, bool>(8).unwrap_or(true),
                    enable_network: row.get::<_, bool>(9).unwrap_or(false),
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    
    Ok(agent)
}

/// List agent runs (optionally filtered by agent_id)
#[tauri::command]
pub async fn list_agent_runs(
    db: State<'_, AgentDb>,
    agent_id: Option<i64>,
) -> Result<Vec<AgentRun>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let query = if agent_id.is_some() {
        "SELECT id, agent_id, agent_name, agent_icon, task, model, project_path, session_id, status, pid, process_started_at, created_at, completed_at 
         FROM agent_runs WHERE agent_id = ?1 ORDER BY created_at DESC"
    } else {
        "SELECT id, agent_id, agent_name, agent_icon, task, model, project_path, session_id, status, pid, process_started_at, created_at, completed_at 
         FROM agent_runs ORDER BY created_at DESC"
    };
    
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    
    let run_mapper = |row: &rusqlite::Row| -> rusqlite::Result<AgentRun> {
        Ok(AgentRun {
            id: Some(row.get(0)?),
            agent_id: row.get(1)?,
            agent_name: row.get(2)?,
            agent_icon: row.get(3)?,
            task: row.get(4)?,
            model: row.get(5)?,
            project_path: row.get(6)?,
            session_id: row.get(7)?,
            status: row.get::<_, String>(8).unwrap_or_else(|_| "pending".to_string()),
            pid: row.get::<_, Option<i64>>(9).ok().flatten().map(|p| p as u32),
            process_started_at: row.get(10)?,
            created_at: row.get(11)?,
            completed_at: row.get(12)?,
        })
    };
    
    let runs = if let Some(aid) = agent_id {
        stmt.query_map(params![aid], run_mapper)
    } else {
        stmt.query_map(params![], run_mapper)
    }
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
    
    Ok(runs)
}

/// Get a single agent run by ID
#[tauri::command]
pub async fn get_agent_run(db: State<'_, AgentDb>, id: i64) -> Result<AgentRun, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let run = conn
        .query_row(
            "SELECT id, agent_id, agent_name, agent_icon, task, model, project_path, session_id, status, pid, process_started_at, created_at, completed_at 
             FROM agent_runs WHERE id = ?1",
            params![id],
            |row| {
                Ok(AgentRun {
                    id: Some(row.get(0)?),
                    agent_id: row.get(1)?,
                    agent_name: row.get(2)?,
                    agent_icon: row.get(3)?,
                    task: row.get(4)?,
                    model: row.get(5)?,
                    project_path: row.get(6)?,
                    session_id: row.get(7)?,
                    status: row.get::<_, String>(8).unwrap_or_else(|_| "pending".to_string()),
                    pid: row.get::<_, Option<i64>>(9).ok().flatten().map(|p| p as u32),
                    process_started_at: row.get(10)?,
                    created_at: row.get(11)?,
                    completed_at: row.get(12)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    
    Ok(run)
}

/// Get agent run with real-time metrics from JSONL
#[tauri::command]
pub async fn get_agent_run_with_real_time_metrics(db: State<'_, AgentDb>, id: i64) -> Result<AgentRunWithMetrics, String> {
    let run = get_agent_run(db, id).await?;
    Ok(get_agent_run_with_metrics(run).await)
}

/// List agent runs with real-time metrics from JSONL
#[tauri::command]
pub async fn list_agent_runs_with_metrics(
    db: State<'_, AgentDb>,
    agent_id: Option<i64>,
) -> Result<Vec<AgentRunWithMetrics>, String> {
    let runs = list_agent_runs(db, agent_id).await?;
    let mut runs_with_metrics = Vec::new();
    
    for run in runs {
        let run_with_metrics = get_agent_run_with_metrics(run).await;
        runs_with_metrics.push(run_with_metrics);
    }
    
    Ok(runs_with_metrics)
}

/// Migration function for existing agent_runs data
#[tauri::command]
pub async fn migrate_agent_runs_to_session_ids(db: State<'_, AgentDb>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Get all agent_runs that have empty session_id but have output data
    let mut stmt = conn.prepare(
        "SELECT id, output FROM agent_runs WHERE session_id = '' AND output != ''"
    ).map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;
    
    let mut migrated_count = 0;
    let mut failed_count = 0;
    
    for row_result in rows {
        let (run_id, output) = row_result.map_err(|e| e.to_string())?;
        
        // Extract session ID from JSONL output
        let mut session_id = String::new();
        for line in output.lines() {
            if let Ok(json) = serde_json::from_str::<JsonValue>(line) {
                if let Some(sid) = json.get("sessionId").and_then(|s| s.as_str()) {
                    session_id = sid.to_string();
                    break;
                }
            }
        }
        
        if !session_id.is_empty() {
            // Update the run with the extracted session ID
            match conn.execute(
                "UPDATE agent_runs SET session_id = ?1 WHERE id = ?2",
                params![session_id, run_id],
            ) {
                Ok(_) => {
                    migrated_count += 1;
                    info!("Migrated agent_run {} with session_id {}", run_id, session_id);
                }
                Err(e) => {
                    error!("Failed to update agent_run {}: {}", run_id, e);
                    failed_count += 1;
                }
            }
        } else {
            warn!("Could not extract session ID from agent_run {}", run_id);
            failed_count += 1;
        }
    }
    
    let message = format!(
        "Migration completed: {} runs migrated, {} failed", 
        migrated_count, failed_count
    );
    info!("{}", message);
    Ok(message)
}

/// Execute a CC agent with streaming output
#[tauri::command]
pub async fn execute_agent(
    app: AppHandle,
    agent_id: i64,
    project_path: String,
    task: String,
    model: Option<String>,
    db: State<'_, AgentDb>,
    registry: State<'_, crate::process::ProcessRegistryState>,
) -> Result<i64, String> {
    info!("Executing agent {} with task: {}", agent_id, task);
    
    // Get the agent from database
    let agent = get_agent(db.clone(), agent_id).await?;
    let execution_model = model.unwrap_or(agent.model.clone());
    
    // Create a new run record
    let run_id = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO agent_runs (agent_id, agent_name, agent_icon, task, model, project_path, session_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![agent_id, agent.name, agent.icon, task, execution_model, project_path, ""],
        )
        .map_err(|e| e.to_string())?;
        conn.last_insert_rowid()
    };
    
    // Create sandbox rules based on agent-specific permissions (no database dependency)
    let sandbox_profile = if !agent.sandbox_enabled {
        info!("🔓 Agent '{}': Sandbox DISABLED", agent.name);
        None
    } else {
        info!("🔒 Agent '{}': Sandbox enabled | File Read: {} | File Write: {} | Network: {}", 
              agent.name, agent.enable_file_read, agent.enable_file_write, agent.enable_network);
        
        // Create rules dynamically based on agent permissions
        let mut rules = Vec::new();
        
        // Add file read rules if enabled
        if agent.enable_file_read {
            // Project directory access
            rules.push(crate::sandbox::profile::SandboxRule {
                id: Some(1),
                profile_id: 0,
                operation_type: "file_read_all".to_string(),
                pattern_type: "subpath".to_string(),
                pattern_value: "{{PROJECT_PATH}}".to_string(),
                enabled: true,
                platform_support: Some(r#"["linux", "macos", "windows"]"#.to_string()),
                created_at: String::new(),
            });
            
            // System libraries (for language runtimes, etc.)
            rules.push(crate::sandbox::profile::SandboxRule {
                id: Some(2),
                profile_id: 0,
                operation_type: "file_read_all".to_string(),
                pattern_type: "subpath".to_string(),
                pattern_value: "/usr/lib".to_string(),
                enabled: true,
                platform_support: Some(r#"["linux", "macos"]"#.to_string()),
                created_at: String::new(),
            });
            
            rules.push(crate::sandbox::profile::SandboxRule {
                id: Some(3),
                profile_id: 0,
                operation_type: "file_read_all".to_string(),
                pattern_type: "subpath".to_string(),
                pattern_value: "/usr/local/lib".to_string(),
                enabled: true,
                platform_support: Some(r#"["linux", "macos"]"#.to_string()),
                created_at: String::new(),
            });
            
            rules.push(crate::sandbox::profile::SandboxRule {
                id: Some(4),
                profile_id: 0,
                operation_type: "file_read_all".to_string(),
                pattern_type: "subpath".to_string(),
                pattern_value: "/System/Library".to_string(),
                enabled: true,
                platform_support: Some(r#"["macos"]"#.to_string()),
                created_at: String::new(),
            });
            
            rules.push(crate::sandbox::profile::SandboxRule {
                id: Some(5),
                profile_id: 0,
                operation_type: "file_read_metadata".to_string(),
                pattern_type: "subpath".to_string(),
                pattern_value: "/".to_string(),
                enabled: true,
                platform_support: Some(r#"["macos"]"#.to_string()),
                created_at: String::new(),
            });
        }
        
        // Add network rules if enabled
        if agent.enable_network {
            rules.push(crate::sandbox::profile::SandboxRule {
                id: Some(6),
                profile_id: 0,
                operation_type: "network_outbound".to_string(),
                pattern_type: "all".to_string(),
                pattern_value: "".to_string(),
                enabled: true,
                platform_support: Some(r#"["linux", "macos"]"#.to_string()),
                created_at: String::new(),
            });
        }
        
        // Always add essential system paths (needed for executables to run)
        rules.push(crate::sandbox::profile::SandboxRule {
            id: Some(7),
            profile_id: 0,
            operation_type: "file_read_all".to_string(),
            pattern_type: "subpath".to_string(),
            pattern_value: "/usr/bin".to_string(),
            enabled: true,
            platform_support: Some(r#"["linux", "macos"]"#.to_string()),
            created_at: String::new(),
        });
        
        rules.push(crate::sandbox::profile::SandboxRule {
            id: Some(8),
            profile_id: 0,
            operation_type: "file_read_all".to_string(),
            pattern_type: "subpath".to_string(),
            pattern_value: "/opt/homebrew/bin".to_string(),
            enabled: true,
            platform_support: Some(r#"["macos"]"#.to_string()),
            created_at: String::new(),
        });
        
        rules.push(crate::sandbox::profile::SandboxRule {
            id: Some(9),
            profile_id: 0,
            operation_type: "file_read_all".to_string(),
            pattern_type: "subpath".to_string(),
            pattern_value: "/usr/local/bin".to_string(),
            enabled: true,
            platform_support: Some(r#"["linux", "macos"]"#.to_string()),
            created_at: String::new(),
        });
        
        rules.push(crate::sandbox::profile::SandboxRule {
            id: Some(10),
            profile_id: 0,
            operation_type: "file_read_all".to_string(),
            pattern_type: "subpath".to_string(),
            pattern_value: "/bin".to_string(),
            enabled: true,
            platform_support: Some(r#"["linux", "macos"]"#.to_string()),
            created_at: String::new(),
        });
        
        // System libraries (needed for executables to link)
        rules.push(crate::sandbox::profile::SandboxRule {
            id: Some(11),
            profile_id: 0,
            operation_type: "file_read_all".to_string(),
            pattern_type: "subpath".to_string(),
            pattern_value: "/usr/lib".to_string(),
            enabled: true,
            platform_support: Some(r#"["linux", "macos"]"#.to_string()),
            created_at: String::new(),
        });
        
        rules.push(crate::sandbox::profile::SandboxRule {
            id: Some(12),
            profile_id: 0,
            operation_type: "file_read_all".to_string(),
            pattern_type: "subpath".to_string(),
            pattern_value: "/System/Library".to_string(),
            enabled: true,
            platform_support: Some(r#"["macos"]"#.to_string()),
            created_at: String::new(),
        });
        
        // Always add system info reading (minimal requirement)
        rules.push(crate::sandbox::profile::SandboxRule {
            id: Some(13),
            profile_id: 0,
            operation_type: "system_info_read".to_string(),
            pattern_type: "all".to_string(),
            pattern_value: "".to_string(),
            enabled: true,
            platform_support: Some(r#"["linux", "macos"]"#.to_string()),
            created_at: String::new(),
        });
        
        Some(("Agent-specific".to_string(), rules))
    };
    
    // Build the command
    let mut cmd = if let Some((_profile_name, rules)) = sandbox_profile {
        info!("🧪 DEBUG: Testing Claude command first without sandbox...");
        // Quick test to see if Claude is accessible at all
        let claude_path = match find_claude_binary(&app) {
            Ok(path) => path,
            Err(e) => {
                error!("❌ Claude binary not found: {}", e);
                return Err(e);
            }
        };
        match std::process::Command::new(&claude_path).arg("--version").output() {
            Ok(output) => {
                if output.status.success() {
                    info!("✅ Claude command works: {}", String::from_utf8_lossy(&output.stdout).trim());
                } else {
                    warn!("⚠️ Claude command failed with status: {}", output.status);
                    warn!("   stdout: {}", String::from_utf8_lossy(&output.stdout));
                    warn!("   stderr: {}", String::from_utf8_lossy(&output.stderr));
                }
            }
            Err(e) => {
                error!("❌ Claude command not found or not executable: {}", e);
                error!("   This could be why the agent is failing to start");
            }
        }
        
        // Test if Claude can actually start a session (this might reveal auth issues)
        info!("🧪 Testing Claude with exact same arguments as agent (without sandbox env vars)...");
        let mut test_cmd = std::process::Command::new(&claude_path);
        test_cmd.arg("-p")
            .arg(&task)
            .arg("--system-prompt")
            .arg(&agent.system_prompt)
            .arg("--model")
            .arg(&execution_model)
            .arg("--output-format")
            .arg("stream-json")
            .arg("--verbose")
            .arg("--dangerously-skip-permissions")
            .current_dir(&project_path);
        
        info!("🧪 Testing command: claude -p \"{}\" --system-prompt \"{}\" --model {} --output-format stream-json --verbose --dangerously-skip-permissions", 
              task, agent.system_prompt, execution_model);
        
        // Start the test process and give it 5 seconds to produce output
        match test_cmd.spawn() {
            Ok(mut child) => {
                // Wait for 5 seconds to see if it produces output
                let start = std::time::Instant::now();
                let mut output_received = false;
                
                while start.elapsed() < std::time::Duration::from_secs(5) {
                    match child.try_wait() {
                        Ok(Some(status)) => {
                            info!("🧪 Test process exited with status: {}", status);
                            output_received = true;
                            break;
                        }
                        Ok(None) => {
                            // Still running
                            std::thread::sleep(std::time::Duration::from_millis(100));
                        }
                        Err(e) => {
                            warn!("🧪 Error checking test process: {}", e);
                            break;
                        }
                    }
                }
                
                if !output_received {
                    warn!("🧪 Test process is still running after 5 seconds - this suggests Claude might be waiting for input");
                    // Kill the test process
                    let _ = child.kill();
                    let _ = child.wait();
                } else {
                    info!("🧪 Test process completed quickly - command seems to work");
                }
            }
            Err(e) => {
                error!("❌ Failed to spawn test Claude process: {}", e);
            }
        }
        
        info!("🧪 End of Claude test, proceeding with sandbox...");
        
        // Build the gaol profile using agent-specific permissions
        let project_path_buf = PathBuf::from(&project_path);
        
        match ProfileBuilder::new(project_path_buf.clone()) {
            Ok(builder) => {
                // Build agent-specific profile with permission filtering
                match builder.build_agent_profile(
                    rules, 
                    agent.sandbox_enabled, 
                    agent.enable_file_read, 
                    agent.enable_file_write, 
                    agent.enable_network
                ) {
                    Ok(build_result) => {
                        
                        // Create the enhanced sandbox executor
                        let executor = crate::sandbox::executor::SandboxExecutor::new_with_serialization(
                            build_result.profile,
                            project_path_buf.clone(),
                            build_result.serialized
                        );
                        
                        // Prepare the sandboxed command
                        let args = vec![
                            "-p", &task,
                            "--system-prompt", &agent.system_prompt,
                            "--model", &execution_model,
                            "--output-format", "stream-json",
                            "--verbose",
                            "--dangerously-skip-permissions"
                        ];
                        
                        let claude_path = match find_claude_binary(&app) {
                            Ok(path) => path,
                            Err(e) => {
                                error!("Failed to find claude binary: {}", e);
                                return Err(e);
                            }
                        };
                        executor.prepare_sandboxed_command(&claude_path, &args, &project_path_buf)
                    }
                    Err(e) => {
                        error!("Failed to build agent-specific sandbox profile: {}, falling back to non-sandboxed", e);
                        let claude_path = match find_claude_binary(&app) {
                            Ok(path) => path,
                            Err(e) => {
                                error!("Failed to find claude binary: {}", e);
                                return Err(e);
                            }
                        };
                        let mut cmd = create_command_with_env(&claude_path);
                        cmd.arg("-p")
                            .arg(&task)
                            .arg("--system-prompt")
                            .arg(&agent.system_prompt)
                            .arg("--model")
                            .arg(&execution_model)
                            .arg("--output-format")
                            .arg("stream-json")
                            .arg("--verbose")
                            .arg("--dangerously-skip-permissions")
                            .current_dir(&project_path)
                            .stdout(Stdio::piped())
                            .stderr(Stdio::piped());
                        cmd
                    }
                }
            }
            Err(e) => {
                error!("Failed to create ProfileBuilder: {}, falling back to non-sandboxed", e);
                
                // Fall back to non-sandboxed command
                let claude_path = match find_claude_binary(&app) {
                    Ok(path) => path,
                    Err(e) => {
                        error!("Failed to find claude binary: {}", e);
                        return Err(e);
                    }
                };
                let mut cmd = create_command_with_env(&claude_path);
                cmd.arg("-p")
                    .arg(&task)
                    .arg("--system-prompt")
                    .arg(&agent.system_prompt)
                    .arg("--model")
                    .arg(&execution_model)
                    .arg("--output-format")
                    .arg("stream-json")
                    .arg("--verbose")
                    .arg("--dangerously-skip-permissions")
                    .current_dir(&project_path)
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped());
                cmd
            }
        }
    } else {
        // No sandbox or sandbox disabled, use regular command
        warn!("🚨 Running agent '{}' WITHOUT SANDBOX - full system access!", agent.name);
        let claude_path = match find_claude_binary(&app) {
            Ok(path) => path,
            Err(e) => {
                error!("Failed to find claude binary: {}", e);
                return Err(e);
            }
        };
        let mut cmd = create_command_with_env(&claude_path);
        cmd.arg("-p")
            .arg(&task)
            .arg("--system-prompt")
            .arg(&agent.system_prompt)
            .arg("--model")
            .arg(&execution_model)
            .arg("--output-format")
            .arg("stream-json")
            .arg("--verbose")
            .arg("--dangerously-skip-permissions")
            .current_dir(&project_path)
            .stdin(Stdio::null())  // Don't pipe stdin - we have no input to send
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        cmd
    };
    
    // Spawn the process
    info!("🚀 Spawning Claude process...");
    let mut child = cmd.spawn().map_err(|e| {
        error!("❌ Failed to spawn Claude process: {}", e);
        format!("Failed to spawn Claude: {}", e)
    })?;
    
    info!("🔌 Using Stdio::null() for stdin - no input expected");
    
    // Get the PID and register the process
    let pid = child.id().unwrap_or(0);
    let now = chrono::Utc::now().to_rfc3339();
    info!("✅ Claude process spawned successfully with PID: {}", pid);
    
    // Update the database with PID and status
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE agent_runs SET status = 'running', pid = ?1, process_started_at = ?2 WHERE id = ?3",
            params![pid as i64, now, run_id],
        ).map_err(|e| e.to_string())?;
        info!("📝 Updated database with running status and PID");
    }
    
    // Get stdout and stderr
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;
    info!("📡 Set up stdout/stderr readers");
    
    // Create readers
    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);
    
    // Shared state for collecting session ID and live output
    let session_id = std::sync::Arc::new(Mutex::new(String::new()));
    let live_output = std::sync::Arc::new(Mutex::new(String::new()));
    let start_time = std::time::Instant::now();
    
    // Spawn tasks to read stdout and stderr
    let app_handle = app.clone();
    let session_id_clone = session_id.clone();
    let live_output_clone = live_output.clone();
    let registry_clone = registry.0.clone();
    let first_output = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let first_output_clone = first_output.clone();
    
    let stdout_task = tokio::spawn(async move {
        info!("📖 Starting to read Claude stdout...");
        let mut lines = stdout_reader.lines();
        let mut line_count = 0;
        
        while let Ok(Some(line)) = lines.next_line().await {
            line_count += 1;
            
            // Log first output
            if !first_output_clone.load(std::sync::atomic::Ordering::Relaxed) {
                info!("🎉 First output received from Claude process! Line: {}", line);
                first_output_clone.store(true, std::sync::atomic::Ordering::Relaxed);
            }
            
            if line_count <= 5 {
                info!("stdout[{}]: {}", line_count, line);
            } else {
                debug!("stdout[{}]: {}", line_count, line);
            }
            
            // Store live output in both local buffer and registry
            if let Ok(mut output) = live_output_clone.lock() {
                output.push_str(&line);
                output.push('\n');
            }
            
            // Also store in process registry for cross-session access
            let _ = registry_clone.append_live_output(run_id, &line);
            
            // Extract session ID from JSONL output
            if let Ok(json) = serde_json::from_str::<JsonValue>(&line) {
                if let Some(sid) = json.get("sessionId").and_then(|s| s.as_str()) {
                    if let Ok(mut current_session_id) = session_id_clone.lock() {
                        if current_session_id.is_empty() {
                            *current_session_id = sid.to_string();
                            info!("🔑 Extracted session ID: {}", sid);
                        }
                    }
                }
            }
            
            // Emit the line to the frontend
            let _ = app_handle.emit("agent-output", &line);
        }
        
        info!("📖 Finished reading Claude stdout. Total lines: {}", line_count);
    });
    
    let app_handle_stderr = app.clone();
    let first_error = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let first_error_clone = first_error.clone();
    
    let stderr_task = tokio::spawn(async move {
        info!("📖 Starting to read Claude stderr...");
        let mut lines = stderr_reader.lines();
        let mut error_count = 0;
        
        while let Ok(Some(line)) = lines.next_line().await {
            error_count += 1;
            
            // Log first error
            if !first_error_clone.load(std::sync::atomic::Ordering::Relaxed) {
                warn!("⚠️ First error output from Claude process! Line: {}", line);
                first_error_clone.store(true, std::sync::atomic::Ordering::Relaxed);
            }
            
            error!("stderr[{}]: {}", error_count, line);
            // Emit error lines to the frontend
            let _ = app_handle_stderr.emit("agent-error", &line);
        }
        
        if error_count > 0 {
            warn!("📖 Finished reading Claude stderr. Total error lines: {}", error_count);
        } else {
            info!("📖 Finished reading Claude stderr. No errors.");
        }
    });
    
    // Register the process in the registry for live output tracking (after stdout/stderr setup)
    registry.0.register_process(
        run_id,
        agent_id,
        agent.name.clone(),
        pid,
        project_path.clone(),
        task.clone(),
        execution_model.clone(),
        child,
    ).map_err(|e| format!("Failed to register process: {}", e))?;
    info!("📋 Registered process in registry");
    
    // Create variables we need for the spawned task
    let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
    let db_path = app_dir.join("agents.db");
    
    // Monitor process status and wait for completion
    tokio::spawn(async move {
        info!("🕐 Starting process monitoring...");
        
        // Wait for first output with timeout
        for i in 0..300 { // 30 seconds (300 * 100ms)
            if first_output.load(std::sync::atomic::Ordering::Relaxed) {
                info!("✅ Output detected after {}ms, continuing normal execution", i * 100);
                break;
            }
            
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            
            // Log progress every 5 seconds
            if i > 0 && i % 50 == 0 {
                info!("⏳ Still waiting for Claude output... ({}s elapsed)", i / 10);
            }
        }
        
        // Check if we timed out
        if !first_output.load(std::sync::atomic::Ordering::Relaxed) {
            warn!("⏰ TIMEOUT: No output from Claude process after 30 seconds");
            warn!("💡 This usually means:");
            warn!("   1. Claude process is waiting for user input");
            warn!("   2. Sandbox permissions are too restrictive");
            warn!("   3. Claude failed to initialize but didn't report an error");
            warn!("   4. Network connectivity issues");
            warn!("   5. Authentication issues (API key not found/invalid)");
            
            // Process timed out - kill it via PID
            warn!("🔍 Process likely stuck waiting for input, attempting to kill PID: {}", pid);
            let kill_result = std::process::Command::new("kill")
                .arg("-TERM")
                .arg(pid.to_string())
                .output();
            
            match kill_result {
                Ok(output) if output.status.success() => {
                    warn!("🔍 Successfully sent TERM signal to process");
                }
                Ok(_) => {
                    warn!("🔍 Failed to kill process with TERM, trying KILL");
                    let _ = std::process::Command::new("kill")
                        .arg("-KILL")
                        .arg(pid.to_string())
                        .output();
                }
                Err(e) => {
                    warn!("🔍 Error killing process: {}", e);
                }
            }
            
            // Update database
            if let Ok(conn) = Connection::open(&db_path) {
                let _ = conn.execute(
                    "UPDATE agent_runs SET status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = ?1",
                    params![run_id],
                );
            }
            
            let _ = app.emit("agent-complete", false);
            return;
        }
        
        // Wait for reading tasks to complete
        info!("⏳ Waiting for stdout/stderr reading to complete...");
        let _ = stdout_task.await;
        let _ = stderr_task.await;
        
        let duration_ms = start_time.elapsed().as_millis() as i64;
        info!("⏱️ Process execution took {} ms", duration_ms);
        
        // Get the session ID that was extracted
        let extracted_session_id = if let Ok(sid) = session_id.lock() {
            sid.clone()
        } else {
            String::new()
        };
        
        // Wait for process completion and update status
        info!("✅ Claude process execution monitoring complete");
        
        // Update the run record with session ID and mark as completed - open a new connection
        if let Ok(conn) = Connection::open(&db_path) {
            let _ = conn.execute(
                "UPDATE agent_runs SET session_id = ?1, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?2",
                params![extracted_session_id, run_id],
            );
        }
        
        // Cleanup will be handled by the cleanup_finished_processes function
        
        let _ = app.emit("agent-complete", true);
    });
    
    Ok(run_id)
}

/// List all currently running agent sessions
#[tauri::command]
pub async fn list_running_sessions(
    db: State<'_, AgentDb>,
) -> Result<Vec<AgentRun>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, agent_id, agent_name, agent_icon, task, model, project_path, session_id, status, pid, process_started_at, created_at, completed_at 
         FROM agent_runs WHERE status = 'running' ORDER BY process_started_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let runs = stmt.query_map([], |row| {
        Ok(AgentRun {
            id: Some(row.get(0)?),
            agent_id: row.get(1)?,
            agent_name: row.get(2)?,
            agent_icon: row.get(3)?,
            task: row.get(4)?,
            model: row.get(5)?,
            project_path: row.get(6)?,
            session_id: row.get(7)?,
            status: row.get::<_, String>(8).unwrap_or_else(|_| "pending".to_string()),
            pid: row.get::<_, Option<i64>>(9).ok().flatten().map(|p| p as u32),
            process_started_at: row.get(10)?,
            created_at: row.get(11)?,
            completed_at: row.get(12)?,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
    
    Ok(runs)
}

/// Kill a running agent session
#[tauri::command]
pub async fn kill_agent_session(
    db: State<'_, AgentDb>,
    run_id: i64,
) -> Result<bool, String> {
    // First try to kill the process using system kill
    let pid_result = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT pid FROM agent_runs WHERE id = ?1 AND status = 'running'",
            params![run_id],
            |row| row.get::<_, Option<i64>>(0)
        )
        .map_err(|e| e.to_string())?
    };
    
    if let Some(pid) = pid_result {
        // Try to kill the process
        let kill_result = if cfg!(target_os = "windows") {
            std::process::Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output()
        } else {
            std::process::Command::new("kill")
                .args(["-TERM", &pid.to_string()])
                .output()
        };
        
        match kill_result {
            Ok(output) => {
                if output.status.success() {
                    info!("Successfully killed process {}", pid);
                } else {
                    warn!("Kill command failed for PID {}: {}", pid, String::from_utf8_lossy(&output.stderr));
                }
            }
            Err(e) => {
                warn!("Failed to execute kill command for PID {}: {}", pid, e);
            }
        }
    }
    
    // Update the database to mark as cancelled
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let updated = conn.execute(
        "UPDATE agent_runs SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = ?1 AND status = 'running'",
        params![run_id],
    ).map_err(|e| e.to_string())?;
    
    Ok(updated > 0)
}

/// Get the status of a specific agent session
#[tauri::command]
pub async fn get_session_status(
    db: State<'_, AgentDb>,
    run_id: i64,
) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    match conn.query_row(
        "SELECT status FROM agent_runs WHERE id = ?1",
        params![run_id],
        |row| row.get::<_, String>(0)
    ) {
        Ok(status) => Ok(Some(status)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Cleanup finished processes and update their status
#[tauri::command]
pub async fn cleanup_finished_processes(
    db: State<'_, AgentDb>,
) -> Result<Vec<i64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Get all running processes
    let mut stmt = conn.prepare(
        "SELECT id, pid FROM agent_runs WHERE status = 'running' AND pid IS NOT NULL"
    ).map_err(|e| e.to_string())?;
    
    let running_processes = stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
    
    drop(stmt);
    
    let mut cleaned_up = Vec::new();
    
    for (run_id, pid) in running_processes {
        // Check if the process is still running
        let is_running = if cfg!(target_os = "windows") {
            // On Windows, use tasklist to check if process exists
            match std::process::Command::new("tasklist")
                .args(["/FI", &format!("PID eq {}", pid)])
                .args(["/FO", "CSV"])
                .output()
            {
                Ok(output) => {
                    let output_str = String::from_utf8_lossy(&output.stdout);
                    output_str.lines().count() > 1 // Header + process line if exists
                }
                Err(_) => false,
            }
        } else {
            // On Unix-like systems, use kill -0 to check if process exists
            match std::process::Command::new("kill")
                .args(["-0", &pid.to_string()])
                .output()
            {
                Ok(output) => output.status.success(),
                Err(_) => false,
            }
        };
        
        if !is_running {
            // Process has finished, update status
            let updated = conn.execute(
                "UPDATE agent_runs SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?1",
                params![run_id],
            ).map_err(|e| e.to_string())?;
            
            if updated > 0 {
                cleaned_up.push(run_id);
                info!("Marked agent run {} as completed (PID {} no longer running)", run_id, pid);
            }
        }
    }
    
    Ok(cleaned_up)
}

/// Get live output from a running process
#[tauri::command]
pub async fn get_live_session_output(
    registry: State<'_, crate::process::ProcessRegistryState>,
    run_id: i64,
) -> Result<String, String> {
    registry.0.get_live_output(run_id)
}

/// Get real-time output for a running session by reading its JSONL file with live output fallback
#[tauri::command]
pub async fn get_session_output(
    db: State<'_, AgentDb>,
    registry: State<'_, crate::process::ProcessRegistryState>,
    run_id: i64,
) -> Result<String, String> {
    // Get the session information
    let run = get_agent_run(db, run_id).await?;
    
    // If no session ID yet, try to get live output from registry
    if run.session_id.is_empty() {
        let live_output = registry.0.get_live_output(run_id)?;
        if !live_output.is_empty() {
            return Ok(live_output);
        }
        return Ok(String::new());
    }
    
    // Read the JSONL content
    match read_session_jsonl(&run.session_id, &run.project_path).await {
        Ok(content) => Ok(content),
        Err(_) => {
            // Fallback to live output if JSONL file doesn't exist yet
            let live_output = registry.0.get_live_output(run_id)?;
            Ok(live_output)
        }
    }
}

/// Stream real-time session output by watching the JSONL file
#[tauri::command]
pub async fn stream_session_output(
    app: AppHandle,
    db: State<'_, AgentDb>,
    run_id: i64,
) -> Result<(), String> {
    // Get the session information
    let run = get_agent_run(db, run_id).await?;
    
    // If no session ID yet, can't stream
    if run.session_id.is_empty() {
        return Err("Session not started yet".to_string());
    }
    
    let session_id = run.session_id.clone();
    let project_path = run.project_path.clone();
    
    // Spawn a task to monitor the file
    tokio::spawn(async move {
        let claude_dir = match dirs::home_dir() {
            Some(home) => home.join(".claude").join("projects"),
            None => return,
        };
        
        let encoded_project = project_path.replace('/', "-");
        let project_dir = claude_dir.join(&encoded_project);
        let session_file = project_dir.join(format!("{}.jsonl", session_id));
        
        let mut last_size = 0u64;
        
        // Monitor file changes continuously while session is running
        loop {
            if session_file.exists() {
                if let Ok(metadata) = tokio::fs::metadata(&session_file).await {
                    let current_size = metadata.len();
                    
                    if current_size > last_size {
                        // File has grown, read new content
                        if let Ok(content) = tokio::fs::read_to_string(&session_file).await {
                            let _ = app.emit("session-output-update", &format!("{}:{}", run_id, content));
                        }
                        last_size = current_size;
                    }
                }
            } else {
                // If session file doesn't exist yet, keep waiting
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                continue;
            }
            
            // Check if the session is still running by querying the database
            // If the session is no longer running, stop streaming
            if let Ok(conn) = rusqlite::Connection::open(
                app.path().app_data_dir().expect("Failed to get app data dir").join("agents.db")
            ) {
                if let Ok(status) = conn.query_row(
                    "SELECT status FROM agent_runs WHERE id = ?1",
                    rusqlite::params![run_id],
                    |row| row.get::<_, String>(0)
                ) {
                    if status != "running" {
                        debug!("Session {} is no longer running, stopping stream", run_id);
                        break;
                    }
                } else {
                    // If we can't query the status, assume it's still running
                    debug!("Could not query session status for {}, continuing stream", run_id);
                }
            }
            
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }
        
        debug!("Stopped streaming for session {}", run_id);
    });
    
    Ok(())
}

/// Get the stored Claude binary path from settings
#[tauri::command]
pub async fn get_claude_binary_path(db: State<'_, AgentDb>) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    match conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'claude_binary_path'",
        [],
        |row| row.get::<_, String>(0),
    ) {
        Ok(path) => Ok(Some(path)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get Claude binary path: {}", e)),
    }
}

/// Set the Claude binary path in settings
#[tauri::command]
pub async fn set_claude_binary_path(db: State<'_, AgentDb>, path: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Validate that the path exists and is executable
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    
    // Check if it's executable (on Unix systems)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = std::fs::metadata(&path_buf)
            .map_err(|e| format!("Failed to read file metadata: {}", e))?;
        let permissions = metadata.permissions();
        if permissions.mode() & 0o111 == 0 {
            return Err(format!("File is not executable: {}", path));
        }
    }
    
    // Insert or update the setting
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES ('claude_binary_path', ?1)
         ON CONFLICT(key) DO UPDATE SET value = ?1",
        params![path],
    ).map_err(|e| format!("Failed to save Claude binary path: {}", e))?;
    
    Ok(())
}

/// Helper function to create a tokio Command with proper environment variables
/// This ensures commands like Claude can find Node.js and other dependencies
fn create_command_with_env(program: &str) -> Command {
    let mut cmd = Command::new(program);

    // Inherit essential environment variables from parent process
    for (key, value) in std::env::vars() {
        if key == "PATH" || key == "HOME" || key == "USER" 
            || key == "SHELL" || key == "LANG" || key == "LC_ALL" || key.starts_with("LC_")
            || key == "NODE_PATH" || key == "NVM_DIR" || key == "NVM_BIN" 
            || key == "HOMEBREW_PREFIX" || key == "HOMEBREW_CELLAR" {
            cmd.env(&key, &value);
        }
    }

    // Ensure PATH contains common Homebrew locations so that `/usr/bin/env node` resolves
    // when the application is launched from the macOS GUI (PATH is very minimal there).
    if let Ok(existing_path) = std::env::var("PATH") {
        let mut paths: Vec<&str> = existing_path.split(':').collect();
        for p in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].iter() {
            if !paths.contains(p) {
                paths.push(p);
            }
        }
        let joined = paths.join(":");
        cmd.env("PATH", joined);
    } else {
        // Fallback: set a reasonable default PATH
        cmd.env("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin");
    }

    cmd
}
 