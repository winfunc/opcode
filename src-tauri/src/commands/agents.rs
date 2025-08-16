use anyhow::Result;
use chrono;
use dirs;
use log::{debug, error, info, warn};
use reqwest;
use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::io::{BufRead, BufReader};
use std::process::Stdio;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use tokio::io::{AsyncBufReadExt, BufReader as TokioBufReader};
use tokio::process::Command;

/// Finds the full path to the claude binary
/// This is necessary because macOS apps have a limited PATH environment
fn find_claude_binary(app_handle: &AppHandle) -> Result<String, String> {
    crate::claude_binary::find_claude_binary(app_handle)
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
    pub enable_file_read: bool,
    pub enable_file_write: bool,
    pub enable_network: bool,
    pub hooks: Option<String>, // JSON string of hooks configuration
    pub source: Option<String>, // 'claudia', 'native', 'user', etc.
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
    pub status: String,     // 'pending', 'running', 'completed', 'failed', 'cancelled'
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

/// Agent export format
#[derive(Debug, Serialize, Deserialize)]
pub struct AgentExport {
    pub version: u32,
    pub exported_at: String,
    pub agent: AgentData,
}

/// Agent data within export
#[derive(Debug, Serialize, Deserialize)]
pub struct AgentData {
    pub name: String,
    pub icon: String,
    pub system_prompt: String,
    pub default_task: Option<String>,
    pub model: String,
    pub hooks: Option<String>,
}

/// Represents an environment variable group
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvironmentVariableGroup {
    pub id: Option<i64>,
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub sort_order: i32,
    pub is_system: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// Represents an environment variable stored in the database
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvironmentVariable {
    pub id: Option<i64>,
    pub key: String,
    pub value: String,
    pub enabled: bool,
    pub group_id: Option<i64>,
    pub sort_order: i32,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
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
                        if start_time.map_or(true, |st| utc_time < st) {
                            start_time = Some(utc_time);
                        }
                        if end_time.map_or(true, |et| utc_time > et) {
                            end_time = Some(utc_time);
                        }
                    }
                }

                // Extract token usage - check both top-level and nested message.usage
                let usage = json
                    .get("usage")
                    .or_else(|| json.get("message").and_then(|m| m.get("usage")));

                if let Some(usage) = usage {
                    if let Some(input_tokens) = usage.get("input_tokens").and_then(|t| t.as_i64()) {
                        total_tokens += input_tokens;
                    }
                    if let Some(output_tokens) = usage.get("output_tokens").and_then(|t| t.as_i64())
                    {
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
            total_tokens: if total_tokens > 0 {
                Some(total_tokens)
            } else {
                None
            },
            cost_usd: if cost_usd > 0.0 { Some(cost_usd) } else { None },
            message_count: if message_count > 0 {
                Some(message_count)
            } else {
                None
            },
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
        return Err(format!(
            "Session file not found: {}",
            session_file.display()
        ));
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
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
            Some(format!("Failed to get app data dir: {}", e))
        ))?;
    std::fs::create_dir_all(&app_dir).map_err(|e| rusqlite::Error::SqliteFailure(
        rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
        Some(format!("Failed to create app data dir: {}", e))
    ))?;

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
            model TEXT NOT NULL DEFAULT 'sonnet-3-5',
            enable_file_read BOOLEAN NOT NULL DEFAULT 1,
            enable_file_write BOOLEAN NOT NULL DEFAULT 1,
            enable_network BOOLEAN NOT NULL DEFAULT 0,
            hooks TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Add columns to existing table if they don't exist
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN default_task TEXT", []);
    let _ = conn.execute(
        "ALTER TABLE agents ADD COLUMN model TEXT DEFAULT 'sonnet-3-5'",
        [],
    );
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN hooks TEXT", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN source TEXT DEFAULT 'claudia'", []);
    let _ = conn.execute(
        "ALTER TABLE agents ADD COLUMN enable_file_read BOOLEAN DEFAULT 1",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE agents ADD COLUMN enable_file_write BOOLEAN DEFAULT 1",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE agents ADD COLUMN enable_network BOOLEAN DEFAULT 0",
        [],
    );

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
    let _ = conn.execute(
        "ALTER TABLE agent_runs ADD COLUMN status TEXT DEFAULT 'pending'",
        [],
    );
    let _ = conn.execute("ALTER TABLE agent_runs ADD COLUMN pid INTEGER", []);
    let _ = conn.execute(
        "ALTER TABLE agent_runs ADD COLUMN process_started_at TEXT",
        [],
    );

    // Drop old columns that are no longer needed (data is now read from JSONL files)
    // Note: SQLite doesn't support DROP COLUMN, so we'll ignore errors for existing columns
    let _ = conn.execute(
        "UPDATE agent_runs SET session_id = '' WHERE session_id IS NULL",
        [],
    );
    let _ = conn.execute("UPDATE agent_runs SET status = 'completed' WHERE status IS NULL AND completed_at IS NOT NULL", []);
    let _ = conn.execute("UPDATE agent_runs SET status = 'failed' WHERE status IS NULL AND completed_at IS NOT NULL AND session_id = ''", []);
    let _ = conn.execute(
        "UPDATE agent_runs SET status = 'pending' WHERE status IS NULL",
        [],
    );

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
    // Create environment variable groups table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS environment_variable_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            enabled BOOLEAN NOT NULL DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            is_system BOOLEAN NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Create environment variables table (added in version update)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS environment_variables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT 1,
            group_id INTEGER REFERENCES environment_variable_groups(id),
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    
    // Create a unique index that properly handles NULL group_id values
    // This allows same key names in different groups, including the default group (NULL/0)
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_env_vars_group_key 
         ON environment_variables(COALESCE(group_id, 0), key)",
        [],
    )?;
    
    // Check if we need to migrate the environment_variables table to fix UNIQUE constraint issues
    {
        // Check if the table has the old UNIQUE constraint that needs to be removed
        let mut needs_constraint_migration = false;
        
        if let Ok(mut stmt) = conn.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='environment_variables'") {
            if let Ok(mut rows) = stmt.query([]) {
                if let Some(row) = rows.next().unwrap_or(None) {
                    if let Ok(sql) = row.get::<_, String>(0) {
                        if sql.contains("UNIQUE(group_id, key)") || sql.contains("UNIQUE(key)") {
                            needs_constraint_migration = true;
                            log::info!("Detected old UNIQUE constraint in environment_variables table, migrating...");
                        }
                    }
                }
            }
        }
        
        if needs_constraint_migration {
            // Backup existing data
            let _ = conn.execute(
                "CREATE TABLE environment_variables_constraint_backup AS SELECT * FROM environment_variables",
                [],
            );
            
            // Drop the old table
            let _ = conn.execute("DROP TABLE environment_variables", []);
            
            // Recreate table with correct structure (no table-level UNIQUE constraint)
            conn.execute(
                "CREATE TABLE environment_variables (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    enabled BOOLEAN NOT NULL DEFAULT 1,
                    group_id INTEGER REFERENCES environment_variable_groups(id),
                    sort_order INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )",
                [],
            )?;
            
            // Create the correct unique index
            conn.execute(
                "CREATE UNIQUE INDEX idx_env_vars_group_key 
                 ON environment_variables(COALESCE(group_id, 0), key)",
                [],
            )?;
            
            // Restore data, handling potential duplicates by keeping the first occurrence
            if let Ok(mut stmt) = conn.prepare(
                "SELECT DISTINCT key, value, enabled, group_id, sort_order, created_at, updated_at 
                 FROM environment_variables_constraint_backup 
                 ORDER BY id"
            ) {
                if let Ok(rows) = stmt.query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,  // key
                        row.get::<_, String>(1)?,  // value
                        row.get::<_, bool>(2)?,    // enabled
                        row.get::<_, Option<i64>>(3)?, // group_id
                        row.get::<_, i64>(4)?,     // sort_order
                        row.get::<_, String>(5)?,  // created_at
                        row.get::<_, String>(6)?,  // updated_at
                    ))
                }) {
                    for row_result in rows {
                        if let Ok((key, value, enabled, group_id, sort_order, created_at, updated_at)) = row_result {
                            // Try to insert, ignore if duplicate (due to the unique index)
                            let _ = conn.execute(
                                "INSERT OR IGNORE INTO environment_variables 
                                 (key, value, enabled, group_id, sort_order, created_at, updated_at)
                                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                                params![key, value, enabled, group_id, sort_order, created_at, updated_at],
                            );
                        }
                    }
                }
            }
            
            // Clean up backup table
            let _ = conn.execute("DROP TABLE environment_variables_constraint_backup", []);
            
            log::info!("Successfully migrated environment_variables table constraints");
        }
    }
    
    // Check if environment_variables table has all required columns and fix if needed
    {
        let mut has_id_column = false;
        let mut has_enabled_column = false;
        let mut has_group_id_column = false;
        let mut has_sort_order_column = false;
        
        if let Ok(mut stmt) = conn.prepare("PRAGMA table_info(environment_variables)") {
            if let Ok(column_rows) = stmt.query_map([], |row| {
                Ok(row.get::<_, String>(1)?) // column name
            }) {
                for column_result in column_rows {
                    if let Ok(column_name) = column_result {
                        match column_name.as_str() {
                            "id" => has_id_column = true,
                            "enabled" => has_enabled_column = true,
                            "group_id" => has_group_id_column = true,
                            "sort_order" => has_sort_order_column = true,
                            _ => {}
                        }
                    }
                }
            }
        }
        
        // If the table doesn't have id column, we need to recreate it
        if !has_id_column {
            log::info!("Migrating environment_variables table to add id column");
            
            // Create backup table with old data
            let _ = conn.execute(
                "CREATE TABLE environment_variables_backup AS SELECT * FROM environment_variables",
                [],
            );
            
            // Drop old table
            let _ = conn.execute("DROP TABLE environment_variables", []);
            
            // Recreate table with proper structure
            conn.execute(
                "CREATE TABLE environment_variables (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    enabled BOOLEAN NOT NULL DEFAULT 1,
                    group_id INTEGER REFERENCES environment_variable_groups(id),
                    sort_order INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )",
                [],
            )?;
            
            // Create unique index for proper group_id handling
            conn.execute(
                "CREATE UNIQUE INDEX idx_env_vars_group_key 
                 ON environment_variables(COALESCE(group_id, 0), key)",
                [],
            )?;
            
            // Migrate data from backup (handle missing columns)
            if has_enabled_column {
                let _ = conn.execute(
                    "INSERT INTO environment_variables (key, value, enabled, group_id, sort_order, created_at, updated_at)
                     SELECT key, value, enabled, NULL, 0,
                            COALESCE(created_at, CURRENT_TIMESTAMP),
                            COALESCE(updated_at, CURRENT_TIMESTAMP)
                     FROM environment_variables_backup",
                    [],
                );
            } else {
                let _ = conn.execute(
                    "INSERT INTO environment_variables (key, value, enabled, group_id, sort_order, created_at, updated_at)
                     SELECT key, value, 1, NULL, 0,
                            COALESCE(created_at, CURRENT_TIMESTAMP),
                            COALESCE(updated_at, CURRENT_TIMESTAMP)
                     FROM environment_variables_backup",
                    [],
                );
            }
            
            // Drop backup table
            let _ = conn.execute("DROP TABLE environment_variables_backup", []);
            
            log::info!("Successfully migrated environment_variables table");
        } else {
            // Add missing columns individually for existing tables
            if !has_enabled_column {
                let _ = conn.execute(
                    "ALTER TABLE environment_variables ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT 1",
                    [],
                );
                // Ensure all existing rows have enabled = 1
                let _ = conn.execute(
                    "UPDATE environment_variables SET enabled = 1 WHERE enabled IS NULL",
                    [],
                );
                log::info!("Added 'enabled' column to existing environment_variables table");
            }
            
            if !has_group_id_column {
                let _ = conn.execute(
                    "ALTER TABLE environment_variables ADD COLUMN group_id INTEGER REFERENCES environment_variable_groups(id)",
                    [],
                );
                log::info!("Added 'group_id' column to existing environment_variables table");
            }
            
            if !has_sort_order_column {
                let _ = conn.execute(
                    "ALTER TABLE environment_variables ADD COLUMN sort_order INTEGER DEFAULT 0",
                    [],
                );
                // Ensure all existing rows have sort_order = 0
                let _ = conn.execute(
                    "UPDATE environment_variables SET sort_order = 0 WHERE sort_order IS NULL",
                    [],
                );
                log::info!("Added 'sort_order' column to existing environment_variables table");
            }
        }
    }


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
    // Create trigger to update environment variables timestamp
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS update_environment_variables_timestamp
         AFTER UPDATE ON environment_variables
         FOR EACH ROW
         BEGIN
             UPDATE environment_variables SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END",
        [],
    )?;
    
    // Create trigger to update environment variable groups timestamp
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS update_environment_variable_groups_timestamp
         AFTER UPDATE ON environment_variable_groups
         FOR EACH ROW
         BEGIN
             UPDATE environment_variable_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
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
        .prepare("SELECT id, name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, source, created_at, updated_at FROM agents ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let agents = stmt
        .query_map([], |row| {
            Ok(Agent {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                icon: row.get(2)?,
                system_prompt: row.get(3)?,
                default_task: row.get(4)?,
                model: row
                    .get::<_, String>(5)
                    .unwrap_or_else(|_| "sonnet".to_string()),
                enable_file_read: row.get::<_, bool>(6).unwrap_or(true),
                enable_file_write: row.get::<_, bool>(7).unwrap_or(true),
                enable_network: row.get::<_, bool>(8).unwrap_or(false),
                hooks: row.get(9)?,
                source: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
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
    enable_file_read: Option<bool>,
    enable_file_write: Option<bool>,
    enable_network: Option<bool>,
    hooks: Option<String>,
    source: Option<String>,
) -> Result<Agent, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let model = model.unwrap_or_else(|| "sonnet-3-5".to_string());
    let enable_file_read = enable_file_read.unwrap_or(true);
    let enable_file_write = enable_file_write.unwrap_or(true);
    let enable_network = enable_network.unwrap_or(false);
    let source = source.unwrap_or_else(|| "claudia".to_string());

    conn.execute(
        "INSERT INTO agents (name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, source],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    // Fetch the created agent
    let agent = conn
        .query_row(
            "SELECT id, name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, source, created_at, updated_at FROM agents WHERE id = ?1",
            params![id],
            |row| {
                Ok(Agent {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    system_prompt: row.get(3)?,
                    default_task: row.get(4)?,
                    model: row.get(5)?,
                    enable_file_read: row.get(6)?,
                    enable_file_write: row.get(7)?,
                    enable_network: row.get(8)?,
                    hooks: row.get(9)?,
                    source: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
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
    enable_file_read: Option<bool>,
    enable_file_write: Option<bool>,
    enable_network: Option<bool>,
    hooks: Option<String>,
) -> Result<Agent, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let model = model.unwrap_or_else(|| "sonnet-3-5".to_string());

    // Build dynamic query based on provided parameters
    let mut query =
        "UPDATE agents SET name = ?1, icon = ?2, system_prompt = ?3, default_task = ?4, model = ?5, hooks = ?6"
            .to_string();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![
        Box::new(name),
        Box::new(icon),
        Box::new(system_prompt),
        Box::new(default_task),
        Box::new(model),
        Box::new(hooks),
    ];
    let mut param_count = 6;

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

    conn.execute(
        &query,
        rusqlite::params_from_iter(params_vec.iter().map(|p| p.as_ref())),
    )
    .map_err(|e| e.to_string())?;

    // Fetch the updated agent
    let agent = conn
        .query_row(
            "SELECT id, name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, source, created_at, updated_at FROM agents WHERE id = ?1",
            params![id],
            |row| {
                Ok(Agent {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    system_prompt: row.get(3)?,
                    default_task: row.get(4)?,
                    model: row.get(5)?,
                    enable_file_read: row.get(6)?,
                    enable_file_write: row.get(7)?,
                    enable_network: row.get(8)?,
                    hooks: row.get(9)?,
                    source: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
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
            "SELECT id, name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, source, created_at, updated_at FROM agents WHERE id = ?1",
            params![id],
            |row| {
                Ok(Agent {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    system_prompt: row.get(3)?,
                    default_task: row.get(4)?,
                    model: row.get::<_, String>(5).unwrap_or_else(|_| "sonnet-3-5".to_string()),
                    enable_file_read: row.get::<_, bool>(6).unwrap_or(true),
                    enable_file_write: row.get::<_, bool>(7).unwrap_or(true),
                    enable_network: row.get::<_, bool>(8).unwrap_or(false),
                    hooks: row.get(9)?,
                    source: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
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
            status: row
                .get::<_, String>(8)
                .unwrap_or_else(|_| "pending".to_string()),
            pid: row
                .get::<_, Option<i64>>(9)
                .ok()
                .flatten()
                .map(|p| p as u32),
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
pub async fn get_agent_run_with_real_time_metrics(
    db: State<'_, AgentDb>,
    id: i64,
) -> Result<AgentRunWithMetrics, String> {
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

    // Create .claude/settings.json with agent hooks if it doesn't exist
    if let Some(hooks_json) = &agent.hooks {
        let claude_dir = std::path::Path::new(&project_path).join(".claude");
        let settings_path = claude_dir.join("settings.json");

        // Create .claude directory if it doesn't exist
        if !claude_dir.exists() {
            std::fs::create_dir_all(&claude_dir)
                .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
            info!("Created .claude directory at: {:?}", claude_dir);
        }

        // Check if settings.json already exists
        if !settings_path.exists() {
            // Parse the hooks JSON
            let hooks: serde_json::Value = serde_json::from_str(hooks_json)
                .map_err(|e| format!("Failed to parse agent hooks: {}", e))?;

            // Create a settings object with just the hooks
            let settings = serde_json::json!({
                "hooks": hooks
            });

            // Write the settings file
            let settings_content = serde_json::to_string_pretty(&settings)
                .map_err(|e| format!("Failed to serialize settings: {}", e))?;

            std::fs::write(&settings_path, settings_content)
                .map_err(|e| format!("Failed to write settings.json: {}", e))?;

            info!("Created settings.json with agent hooks at: {:?}", settings_path);
        } else {
            info!("settings.json already exists at: {:?}", settings_path);
        }
    }

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

    // Find Claude binary
    info!("Running agent '{}'", agent.name);
    let claude_path = match find_claude_binary(&app) {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to find claude binary: {}", e);
            return Err(e);
        }
    };

    // Build arguments
    let args = vec![
        "-p".to_string(),
        task.clone(),
        "--system-prompt".to_string(),
        agent.system_prompt.clone(),
        "--model".to_string(),
        execution_model.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--dangerously-skip-permissions".to_string(),
    ];

    // Execute based on whether we should use sidecar or system binary
    if should_use_sidecar(&claude_path) {
        spawn_agent_sidecar(app, run_id, agent_id, agent.name.clone(), args, project_path, task, execution_model, db, registry).await
    } else {
        spawn_agent_system(app, run_id, agent_id, agent.name.clone(), claude_path, args, project_path, task, execution_model, db, registry).await
    }
}

/// Determines whether to use sidecar or system binary execution for agents
fn should_use_sidecar(claude_path: &str) -> bool {
    claude_path == "claude-code"
}

/// Creates a sidecar command for agent execution
fn create_agent_sidecar_command(
    app: &AppHandle,
    args: Vec<String>,
    project_path: &str,
) -> Result<tauri_plugin_shell::process::Command, String> {
    let mut sidecar_cmd = app
        .shell()
        .sidecar("claude-code")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?;

    // Add all arguments
    sidecar_cmd = sidecar_cmd.args(args);

    // Set working directory
    sidecar_cmd = sidecar_cmd.current_dir(project_path);

    // Pass through proxy environment variables if they exist (only uppercase)
    for (key, value) in std::env::vars() {
        if key == "HTTP_PROXY"
            || key == "HTTPS_PROXY"
            || key == "NO_PROXY"
            || key == "ALL_PROXY"
        {
            debug!("Setting proxy env var for agent sidecar: {}={}", key, value);
            sidecar_cmd = sidecar_cmd.env(&key, &value);
        }
    }
    Ok(sidecar_cmd)
}

/// Creates a system binary command for agent execution
fn create_agent_system_command(
    claude_path: &str,
    args: Vec<String>,
    project_path: &str,
) -> Command {
    let mut cmd = create_command_with_env(claude_path);

    // Add all arguments
    for arg in args {
        cmd.arg(arg);
    }

    cmd.current_dir(project_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    cmd
}

/// Spawn agent using sidecar command
async fn spawn_agent_sidecar(
    app: AppHandle,
    run_id: i64,
    agent_id: i64,
    agent_name: String,
    args: Vec<String>,
    project_path: String,
    task: String,
    execution_model: String,
    db: State<'_, AgentDb>,
    registry: State<'_, crate::process::ProcessRegistryState>,
) -> Result<i64, String> {
    // Build the sidecar command
    let sidecar_cmd = create_agent_sidecar_command(&app, args, &project_path)?;

    // Spawn the process
    info!("🚀 Spawning Claude sidecar process...");
    let (mut receiver, child) = sidecar_cmd.spawn().map_err(|e| {
        error!("❌ Failed to spawn Claude sidecar process: {}", e);
        format!("Failed to spawn Claude sidecar: {}", e)
    })?;

    // Get the PID from child
    let pid = child.pid();
    let now = chrono::Utc::now().to_rfc3339();
    info!("✅ Claude sidecar process spawned successfully with PID: {}", pid);

    // Update the database with PID and status
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE agent_runs SET status = 'running', pid = ?1, process_started_at = ?2 WHERE id = ?3",
            params![pid as i64, now, run_id],
        ).map_err(|e| e.to_string())?;
        info!("📝 Updated database with running status and PID");
    }

    // Get app directory for database path
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let db_path = app_dir.join("agents.db");

    // Shared state for collecting session ID and live output
    let session_id = std::sync::Arc::new(Mutex::new(String::new()));
    let live_output = std::sync::Arc::new(Mutex::new(String::new()));
    let _start_time = std::time::Instant::now();

    // Register the process in the registry
    registry
        .0
        .register_sidecar_process(
            run_id,
            agent_id,
            agent_name,
            pid as u32,
            project_path.clone(),
            task.clone(),
            execution_model.clone(),
        )
        .map_err(|e| format!("Failed to register sidecar process: {}", e))?;
    info!("📋 Registered sidecar process in registry");

    // Handle sidecar events
    let app_handle = app.clone();
    let session_id_clone = session_id.clone();
    let live_output_clone = live_output.clone();
    let registry_clone = registry.0.clone();
    let first_output = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let first_output_clone = first_output.clone();
    let db_path_for_sidecar = db_path.clone();

    tokio::spawn(async move {
        info!("📖 Starting to read Claude sidecar events...");
        let mut line_count = 0;

        while let Some(event) = receiver.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    line_count += 1;

                    // Log first output
                    if !first_output_clone.load(std::sync::atomic::Ordering::Relaxed) {
                        info!(
                            "🎉 First output received from Claude sidecar process! Line: {}",
                            line
                        );
                        first_output_clone.store(true, std::sync::atomic::Ordering::Relaxed);
                    }

                    if line_count <= 5 {
                        info!("sidecar stdout[{}]: {}", line_count, line);
                    } else {
                        debug!("sidecar stdout[{}]: {}", line_count, line);
                    }

                    // Store live output
                    if let Ok(mut output) = live_output_clone.lock() {
                        output.push_str(&line);
                        output.push('\n');
                    }

                    // Also store in process registry
                    let _ = registry_clone.append_live_output(run_id, &line);

                    // Extract session ID from JSONL output
                    if let Ok(json) = serde_json::from_str::<JsonValue>(&line) {
                        // Claude Code uses "session_id" (underscore), not "sessionId"
                        if json.get("type").and_then(|t| t.as_str()) == Some("system") &&
                           json.get("subtype").and_then(|s| s.as_str()) == Some("init") {
                            if let Some(sid) = json.get("session_id").and_then(|s| s.as_str()) {
                                if let Ok(mut current_session_id) = session_id_clone.lock() {
                                    if current_session_id.is_empty() {
                                        *current_session_id = sid.to_string();
                                        info!("🔑 Extracted session ID: {}", sid);

                                        // Update database immediately with session ID
                                        if let Ok(conn) = Connection::open(&db_path_for_sidecar) {
                                            match conn.execute(
                                                "UPDATE agent_runs SET session_id = ?1 WHERE id = ?2",
                                                params![sid, run_id],
                                            ) {
                                                Ok(rows) => {
                                                    if rows > 0 {
                                                        info!("✅ Updated agent run {} with session ID immediately", run_id);
                                                    }
                                                }
                                                Err(e) => {
                                                    error!("❌ Failed to update session ID immediately: {}", e);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Emit the line to the frontend
                    let _ = app_handle.emit(&format!("agent-output:{}", run_id), &line);
                    let _ = app_handle.emit("agent-output", &line);
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    error!("sidecar stderr: {}", line);
                    let _ = app_handle.emit(&format!("agent-error:{}", run_id), &line);
                    let _ = app_handle.emit("agent-error", &line);
                }
                CommandEvent::Terminated(payload) => {
                    info!("Claude sidecar process terminated with code: {:?}", payload.code);

                    // Get the session ID
                    let extracted_session_id = if let Ok(sid) = session_id.lock() {
                        sid.clone()
                    } else {
                        String::new()
                    };

                    // Update database with completion
                    if let Ok(conn) = Connection::open(&db_path) {
                        let _ = conn.execute(
                            "UPDATE agent_runs SET session_id = ?1, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?2",
                            params![extracted_session_id, run_id],
                        );
                    }

                    let success = payload.code.unwrap_or(1) == 0;
                    let _ = app.emit("agent-complete", success);
                    let _ = app.emit(&format!("agent-complete:{}", run_id), success);
                    break;
                }
                _ => {}
            }
        }

        info!("📖 Finished reading Claude sidecar events. Total lines: {}", line_count);
    });

    Ok(run_id)
}

/// Spawn agent using system binary command
async fn spawn_agent_system(
    app: AppHandle,
    run_id: i64,
    agent_id: i64,
    agent_name: String,
    claude_path: String,
    args: Vec<String>,
    project_path: String,
    task: String,
    execution_model: String,
    db: State<'_, AgentDb>,
    registry: State<'_, crate::process::ProcessRegistryState>,
) -> Result<i64, String> {
    // Build the command
    let mut cmd = create_agent_system_command(&claude_path, args, &project_path);

    // Spawn the process
    info!("🚀 Spawning Claude system process...");
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
    let stdout_reader = TokioBufReader::new(stdout);
    let stderr_reader = TokioBufReader::new(stderr);

    // Create variables we need for the spawned tasks
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let db_path = app_dir.join("agents.db");

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
    let db_path_for_stdout = db_path.clone(); // Clone the db_path for the stdout task

    let stdout_task = tokio::spawn(async move {
        info!("📖 Starting to read Claude stdout...");
        let mut lines = stdout_reader.lines();
        let mut line_count = 0;

        while let Ok(Some(line)) = lines.next_line().await {
            line_count += 1;

            // Log first output
            if !first_output_clone.load(std::sync::atomic::Ordering::Relaxed) {
                info!(
                    "🎉 First output received from Claude process! Line: {}",
                    line
                );
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
                // Claude Code uses "session_id" (underscore), not "sessionId"
                if json.get("type").and_then(|t| t.as_str()) == Some("system") &&
                   json.get("subtype").and_then(|s| s.as_str()) == Some("init") {
                    if let Some(sid) = json.get("session_id").and_then(|s| s.as_str()) {
                        if let Ok(mut current_session_id) = session_id_clone.lock() {
                            if current_session_id.is_empty() {
                                *current_session_id = sid.to_string();
                                info!("🔑 Extracted session ID: {}", sid);

                                // Update database immediately with session ID
                                if let Ok(conn) = Connection::open(&db_path_for_stdout) {
                                    match conn.execute(
                                        "UPDATE agent_runs SET session_id = ?1 WHERE id = ?2",
                                        params![sid, run_id],
                                    ) {
                                        Ok(rows) => {
                                            if rows > 0 {
                                                info!("✅ Updated agent run {} with session ID immediately", run_id);
                                            }
                                        }
                                        Err(e) => {
                                            error!("❌ Failed to update session ID immediately: {}", e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Emit the line to the frontend with run_id for isolation
            let _ = app_handle.emit(&format!("agent-output:{}", run_id), &line);
            // Also emit to the generic event for backward compatibility
            let _ = app_handle.emit("agent-output", &line);
        }

        info!(
            "📖 Finished reading Claude stdout. Total lines: {}",
            line_count
        );
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
            // Emit error lines to the frontend with run_id for isolation
            let _ = app_handle_stderr.emit(&format!("agent-error:{}", run_id), &line);
            // Also emit to the generic event for backward compatibility
            let _ = app_handle_stderr.emit("agent-error", &line);
        }

        if error_count > 0 {
            warn!(
                "📖 Finished reading Claude stderr. Total error lines: {}",
                error_count
            );
        } else {
            info!("📖 Finished reading Claude stderr. No errors.");
        }
    });

    // Register the process in the registry for live output tracking (after stdout/stderr setup)
    registry
        .0
        .register_process(
            run_id,
            agent_id,
            agent_name,
            pid,
            project_path.clone(),
            task.clone(),
            execution_model.clone(),
            child,
        )
        .map_err(|e| format!("Failed to register process: {}", e))?;
    info!("📋 Registered process in registry");

    let db_path_for_monitor = db_path.clone(); // Clone for the monitor task

    // Monitor process status and wait for completion
    tokio::spawn(async move {
        info!("🕐 Starting process monitoring...");

        // Wait for first output with timeout
        for i in 0..300 {
            // 30 seconds (300 * 100ms)
            if first_output.load(std::sync::atomic::Ordering::Relaxed) {
                info!(
                    "✅ Output detected after {}ms, continuing normal execution",
                    i * 100
                );
                break;
            }

            if i == 299 {
                warn!("⏰ TIMEOUT: No output from Claude process after 30 seconds");
                warn!("💡 This usually means:");
                warn!("   1. Claude process is waiting for user input");
                warn!("   3. Claude failed to initialize but didn't report an error");
                warn!("   4. Network connectivity issues");
                warn!("   5. Authentication issues (API key not found/invalid)");

                // Process timed out - kill it via PID
                warn!(
                    "🔍 Process likely stuck waiting for input, attempting to kill PID: {}",
                    pid
                );
                let mut cmd = std::process::Command::new("kill");
                cmd.arg("-TERM").arg(pid.to_string());
                
                // On Unix systems, this doesn't need CREATE_NO_WINDOW
                let kill_result = cmd.output();

                match kill_result {
                    Ok(output) if output.status.success() => {
                        warn!("🔍 Successfully sent TERM signal to process");
                    }
                    Ok(_) => {
                        warn!("🔍 Failed to kill process with TERM, trying KILL");
                        let mut cmd = std::process::Command::new("kill");
                        cmd.arg("-KILL").arg(pid.to_string());
                        let _ = cmd.output();
                    }
                    Err(e) => {
                        warn!("🔍 Error killing process: {}", e);
                    }
                }

                // Update database
                if let Ok(conn) = Connection::open(&db_path_for_monitor) {
                    let _ = conn.execute(
                        "UPDATE agent_runs SET status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = ?1",
                        params![run_id],
                    );
                }

                let _ = app.emit("agent-complete", false);
                let _ = app.emit(&format!("agent-complete:{}", run_id), false);
                return;
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
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
        if let Ok(conn) = Connection::open(&db_path_for_monitor) {
            info!("🔄 Updating database with extracted session ID: {}", extracted_session_id);
            match conn.execute(
                "UPDATE agent_runs SET session_id = ?1, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?2",
                params![extracted_session_id, run_id],
            ) {
                Ok(rows_affected) => {
                    if rows_affected > 0 {
                        info!("✅ Successfully updated agent run {} with session ID: {}", run_id, extracted_session_id);
                    } else {
                        warn!("⚠️ No rows affected when updating agent run {} with session ID", run_id);
                    }
                }
                Err(e) => {
                    error!("❌ Failed to update agent run {} with session ID: {}", run_id, e);
                }
            }
        } else {
            error!("❌ Failed to open database to update session ID for run {}", run_id);
        }

        // Cleanup will be handled by the cleanup_finished_processes function

        let _ = app.emit("agent-complete", true);
        let _ = app.emit(&format!("agent-complete:{}", run_id), true);
    });

    Ok(run_id)
}

/// List all currently running agent sessions
#[tauri::command]
pub async fn list_running_sessions(
    db: State<'_, AgentDb>,
    registry: State<'_, crate::process::ProcessRegistryState>,
) -> Result<Vec<AgentRun>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // First get all running sessions from the database
    let mut stmt = conn.prepare(
        "SELECT id, agent_id, agent_name, agent_icon, task, model, project_path, session_id, status, pid, process_started_at, created_at, completed_at
         FROM agent_runs WHERE status = 'running' ORDER BY process_started_at DESC"
    ).map_err(|e| e.to_string())?;

    let mut runs = stmt
        .query_map([], |row| {
            Ok(AgentRun {
                id: Some(row.get(0)?),
                agent_id: row.get(1)?,
                agent_name: row.get(2)?,
                agent_icon: row.get(3)?,
                task: row.get(4)?,
                model: row.get(5)?,
                project_path: row.get(6)?,
                session_id: row.get(7)?,
                status: row
                    .get::<_, String>(8)
                    .unwrap_or_else(|_| "pending".to_string()),
                pid: row
                    .get::<_, Option<i64>>(9)
                    .ok()
                    .flatten()
                    .map(|p| p as u32),
                process_started_at: row.get(10)?,
                created_at: row.get(11)?,
                completed_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    drop(stmt);
    drop(conn);

    // Cross-check with the process registry to ensure accuracy
    // Get actually running processes from the registry
    let registry_processes = registry.0.get_running_agent_processes()?;
    let registry_run_ids: std::collections::HashSet<i64> = registry_processes
        .iter()
        .map(|p| p.run_id)
        .collect();

    // Filter out any database entries that aren't actually running in the registry
    // This handles cases where processes crashed without updating the database
    runs.retain(|run| {
        if let Some(run_id) = run.id {
            registry_run_ids.contains(&run_id)
        } else {
            false
        }
    });

    Ok(runs)
}

/// Kill a running agent session
#[tauri::command]
pub async fn kill_agent_session(
    app: AppHandle,
    db: State<'_, AgentDb>,
    registry: State<'_, crate::process::ProcessRegistryState>,
    run_id: i64,
) -> Result<bool, String> {
    info!("Attempting to kill agent session {}", run_id);

    // First try to kill using the process registry
    let killed_via_registry = match registry.0.kill_process(run_id).await {
        Ok(success) => {
            if success {
                info!("Successfully killed process {} via registry", run_id);
                true
            } else {
                warn!("Process {} not found in registry", run_id);
                false
            }
        }
        Err(e) => {
            warn!("Failed to kill process {} via registry: {}", run_id, e);
            false
        }
    };

    // If registry kill didn't work, try fallback with PID from database
    if !killed_via_registry {
        let pid_result = {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            conn.query_row(
                "SELECT pid FROM agent_runs WHERE id = ?1 AND status = 'running'",
                params![run_id],
                |row| row.get::<_, Option<i64>>(0),
            )
            .map_err(|e| e.to_string())?
        };

        if let Some(pid) = pid_result {
            info!("Attempting fallback kill for PID {} from database", pid);
            let _ = registry.0.kill_process_by_pid(run_id, pid as u32)?;
        }
    }

    // Update the database to mark as cancelled
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let updated = conn.execute(
        "UPDATE agent_runs SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = ?1 AND status = 'running'",
        params![run_id],
    ).map_err(|e| e.to_string())?;

    // Emit cancellation event with run_id for proper isolation
    let _ = app.emit(&format!("agent-cancelled:{}", run_id), true);

    Ok(updated > 0 || killed_via_registry)
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
        |row| row.get::<_, String>(0),
    ) {
        Ok(status) => Ok(Some(status)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Cleanup finished processes and update their status
#[tauri::command]
pub async fn cleanup_finished_processes(db: State<'_, AgentDb>) -> Result<Vec<i64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Get all running processes
    let mut stmt = conn
        .prepare("SELECT id, pid FROM agent_runs WHERE status = 'running' AND pid IS NOT NULL")
        .map_err(|e| e.to_string())?;

    let running_processes = stmt
        .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    drop(stmt);

    let mut cleaned_up = Vec::new();

    for (run_id, pid) in running_processes {
        // Check if the process is still running
        let is_running = if cfg!(target_os = "windows") {
            // On Windows, use tasklist to check if process exists
            let mut cmd = std::process::Command::new("tasklist");
            cmd.args(["/FI", &format!("PID eq {}", pid)])
               .args(["/FO", "CSV"]);
            
            // On Windows, hide the console window to prevent CMD popup
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
            
            match cmd.output() {
                Ok(output) => {
                    let output_str = String::from_utf8_lossy(&output.stdout);
                    output_str.lines().count() > 1 // Header + process line if exists
                }
                Err(_) => false,
            }
        } else {
            // On Unix-like systems, use kill -0 to check if process exists
            let mut cmd = std::process::Command::new("kill");
            cmd.args(["-0", &pid.to_string()]);
            
            // On Unix systems, this doesn't need CREATE_NO_WINDOW, but keep consistent structure
            match cmd.output() {
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
                info!(
                    "Marked agent run {} as completed (PID {} no longer running)",
                    run_id, pid
                );
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

    // Get the Claude directory
    let claude_dir = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude");

    // Find the correct project directory by searching for the session file
    let projects_dir = claude_dir.join("projects");

    // Check if projects directory exists
    if !projects_dir.exists() {
        log::error!("Projects directory not found at: {:?}", projects_dir);
        return Err("Projects directory not found".to_string());
    }

    // Search for the session file in all project directories
    let mut session_file_path = None;
    log::info!("Searching for session file {} in all project directories", run.session_id);

    if let Ok(entries) = std::fs::read_dir(&projects_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
                log::debug!("Checking project directory: {}", dir_name);

                let potential_session_file = path.join(format!("{}.jsonl", run.session_id));
                if potential_session_file.exists() {
                    log::info!("Found session file at: {:?}", potential_session_file);
                    session_file_path = Some(potential_session_file);
                    break;
                } else {
                    log::debug!("Session file not found in: {}", dir_name);
                }
            }
        }
    } else {
        log::error!("Failed to read projects directory");
    }

    // If we found the session file, read it
    if let Some(session_path) = session_file_path {
        match tokio::fs::read_to_string(&session_path).await {
            Ok(content) => Ok(content),
            Err(e) => {
                log::error!("Failed to read session file {}: {}", session_path.display(), e);
                // Fallback to live output if file read fails
                let live_output = registry.0.get_live_output(run_id)?;
                Ok(live_output)
            }
        }
    } else {
        // If session file not found, try the old method as fallback
        log::warn!("Session file not found for {}, trying legacy method", run.session_id);
        match read_session_jsonl(&run.session_id, &run.project_path).await {
            Ok(content) => Ok(content),
            Err(_) => {
                // Final fallback to live output
                let live_output = registry.0.get_live_output(run_id)?;
                Ok(live_output)
            }
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
                            let _ = app
                                .emit("session-output-update", &format!("{}:{}", run_id, content));
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
            if let Ok(app_dir) = app.path().app_data_dir() {
                if let Ok(conn) = rusqlite::Connection::open(app_dir.join("agents.db")) {
                if let Ok(status) = conn.query_row(
                    "SELECT status FROM agent_runs WHERE id = ?1",
                    rusqlite::params![run_id],
                    |row| row.get::<_, String>(0),
                ) {
                    if status != "running" {
                        debug!("Session {} is no longer running, stopping stream", run_id);
                        break;
                    }
                } else {
                    // If we can't query the status, assume it's still running
                    debug!(
                        "Could not query session status for {}, continuing stream",
                        run_id
                    );
                }
                } else {
                    debug!("Could not open database connection for session status check");
                }
            } else {
                debug!("Could not get app data dir for session status check");
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }

        debug!("Stopped streaming for session {}", run_id);
    });

    Ok(())
}

/// Export a single agent to JSON format
#[tauri::command]
pub async fn export_agent(db: State<'_, AgentDb>, id: i64) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Fetch the agent
    let agent = conn
        .query_row(
            "SELECT name, icon, system_prompt, default_task, model, hooks FROM agents WHERE id = ?1",
            params![id],
            |row| {
                Ok(serde_json::json!({
                    "name": row.get::<_, String>(0)?,
                    "icon": row.get::<_, String>(1)?,
                    "system_prompt": row.get::<_, String>(2)?,
                    "default_task": row.get::<_, Option<String>>(3)?,
                    "model": row.get::<_, String>(4)?,
                    "hooks": row.get::<_, Option<String>>(5)?
                }))
            },
        )
        .map_err(|e| format!("Failed to fetch agent: {}", e))?;

    // Create the export wrapper
    let export_data = serde_json::json!({
        "version": 1,
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "agent": agent
    });

    // Convert to pretty JSON string
    serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize agent: {}", e))
}

/// Export agent to file with native dialog
#[tauri::command]
pub async fn export_agent_to_file(
    db: State<'_, AgentDb>,
    id: i64,
    file_path: String,
) -> Result<(), String> {
    // Get the JSON data
    let json_data = export_agent(db, id).await?;

    // Write to file
    std::fs::write(&file_path, json_data).map_err(|e| format!("Failed to write file: {}", e))?;

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

    // Special handling for bundled sidecar reference
    if path == "claude-code" {
        // For bundled sidecar, we don't need to validate file existence
        // as it's handled by Tauri's sidecar system
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES ('claude_binary_path', ?1)
             ON CONFLICT(key) DO UPDATE SET value = ?1",
            params![path],
        )
        .map_err(|e| format!("Failed to save Claude binary path: {}", e))?;

        info!("✅ Claude binary path updated to bundled sidecar: {}", path);
        return Ok(());
    }

    // Validate that the path exists and is executable for system installations
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
    )
    .map_err(|e| format!("Failed to save Claude binary path: {}", e))?;

    info!("✅ Claude binary path updated to: {}", path);
    Ok(())
}

/// Refresh the Claude binary path cache to use the newly saved path immediately
#[tauri::command]
pub async fn refresh_claude_binary_path(app: AppHandle) -> Result<String, String> {
    info!("🔄 Refreshing Claude binary path...");

    // Clear any internal caches and re-read from the database
    let current_path = find_claude_binary(&app)?;

    info!("✅ Claude binary path refreshed to: {}", current_path);
    Ok(current_path)
}

/// List all available Claude installations on the system
#[tauri::command]
pub async fn list_claude_installations(
    app: AppHandle,
) -> Result<Vec<crate::claude_binary::ClaudeInstallation>, String> {
    info!("🔍 Discovering Claude installations...");
    let mut installations = crate::claude_binary::discover_claude_installations();

    if installations.is_empty() {
        warn!("No Claude Code installations found on the system");
        return Err("No Claude Code installations found on the system".to_string());
    }

    info!("Found {} Claude installation(s)", installations.len());

    // For bundled installations, execute the sidecar to get the actual version
    for installation in &mut installations {
        if installation.installation_type == crate::claude_binary::InstallationType::Bundled {
            // Try to get the version by executing the sidecar
            use tauri_plugin_shell::process::CommandEvent;

            // Create a temporary directory for the sidecar to run in
            let temp_dir = std::env::temp_dir();

            // Create sidecar command with --version flag
            let sidecar_cmd = match app
                .shell()
                .sidecar("claude-code") {
                Ok(cmd) => cmd.args(["--version"]).current_dir(&temp_dir),
                Err(e) => {
                    log::warn!("Failed to create sidecar command for version check: {}", e);
                    continue;
                }
            };

            // Spawn the sidecar and collect output
            match sidecar_cmd.spawn() {
                Ok((mut rx, _child)) => {
                    let mut stdout_output = String::new();
                    let mut stderr_output = String::new();

                    // Set a timeout for version check
                    let timeout = tokio::time::Duration::from_secs(5);
                    let start_time = tokio::time::Instant::now();

                    while let Ok(Some(event)) = tokio::time::timeout_at(
                        start_time + timeout,
                        rx.recv()
                    ).await {
                        match event {
                            CommandEvent::Stdout(data) => {
                                stdout_output.push_str(&String::from_utf8_lossy(&data));
                            }
                            CommandEvent::Stderr(data) => {
                                stderr_output.push_str(&String::from_utf8_lossy(&data));
                            }
                            CommandEvent::Terminated { .. } => {
                                break;
                            }
                            CommandEvent::Error(e) => {
                                log::warn!("Error during sidecar version check: {}", e);
                                break;
                            }
                            _ => {}
                        }
                    }

                    // Use regex to directly extract version pattern
                    let version_regex = regex::Regex::new(r"(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?)").ok();

                    if let Some(regex) = version_regex {
                        if let Some(captures) = regex.captures(&stdout_output) {
                            if let Some(version_match) = captures.get(1) {
                                installation.version = Some(version_match.as_str().to_string());
                                info!("Bundled sidecar version: {}", version_match.as_str());
                            }
                        }
                    }
                }
                Err(e) => {
                    log::warn!("Failed to spawn sidecar for version check: {}", e);
                }
            }
        }
    }

    Ok(installations)
}

/// Helper function to create a tokio Command with proper environment variables
/// This ensures commands like Claude can find Node.js and other dependencies
fn create_command_with_env(program: &str) -> Command {
    // Convert std::process::Command to tokio::process::Command
    let _std_cmd = crate::claude_binary::create_command_with_env(program);

    // Create a new tokio Command from the program path
    let mut tokio_cmd = Command::new(program);

    // On Windows, hide the console window to prevent CMD popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        tokio_cmd.creation_flags(CREATE_NO_WINDOW);
    }

    // Copy over all environment variables from the std::process::Command
    // This is a workaround since we can't directly convert between the two types
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

    // Ensure PATH contains common Homebrew locations
    if let Ok(existing_path) = std::env::var("PATH") {
        let mut paths: Vec<&str> = existing_path.split(':').collect();
        for p in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].iter() {
            if !paths.contains(p) {
                paths.push(p);
            }
        }
        let joined = paths.join(":");
        tokio_cmd.env("PATH", joined);
    } else {
        tokio_cmd.env("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin");
    }

    tokio_cmd
}

/// Import an agent from JSON data
#[tauri::command]
pub async fn import_agent(db: State<'_, AgentDb>, json_data: String) -> Result<Agent, String> {
    // Parse the JSON data
    let export_data: AgentExport =
        serde_json::from_str(&json_data).map_err(|e| format!("Invalid JSON format: {}", e))?;

    // Validate version
    if export_data.version != 1 {
        return Err(format!(
            "Unsupported export version: {}. This version of the app only supports version 1.",
            export_data.version
        ));
    }

    let agent_data = export_data.agent;
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Check if an agent with the same name already exists
    let existing_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM agents WHERE name = ?1",
            params![agent_data.name],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // If agent with same name exists, append a suffix
    let final_name = if existing_count > 0 {
        format!("{} (Imported)", agent_data.name)
    } else {
        agent_data.name
    };

    // Create the agent
    conn.execute(
        "INSERT INTO agents (name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, source) VALUES (?1, ?2, ?3, ?4, ?5, 1, 1, 0, ?6, ?7)",
        params![
            final_name,
            agent_data.icon,
            agent_data.system_prompt,
            agent_data.default_task,
            agent_data.model,
            agent_data.hooks,
            "claudia"
        ],
    )
    .map_err(|e| format!("Failed to create agent: {}", e))?;

    let id = conn.last_insert_rowid();

    // Fetch the created agent
    let agent = conn
        .query_row(
            "SELECT id, name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, source, created_at, updated_at FROM agents WHERE id = ?1",
            params![id],
            |row| {
                Ok(Agent {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    system_prompt: row.get(3)?,
                    default_task: row.get(4)?,
                    model: row.get(5)?,
                    enable_file_read: row.get(6)?,
                    enable_file_write: row.get(7)?,
                    enable_network: row.get(8)?,
                    hooks: row.get(9)?,
                    source: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
        .map_err(|e| format!("Failed to fetch created agent: {}", e))?;

    Ok(agent)
}

/// Import an agent from JSON data with source
pub async fn import_agent_with_source(db: State<'_, AgentDb>, json_data: String, source: Option<String>) -> Result<Agent, String> {
    // Parse the JSON data
    let export_data: AgentExport =
        serde_json::from_str(&json_data).map_err(|e| format!("Invalid JSON format: {}", e))?;

    // Validate version
    if export_data.version != 1 {
        return Err(format!(
            "Unsupported export version: {}. This version of the app only supports version 1.",
            export_data.version
        ));
    }

    let agent_data = export_data.agent;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let source = source.unwrap_or_else(|| "claudia".to_string());

    // Check if an agent with the same name already exists
    let existing_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM agents WHERE name = ?1",
            params![agent_data.name],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // If agent with same name exists, append a suffix
    let final_name = if existing_count > 0 {
        format!("{} (Imported)", agent_data.name)
    } else {
        agent_data.name
    };

    // Create the agent
    conn.execute(
        "INSERT INTO agents (name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, source) VALUES (?1, ?2, ?3, ?4, ?5, 1, 1, 0, ?6, ?7)",
        params![
            final_name,
            agent_data.icon,
            agent_data.system_prompt,
            agent_data.default_task,
            agent_data.model,
            agent_data.hooks,
            source
        ],
    )
    .map_err(|e| format!("Failed to create agent: {}", e))?;

    let id = conn.last_insert_rowid();

    // Fetch the created agent
    let agent = conn
        .query_row(
            "SELECT id, name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, source, created_at, updated_at FROM agents WHERE id = ?1",
            params![id],
            |row| {
                Ok(Agent {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    system_prompt: row.get(3)?,
                    default_task: row.get(4)?,
                    model: row.get(5)?,
                    enable_file_read: row.get(6)?,
                    enable_file_write: row.get(7)?,
                    enable_network: row.get(8)?,
                    hooks: row.get(9)?,
                    source: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
        .map_err(|e| format!("Failed to fetch created agent: {}", e))?;

    Ok(agent)
}

/// Import agent from file
#[tauri::command]
pub async fn import_agent_from_file(
    db: State<'_, AgentDb>,
    file_path: String,
    source: Option<String>,
) -> Result<Agent, String> {
    // Read the file
    let json_data =
        std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Import the agent with source
    import_agent_with_source(db, json_data, source).await
}

// GitHub Agent Import functionality

/// Represents a GitHub agent file from the API
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubAgentFile {
    pub name: String,
    pub path: String,
    pub download_url: String,
    pub size: i64,
    pub sha: String,
}

/// Represents the GitHub API response for directory contents
#[derive(Debug, Deserialize)]
struct GitHubApiResponse {
    name: String,
    path: String,
    sha: String,
    size: i64,
    download_url: Option<String>,
    #[serde(rename = "type")]
    file_type: String,
}

/// Fetch list of agents from GitHub repository
#[tauri::command]
pub async fn fetch_github_agents() -> Result<Vec<GitHubAgentFile>, String> {
    info!("Fetching agents from GitHub repository...");

    let client = reqwest::Client::new();
    let url = "https://api.github.com/repos/getAsterisk/claudia/contents/cc_agents";

    let response = client
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Claudia-App")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch from GitHub: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("GitHub API error ({}): {}", status, error_text));
    }

    let api_files: Vec<GitHubApiResponse> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    // Filter only .claudia.json files
    let agent_files: Vec<GitHubAgentFile> = api_files
        .into_iter()
        .filter(|f| f.name.ends_with(".claudia.json") && f.file_type == "file")
        .filter_map(|f| {
            f.download_url.map(|download_url| GitHubAgentFile {
                name: f.name,
                path: f.path,
                download_url,
                size: f.size,
                sha: f.sha,
            })
        })
        .collect();

    info!("Found {} agents on GitHub", agent_files.len());
    Ok(agent_files)
}

/// Fetch and preview a specific agent from GitHub
#[tauri::command]
pub async fn fetch_github_agent_content(download_url: String) -> Result<AgentExport, String> {
    info!("Fetching agent content from: {}", download_url);

    let client = reqwest::Client::new();
    let response = client
        .get(&download_url)
        .header("Accept", "application/json")
        .header("User-Agent", "Claudia-App")
        .send()
        .await
        .map_err(|e| format!("Failed to download agent: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download agent: HTTP {}",
            response.status()
        ));
    }

    let json_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Parse and validate the agent data
    let export_data: AgentExport = serde_json::from_str(&json_text)
        .map_err(|e| format!("Invalid agent JSON format: {}", e))?;

    // Validate version
    if export_data.version != 1 {
        return Err(format!(
            "Unsupported agent version: {}",
            export_data.version
        ));
    }

    Ok(export_data)
}

/// Import an agent directly from GitHub
#[tauri::command]
pub async fn import_agent_from_github(
    db: State<'_, AgentDb>,
    download_url: String,
) -> Result<Agent, String> {
    info!("Importing agent from GitHub: {}", download_url);

    // First, fetch the agent content
    let export_data = fetch_github_agent_content(download_url).await?;

    // Convert to JSON string and use existing import logic
    let json_data = serde_json::to_string(&export_data)
        .map_err(|e| format!("Failed to serialize agent data: {}", e))?;

    // Import using existing function
    import_agent(db, json_data).await
}

/// Load agent session history from JSONL file
/// Similar to Claude Code's load_session_history, but searches across all project directories
#[tauri::command]
pub async fn load_agent_session_history(
    session_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    log::info!("Loading agent session history for session: {}", session_id);

    let claude_dir = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude");

    let projects_dir = claude_dir.join("projects");

    if !projects_dir.exists() {
        log::error!("Projects directory not found at: {:?}", projects_dir);
        return Err("Projects directory not found".to_string());
    }

    // Search for the session file in all project directories
    let mut session_file_path = None;
    log::info!("Searching for session file {} in all project directories", session_id);

    if let Ok(entries) = std::fs::read_dir(&projects_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
                log::debug!("Checking project directory: {}", dir_name);

                let potential_session_file = path.join(format!("{}.jsonl", session_id));
                if potential_session_file.exists() {
                    log::info!("Found session file at: {:?}", potential_session_file);
                    session_file_path = Some(potential_session_file);
                    break;
                } else {
                    log::debug!("Session file not found in: {}", dir_name);
                }
            }
        }
    } else {
        log::error!("Failed to read projects directory");
    }

    if let Some(session_path) = session_file_path {
        let file = std::fs::File::open(&session_path)
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
    } else {
        Err(format!("Session file not found: {}", session_id))
    }
}
/// Parse agent markdown file to extract metadata and content
fn parse_agent_markdown(content: &str, file_name: &str) -> Result<(String, String, String, String, String), String> {
    let lines: Vec<&str> = content.lines().collect();
    let mut name = file_name.trim_end_matches(".md").to_string();
    let mut description = String::new();
    let mut icon = "bot".to_string();
    let mut color = "blue".to_string();
    let mut system_prompt = String::new();
    let mut in_frontmatter = false;
    let mut frontmatter_ended = false;

    for (i, line) in lines.iter().enumerate() {
        if i == 0 && line.starts_with("---") {
            in_frontmatter = true;
            continue;
        }

        if in_frontmatter && line.starts_with("---") {
            in_frontmatter = false;
            frontmatter_ended = true;
            continue;
        }

        if in_frontmatter {
            if let Some(colon_pos) = line.find(':') {
                let key = line[..colon_pos].trim();
                let value = line[colon_pos + 1..].trim().trim_matches('"');

                match key {
                    "name" => name = value.to_string(),
                    "description" => description = value.to_string(),
                    "icon" => icon = value.to_string(),
                    "color" => color = value.to_string(),
                    _ => {}
                }
            }
        } else if frontmatter_ended || !in_frontmatter {
            // This is the system prompt content
            if !line.trim().is_empty() || !system_prompt.is_empty() {
                if !system_prompt.is_empty() {
                    system_prompt.push('\n');
                }
                system_prompt.push_str(line);
            }
        }
    }

    // If no description was found in frontmatter, use the first non-empty line as description
    if description.is_empty() && !system_prompt.is_empty() {
        if let Some(first_line) = system_prompt.lines().find(|line| !line.trim().is_empty()) {
            description = first_line.trim().to_string();
            if description.len() > 100 {
                description = format!("{}...", &description[..97]);
            }
        }
    }

    Ok((name, description, system_prompt.trim().to_string(), icon, color))
}

/// List native agents directly from .claude/agents directory (without importing to DB)
#[tauri::command]
pub async fn list_native_agents() -> Result<Vec<Agent>, String> {
    info!("Listing native agents from .claude/agents");

    let home_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?;
    let agents_dir = home_dir.join(".claude").join("agents");

    if !agents_dir.exists() {
        info!("No .claude/agents directory found");
        return Ok(vec![]);
    }

    let mut agents = Vec::new();
    let mut agent_id = 1000; // Use high IDs to avoid conflict with DB agents

    // Read all .md files in the agents directory
    let entries = std::fs::read_dir(&agents_dir)
        .map_err(|e| format!("Failed to read agents directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if let Some(extension) = path.extension() {
            if extension == "md" {
                let file_name = path.file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("unknown");

                info!("Processing native agent file: {}", file_name);

                // Read the file content
                let content = std::fs::read_to_string(&path)
                    .map_err(|e| format!("Failed to read {}: {}", file_name, e))?;

                // Parse the frontmatter and content
                match parse_agent_markdown(&content, file_name) {
                    Ok((name, description, system_prompt, icon, _color)) => {
                        agents.push(Agent {
                            id: Some(agent_id),
                            name,
                            icon,
                            system_prompt,
                            default_task: Some(description),
                            model: "claude-3-5-sonnet-20241022".to_string(),
                            enable_file_read: true,
                            enable_file_write: true,
                            enable_network: true,
                            hooks: None,
                            source: Some("native".to_string()),
                            created_at: chrono::Utc::now().to_rfc3339(),
                            updated_at: chrono::Utc::now().to_rfc3339(),
                        });
                        agent_id += 1;
                    }
                    Err(e) => {
                        warn!("Failed to parse agent file {}: {}", file_name, e);
                    }
                }
            }
        }
    }

    info!("Found {} native agents", agents.len());
    Ok(agents)
}

/// Import native agents from .claude/agents directory
#[tauri::command]
pub async fn import_native_agents(db: State<'_, AgentDb>) -> Result<u32, String> {
    info!("Importing native agents from .claude/agents");

    let home_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?;
    let agents_dir = home_dir.join(".claude").join("agents");

    if !agents_dir.exists() {
        info!("No .claude/agents directory found");
        return Ok(0);
    }

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut imported_count = 0;

    // Read all .md files in the agents directory
    let entries = std::fs::read_dir(&agents_dir)
        .map_err(|e| format!("Failed to read agents directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if let Some(extension) = path.extension() {
            if extension == "md" {
                let file_name = path.file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("unknown");

                info!("Processing native agent file for import: {}", file_name);

                // Read the file content
                let content = std::fs::read_to_string(&path)
                    .map_err(|e| format!("Failed to read {}: {}", file_name, e))?;

                // Parse the frontmatter and content
                match parse_agent_markdown(&content, file_name) {
                    Ok((name, description, system_prompt, icon, _color)) => {
                        // Check if agent already exists
                        let existing_count: i64 = conn
                            .query_row(
                                "SELECT COUNT(*) FROM agents WHERE name = ?1 AND source = 'native'",
                                params![name],
                                |row| row.get(0),
                            )
                            .map_err(|e| e.to_string())?;

                        if existing_count > 0 {
                            info!("Agent '{}' already exists, skipping", name);
                            continue;
                        }

                        // Insert the agent into database
                        conn.execute(
                            "INSERT INTO agents (name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, source, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                            params![
                                &name,
                                &icon,
                                &system_prompt,
                                &description, // Use description as default_task
                                "claude-3-5-sonnet-20241022", // Default model
                                true, // enable_file_read
                                true, // enable_file_write
                                true, // enable_network
                                None::<String>, // hooks
                                "native", // source
                                chrono::Utc::now().to_rfc3339(),
                                chrono::Utc::now().to_rfc3339()
                            ],
                        ).map_err(|e| format!("Failed to insert agent '{}': {}", name, e))?;

                        imported_count += 1;
                        info!("Successfully imported agent: {}", name);
                    }
                    Err(e) => {
                        warn!("Failed to parse agent file {}: {}", file_name, e);
                    }
                }
            }
        }
    }

    info!("Imported {} native agents", imported_count);
    Ok(imported_count)
}

/// Delete all native agents from database (keeping .claude/agents files intact)
#[tauri::command]
pub async fn delete_native_agents(db: State<'_, AgentDb>) -> Result<u32, String> {
    info!("Deleting native agents from database");
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // First, let's debug what's actually in the database
    let mut stmt = conn
        .prepare("SELECT id, name, source FROM agents")
        .map_err(|e| e.to_string())?;

    let agent_rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut all_agents = Vec::new();
    for agent in agent_rows {
        let agent = agent.map_err(|e| e.to_string())?;
        all_agents.push(agent);
    }

    info!("Found {} total agents in database", all_agents.len());
    for (id, name, source) in &all_agents {
        info!("Agent {}: {} (source: {:?})", id, name, source);
    }

    // Delete agents where source is 'native'
    let deleted = conn
        .execute("DELETE FROM agents WHERE source = 'native'", [])
        .map_err(|e| e.to_string())?;

    info!("Deleted {} native agents from database", deleted);
    Ok(deleted as u32)
}

// Environment Variables Management Commands

/// Get all environment variables from database
#[tauri::command]
pub async fn get_environment_variables(db: State<'_, AgentDb>) -> Result<Vec<EnvironmentVariable>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Ensure the environment_variables table exists with the correct structure
    // Use a more conservative approach that doesn't drop data
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS environment_variables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT 1,
            group_id INTEGER REFERENCES environment_variable_groups(id),
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    );
    
    // Create unique index for proper group_id handling
    let _ = conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_env_vars_group_key 
         ON environment_variables(COALESCE(group_id, 0), key)",
        [],
    );
    
    // Add missing columns if they don't exist (same logic as in init_database)
    let _ = conn.execute("ALTER TABLE environment_variables ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT 1", []);
    let _ = conn.execute("UPDATE environment_variables SET enabled = 1 WHERE enabled IS NULL", []);
    let _ = conn.execute("ALTER TABLE environment_variables ADD COLUMN group_id INTEGER REFERENCES environment_variable_groups(id)", []);
    let _ = conn.execute("ALTER TABLE environment_variables ADD COLUMN sort_order INTEGER DEFAULT 0", []);
    let _ = conn.execute("UPDATE environment_variables SET sort_order = 0 WHERE sort_order IS NULL", []);
    
    log::debug!("Environment variables table ensured with correct structure");
    
    // Check which columns exist and build appropriate query
    let mut has_enabled = false;
    let mut has_group_id = false;
    let mut has_sort_order = false;
    
    if let Ok(mut stmt) = conn.prepare("PRAGMA table_info(environment_variables)") {
        if let Ok(column_rows) = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(1)?) // column name
        }) {
            for column_result in column_rows {
                if let Ok(column_name) = column_result {
                    match column_name.as_str() {
                        "enabled" => has_enabled = true,
                        "group_id" => has_group_id = true,
                        "sort_order" => has_sort_order = true,
                        _ => {}
                    }
                }
            }
        }
    }
    
    // Build query based on available columns
    let query = if has_enabled && has_group_id && has_sort_order {
        "SELECT id, key, value, enabled, group_id, sort_order, created_at, updated_at FROM environment_variables ORDER BY sort_order, key"
    } else if has_enabled {
        "SELECT id, key, value, enabled, NULL as group_id, 0 as sort_order, created_at, updated_at FROM environment_variables ORDER BY key"
    } else {
        "SELECT id, key, value, 1 as enabled, NULL as group_id, 0 as sort_order, created_at, updated_at FROM environment_variables ORDER BY key"
    };
    
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    
    let env_vars = stmt
        .query_map([], |row| {
            Ok(EnvironmentVariable {
                id: Some(row.get(0)?),
                key: row.get(1)?,
                value: row.get(2)?,
                enabled: row.get::<_, bool>(3)?,
                group_id: {
                    let val: Option<i64> = row.get(4).ok();
                    val
                },
                sort_order: row.get::<_, i32>(5)?,
                created_at: Some(row.get(6)?),
                updated_at: Some(row.get(7)?),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    
    // If we had to use fallback queries (missing columns), force an update to ensure proper schema
    if !has_enabled || !has_group_id || !has_sort_order {
        log::info!("Updating environment variables to ensure all have required fields");
        // Force an update cycle to normalize the data
        let normalized_vars: Vec<EnvironmentVariable> = env_vars.iter().map(|var| {
            EnvironmentVariable {
                id: var.id,
                key: var.key.clone(),
                value: var.value.clone(),
                enabled: var.enabled,
                group_id: var.group_id,
                sort_order: var.sort_order,
                created_at: var.created_at.clone(),
                updated_at: var.updated_at.clone(),
            }
        }).collect();
        
        // Save back to ensure all fields are properly stored
        if let Err(e) = save_environment_variables_internal(&conn, normalized_vars.clone()) {
            log::warn!("Failed to normalize environment variables: {}", e);
        }
        
        return Ok(normalized_vars);
    }
    
    Ok(env_vars)
}

/// Internal function to save environment variables
fn save_environment_variables_internal(
    conn: &rusqlite::Connection,
    env_vars: Vec<EnvironmentVariable>,
) -> Result<(), String> {
    
    // Ensure the environment_variables table exists (safety check for existing databases)
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS environment_variables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT 1,
            group_id INTEGER REFERENCES environment_variable_groups(id),
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    );
    
    // Create a unique index that allows same key in different groups
    let _ = conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_env_vars_group_key 
         ON environment_variables(COALESCE(group_id, 0), key)",
        [],
    );
    
    // Begin transaction
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    
    // Clear existing environment variables
    tx.execute("DELETE FROM environment_variables", [])
        .map_err(|e| e.to_string())?;
    
    // Validate and deduplicate environment variables before insertion
    // Group variables by (group_id, key) to detect duplicates
    let mut seen_keys: std::collections::HashMap<(Option<i64>, String), usize> = std::collections::HashMap::new();
    let mut deduplicated_vars = Vec::new();
    
    for (index, env_var) in env_vars.iter().enumerate() {
        if !env_var.key.trim().is_empty() && !env_var.value.trim().is_empty() {
            let key_tuple = (env_var.group_id, env_var.key.trim().to_string());
            
            if let Some(existing_index) = seen_keys.get(&key_tuple) {
                log::warn!("Duplicate environment variable key '{}' found in group {} at indices {} and {}. Using the later one.", 
                    env_var.key, env_var.group_id.unwrap_or(0), existing_index, index);
                // Replace the existing one with the current one (keep the later one)
                if let Some(existing_var) = deduplicated_vars.iter_mut().find(|(_, i)| *i == *existing_index) {
                    existing_var.0 = env_var.clone();
                }
            } else {
                seen_keys.insert(key_tuple, index);
                deduplicated_vars.push((env_var.clone(), index));
            }
        }
    }
    
    log::debug!("Inserting {} deduplicated environment variables", deduplicated_vars.len());
    
    // Insert deduplicated environment variables
    for (env_var, _) in deduplicated_vars {
        // Use INSERT to ensure we respect the UNIQUE(group_id, key) constraint
        // This allows same key names in different groups
        tx.execute(
            "INSERT INTO environment_variables (key, value, enabled, group_id, sort_order, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params![env_var.key.trim(), env_var.value.trim(), env_var.enabled, env_var.group_id, env_var.sort_order],
        )
        .map_err(|e| format!("Failed to insert environment variable '{}' in group {}: {}", env_var.key, env_var.group_id.unwrap_or(0), e))?;
    }
    
    // Commit transaction
    tx.commit().map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Save environment variables to database (replacing all existing ones)
#[tauri::command]
pub async fn save_environment_variables(
    db: State<'_, AgentDb>,
    env_vars: Vec<EnvironmentVariable>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    save_environment_variables_internal(&conn, env_vars)
}

/// Get enabled environment variables as a HashMap for use in processes
#[tauri::command]
pub async fn get_enabled_environment_variables(db: State<'_, AgentDb>) -> Result<std::collections::HashMap<String, String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Ensure tables exist with proper structure
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS environment_variable_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            enabled BOOLEAN NOT NULL DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            is_system BOOLEAN NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    );
    
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS environment_variables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT 1,
            group_id INTEGER REFERENCES environment_variable_groups(id),
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    );
    
    // Create a unique index that properly handles NULL group_id values
    // This allows same key names in different groups, including the default group (NULL/0)
    let _ = conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_env_vars_group_key 
         ON environment_variables(COALESCE(group_id, 0), key)",
        [],
    );
    
    // Add missing columns if they don't exist
    let _ = conn.execute("ALTER TABLE environment_variables ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT 1", []);
    let _ = conn.execute("UPDATE environment_variables SET enabled = 1 WHERE enabled IS NULL", []);
    let _ = conn.execute("ALTER TABLE environment_variables ADD COLUMN group_id INTEGER REFERENCES environment_variable_groups(id)", []);
    let _ = conn.execute("ALTER TABLE environment_variables ADD COLUMN sort_order INTEGER DEFAULT 0", []);
    let _ = conn.execute("UPDATE environment_variables SET sort_order = 0 WHERE sort_order IS NULL", []);
    
    // Query enabled variables from enabled groups with conflict resolution
    // For variables with the same key in multiple enabled groups, prioritize by group sort_order (ascending)
    let mut stmt = conn
        .prepare("
            SELECT DISTINCT ev.key, ev.value, 
                   COALESCE(eg.sort_order, 999999) as group_priority,
                   ev.sort_order
            FROM environment_variables ev
            LEFT JOIN environment_variable_groups eg ON ev.group_id = eg.id
            WHERE ev.enabled = 1 
            AND (ev.group_id IS NULL OR eg.enabled = 1)
            ORDER BY ev.key, group_priority ASC, ev.sort_order ASC
        ")
        .map_err(|e| e.to_string())?;
    
    let mut env_map = std::collections::HashMap::new();
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?, // key
                row.get::<_, String>(1)?, // value
                row.get::<_, i64>(2)?,    // group_priority
                row.get::<_, i64>(3)?     // sort_order
            ))
        })
        .map_err(|e| e.to_string())?;
    
    // Process rows and handle conflicts (same key from different enabled groups)
    for row in rows {
        let (key, value, _group_priority, _sort_order) = row.map_err(|e| e.to_string())?;
        // Only insert if key doesn't exist (first one wins due to ORDER BY)
        if !env_map.contains_key(&key) {
            env_map.insert(key, value);
        }
    }
    
    Ok(env_map)
}

/// Get all environment variable groups
#[tauri::command]
pub async fn get_environment_variable_groups(db: State<'_, AgentDb>) -> Result<Vec<EnvironmentVariableGroup>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, name, description, enabled, sort_order, is_system, created_at, updated_at FROM environment_variable_groups ORDER BY sort_order, name")
        .map_err(|e| e.to_string())?;
    
    let groups = stmt
        .query_map([], |row| {
            Ok(EnvironmentVariableGroup {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                description: row.get(2)?,
                enabled: row.get(3)?,
                sort_order: row.get::<_, i32>(4).unwrap_or(0),
                is_system: row.get(5)?,
                created_at: Some(row.get(6)?),
                updated_at: Some(row.get(7)?),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    
    Ok(groups)
}

/// Create a new environment variable group
#[tauri::command]
pub async fn create_environment_variable_group(
    db: State<'_, AgentDb>,
    name: String,
    description: Option<String>,
    sort_order: Option<i32>,
) -> Result<EnvironmentVariableGroup, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO environment_variable_groups (name, description, sort_order, is_system) VALUES (?1, ?2, ?3, ?4)",
        params![name, description, sort_order.unwrap_or(0), false],
    )
    .map_err(|e| e.to_string())?;
    
    let id = conn.last_insert_rowid();
    
    // Fetch the created group
    let group = conn
        .query_row(
            "SELECT id, name, description, enabled, sort_order, is_system, created_at, updated_at FROM environment_variable_groups WHERE id = ?1",
            params![id],
            |row| {
                Ok(EnvironmentVariableGroup {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    description: row.get(2)?,
                    enabled: row.get(3)?,
                    sort_order: row.get::<_, i32>(4).unwrap_or(0),
                    is_system: row.get(5)?,
                    created_at: Some(row.get(6)?),
                    updated_at: Some(row.get(7)?),
                })
            },
        )
        .map_err(|e| e.to_string())?;
    
    Ok(group)
}

/// Update an environment variable group
#[tauri::command]
pub async fn update_environment_variable_group(
    db: State<'_, AgentDb>,
    id: i64,
    name: String,
    description: Option<String>,
    enabled: bool,
    sort_order: i32,
) -> Result<EnvironmentVariableGroup, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE environment_variable_groups SET name = ?1, description = ?2, enabled = ?3, sort_order = ?4 WHERE id = ?5",
        params![name, description, enabled, sort_order, id],
    )
    .map_err(|e| e.to_string())?;
    
    // Fetch the updated group
    let group = conn
        .query_row(
            "SELECT id, name, description, enabled, sort_order, is_system, created_at, updated_at FROM environment_variable_groups WHERE id = ?1",
            params![id],
            |row| {
                Ok(EnvironmentVariableGroup {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    description: row.get(2)?,
                    enabled: row.get(3)?,
                    sort_order: row.get::<_, i32>(4).unwrap_or(0),
                    is_system: row.get(5)?,
                    created_at: Some(row.get(6)?),
                    updated_at: Some(row.get(7)?),
                })
            },
        )
        .map_err(|e| e.to_string())?;
    
    Ok(group)
}

/// Delete an environment variable group (only if it's not a system group and has no variables)
#[tauri::command]
pub async fn delete_environment_variable_group(db: State<'_, AgentDb>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    
    // Delete all environment variables in this group first (cascade delete)
    conn.execute("DELETE FROM environment_variables WHERE group_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    
    // Then delete the group
    conn.execute("DELETE FROM environment_variable_groups WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
