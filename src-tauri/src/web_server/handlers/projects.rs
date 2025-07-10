use axum::{
    extract::{Path, State},
    response::Json,
};
use std::sync::Arc;
use super::{ApiError, success_response};
use crate::web_server::state::AppState;
use crate::commands::claude::{list_projects as claude_list_projects, get_project_sessions as claude_get_sessions};

/// List all projects
pub async fn list_projects(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Call the existing Tauri command function
    let projects = claude_list_projects()
        .await
        .map_err(|e| ApiError {
            status: axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            message: format!("Failed to list projects: {}", e),
        })?;
    
    Ok(success_response(projects))
}

/// Get sessions for a specific project
pub async fn get_project_sessions(
    State(_state): State<Arc<AppState>>,
    Path(project_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Call the existing Tauri command function
    let sessions = claude_get_sessions(project_id)
        .await
        .map_err(|e| ApiError {
            status: axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            message: format!("Failed to get project sessions: {}", e),
        })?;
    
    Ok(success_response(sessions))
}