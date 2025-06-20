//! Tauri command functions for the agent system

use crate::agents::{
    types::{Agent, AgentRun, AgentRunWithMetrics, AgentDb},
    execution::execute_agent,
    metrics::{get_agent_run_with_metrics},
};
use tauri::{AppHandle, State};
use rusqlite::params;
use log::{info, warn};
use serde::{Deserialize, Serialize};

/// Parameters for creating a new agent
#[derive(Debug, Deserialize, Serialize)]
pub struct CreateAgentParams {
    pub name: String,
    pub icon: String,
    pub system_prompt: String,
    pub default_task: Option<String>,
    pub model: Option<String>,
    pub sandbox_enabled: Option<bool>,
    pub enable_file_read: Option<bool>,
    pub enable_file_write: Option<bool>,
    pub enable_network: Option<bool>,
}

/// Parameters for updating an agent
#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateAgentParams {
    pub id: i64,
    pub name: String,
    pub icon: String,
    pub system_prompt: String,
    pub default_task: Option<String>,
    pub model: Option<String>,
    pub sandbox_enabled: Option<bool>,
    pub enable_file_read: Option<bool>,
    pub enable_file_write: Option<bool>,
    pub enable_network: Option<bool>,
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
                model: row.get(5)?,
                sandbox_enabled: row.get(6)?,
                enable_file_read: row.get(7)?,
                enable_file_write: row.get(8)?,
                enable_network: row.get(9)?,
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
    params: CreateAgentParams,
) -> Result<Agent, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let model = params.model.unwrap_or_else(|| "sonnet".to_string());
    let sandbox_enabled = params.sandbox_enabled.unwrap_or(true);
    let enable_file_read = params.enable_file_read.unwrap_or(true);
    let enable_file_write = params.enable_file_write.unwrap_or(true);
    let enable_network = params.enable_network.unwrap_or(false);
    
    conn.execute(
        "INSERT INTO agents (name, icon, system_prompt, default_task, model, sandbox_enabled, enable_file_read, enable_file_write, enable_network) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![params.name, params.icon, params.system_prompt, params.default_task, model, sandbox_enabled, enable_file_read, enable_file_write, enable_network],
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
    params: UpdateAgentParams,
) -> Result<Agent, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let model = params.model.unwrap_or_else(|| "sonnet".to_string());
    
    // Build dynamic query based on provided parameters
    let mut query = "UPDATE agents SET name = ?1, icon = ?2, system_prompt = ?3, default_task = ?4, model = ?5".to_string();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![
        Box::new(params.name),
        Box::new(params.icon),
        Box::new(params.system_prompt),
        Box::new(params.default_task),
        Box::new(model),
    ];
    let mut param_count = 5;
    
    if let Some(se) = params.sandbox_enabled {
        param_count += 1;
        query.push_str(&format!(", sandbox_enabled = ?{}", param_count));
        params_vec.push(Box::new(se));
    }
    if let Some(efr) = params.enable_file_read {
        param_count += 1;
        query.push_str(&format!(", enable_file_read = ?{}", param_count));
        params_vec.push(Box::new(efr));
    }
    if let Some(efw) = params.enable_file_write {
        param_count += 1;
        query.push_str(&format!(", enable_file_write = ?{}", param_count));
        params_vec.push(Box::new(efw));
    }
    if let Some(en) = params.enable_network {
        param_count += 1;
        query.push_str(&format!(", enable_network = ?{}", param_count));
        params_vec.push(Box::new(en));
    }
    
    param_count += 1;
    query.push_str(&format!(" WHERE id = ?{}", param_count));
    params_vec.push(Box::new(params.id));
    
    conn.execute(&query, rusqlite::params_from_iter(params_vec.iter().map(|p| p.as_ref())))
        .map_err(|e| e.to_string())?;
    
    // Fetch the updated agent
    let agent = conn
        .query_row(
            "SELECT id, name, icon, system_prompt, default_task, model, sandbox_enabled, enable_file_read, enable_file_write, enable_network, created_at, updated_at FROM agents WHERE id = ?1",
            params![params.id],
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
        "SELECT id FROM agent_runs WHERE session_id = ''"
    ).map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map([], |row| {
        row.get::<_, i64>(0)
    }).map_err(|e| e.to_string())?;
    
    let mut migrated_count = 0;
    
    for row_result in rows {
        let run_id = row_result.map_err(|e| e.to_string())?;
        
        // Generate a new session ID for runs that don't have one
        let session_id = uuid::Uuid::new_v4().to_string();
        
        // Update the run with the generated session ID
        match conn.execute(
            "UPDATE agent_runs SET session_id = ?1 WHERE id = ?2",
            params![session_id, run_id],
        ) {
            Ok(_) => {
                migrated_count += 1;
                info!("Migrated agent_run {} with session_id {}", run_id, session_id);
            }
            Err(e) => {
                warn!("Failed to update agent_run {}: {}", run_id, e);
            }
        }
    }
    
    let message = format!("Migration completed: {} runs migrated", migrated_count);
    info!("{}", message);
    Ok(message)
}

/// Execute a CC agent with streaming output (re-export from execution module)
#[tauri::command]
pub async fn execute_agent_command(
    app: AppHandle,
    agent_id: i64,
    project_path: String,
    task: String,
    model: Option<String>,
    db: State<'_, AgentDb>,
    registry: State<'_, crate::process::ProcessRegistryState>,
) -> Result<i64, String> {
    execute_agent(app, agent_id, project_path, task, model, db, registry).await
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
    registry: State<'_, crate::process::ProcessRegistryState>,
    run_id: i64,
) -> Result<bool, String> {
    // First try to kill using the process registry
    let killed_by_registry = registry.0.kill_process(run_id).await.unwrap_or(false);
    
    if !killed_by_registry {
        // Fallback to system kill if registry method failed
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
    }
    
    // Unregister from process registry
    let _ = registry.0.unregister_process(run_id).await;
    
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
        if let Ok(metadata) = path_buf.metadata() {
            let permissions = metadata.permissions();
            if permissions.mode() & 0o111 == 0 {
                return Err(format!("File is not executable: {}", path));
            }
        }
    }
    
    // Store the path in the database
    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('claude_binary_path', ?1)",
        params![path],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}
