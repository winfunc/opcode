//! Checkpoint management commands

use tauri::State;
use crate::checkpoint::state::CheckpointState;

/// Get checkpoint manager for a session
#[tauri::command]
pub async fn get_checkpoint_manager(
    state: State<'_, CheckpointState>,
    session_id: String,
) -> Result<bool, String> {
    Ok(state.get_manager(&session_id).await.is_some())
}

/// Clear all checkpoint managers
#[tauri::command]
pub async fn clear_all_checkpoint_managers(
    state: State<'_, CheckpointState>,
) -> Result<(), String> {
    state.clear_all().await;
    Ok(())
}

/// Check if there's an active manager for a session
#[tauri::command]
pub async fn has_active_checkpoint_manager(
    state: State<'_, CheckpointState>,
    session_id: String,
) -> Result<bool, String> {
    Ok(state.has_active_manager(&session_id).await)
}

/// Clear all managers and return count
#[tauri::command]
pub async fn clear_all_checkpoint_managers_and_count(
    state: State<'_, CheckpointState>,
) -> Result<usize, String> {
    Ok(state.clear_all_and_count().await)
}

/// Get file snapshot path for a checkpoint
#[tauri::command]
pub async fn get_file_snapshot_path(
    project_id: String,
    session_id: String,
    checkpoint_id: String,
    file_hash: String,
) -> Result<String, String> {
    // Get Claude directory from home
    let claude_dir = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?
        .join(".claude");
    
    let paths = crate::checkpoint::CheckpointPaths::new(&claude_dir, &project_id, &session_id);
    Ok(paths.file_snapshot_path(&checkpoint_id, &file_hash).to_string_lossy().to_string())
}

/// Get file reference path for a checkpoint
#[tauri::command]
pub async fn get_file_reference_path(
    project_id: String,
    session_id: String,
    checkpoint_id: String,
    safe_filename: String,
) -> Result<String, String> {
    // Get Claude directory from home
    let claude_dir = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?
        .join(".claude");
    
    let paths = crate::checkpoint::CheckpointPaths::new(&claude_dir, &project_id, &session_id);
    Ok(paths.file_reference_path(&checkpoint_id, &safe_filename).to_string_lossy().to_string())
}
