//! Agent command re-exports from the modular agents system

// Re-export all agent commands from the local agents module
pub use crate::agents::commands::*;
pub use crate::agents::types::AgentDb;
pub use crate::agents::database::init_database;


// Add missing commands that are referenced in main.rs but don't exist yet
use tauri::State;
use crate::process::ProcessRegistryState;

/// Cleanup finished processes (placeholder)
#[tauri::command]
pub async fn cleanup_finished_processes(
    registry: State<'_, ProcessRegistryState>,
) -> Result<i64, String> {
    match registry.0.cleanup_finished_processes().await {
        Ok(cleaned_pids) => Ok(cleaned_pids.len() as i64),
        Err(e) => Err(e),
    }
}

/// Get session output (placeholder)
#[tauri::command]
pub async fn get_session_output(
    _db: State<'_, AgentDb>,
    _run_id: i64,
) -> Result<String, String> {
    // This would read from JSONL files or process registry
    Ok("Session output not implemented yet".to_string())
}

/// Get live session output (placeholder)
#[tauri::command]
pub async fn get_live_session_output(
    registry: State<'_, ProcessRegistryState>,
    run_id: i64,
) -> Result<String, String> {
    registry.0.get_live_output(run_id).await
}

/// Stream session output (placeholder)
#[tauri::command]
pub async fn stream_session_output(
    _db: State<'_, AgentDb>,
    _run_id: i64,
) -> Result<Vec<String>, String> {
    // This would stream output from JSONL files
    Ok(vec!["Streaming not implemented yet".to_string()])
}

/// Get all running processes from the registry
#[tauri::command]
pub async fn get_running_processes(
    registry: State<'_, ProcessRegistryState>,
) -> Result<Vec<crate::process::ProcessInfo>, String> {
    registry.0.get_running_processes().await
}

/// Get a specific process from the registry
#[tauri::command]
pub async fn get_process_info(
    registry: State<'_, ProcessRegistryState>,
    run_id: i64,
) -> Result<Option<crate::process::ProcessInfo>, String> {
    registry.0.get_process(run_id).await
}
