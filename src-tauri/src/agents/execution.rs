//! Agent execution logic and process management

use crate::agents::{binary::{find_claude_binary, create_command_with_env}, types::{Agent, AgentDb}};
use tauri::{AppHandle, Manager, State, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use rusqlite::params;
use serde_json::Value as JsonValue;
use log::{info, error, warn, debug};

/// Execute a CC agent with streaming output
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
    let agent = get_agent_from_db(db.clone(), agent_id).await?;
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
    
    // Build the command
    let claude_path = find_claude_binary(&app)?;
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
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    // Spawn the process
    info!("🚀 Spawning Claude process...");
    let mut child = cmd.spawn().map_err(|e| {
        error!("❌ Failed to spawn Claude process: {}", e);
        format!("Failed to spawn Claude: {}", e)
    })?;
    
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
    let session_id = Arc::new(Mutex::new(String::new()));
    let live_output = Arc::new(Mutex::new(String::new()));
    let start_time = std::time::Instant::now();
    
    // Spawn tasks to read stdout and stderr
    let app_handle = app.clone();
    let session_id_clone = session_id.clone();
    let live_output_clone = live_output.clone();
    let registry_clone = registry.0.clone();
    let first_output = Arc::new(std::sync::atomic::AtomicBool::new(false));
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
            let _ = registry_clone.append_live_output(run_id, &line).await;
            
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
    let first_error = Arc::new(std::sync::atomic::AtomicBool::new(false));
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
        crate::process::registry::RegisterProcessParams {
            run_id,
            agent_id,
            agent_name: agent.name.clone(),
            pid,
            project_path: project_path.clone(),
            task: task.clone(),
            model: execution_model.clone(),
            child,
        }
    ).await.map_err(|e| format!("Failed to register process: {}", e))?;
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
            if let Ok(conn) = rusqlite::Connection::open(&db_path) {
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
        if let Ok(conn) = rusqlite::Connection::open(&db_path) {
            let _ = conn.execute(
                "UPDATE agent_runs SET session_id = ?1, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?2",
                params![extracted_session_id, run_id],
            );
        }
        
        let _ = app.emit("agent-complete", true);
    });
    
    Ok(run_id)
}

/// Helper function to get agent from database
async fn get_agent_from_db(db: State<'_, AgentDb>, id: i64) -> Result<Agent, String> {
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
