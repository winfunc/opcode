use axum::{
    extract::{Path, State, Json as JsonExtractor},
    response::Json,
};
use std::sync::Arc;
use super::{ApiError, success_response};
use crate::web_server::state::AppState;
use crate::commands::agents::{Agent};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct CreateAgentRequest {
    pub name: String,
    pub icon: String,
    pub system_prompt: String,
    pub default_task: Option<String>,
    pub model: Option<String>,
    pub enable_file_read: Option<bool>,
    pub enable_file_write: Option<bool>,
    pub enable_network: Option<bool>,
    pub hooks: Option<String>,
}

/// List all agents
pub async fn list_agents(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let conn = state.agent_db.lock().map_err(|_| ApiError {
        status: axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        message: "Failed to acquire database lock".to_string(),
    })?;
    
    let mut stmt = conn
        .prepare("SELECT id, name, icon, system_prompt, default_task, model, enable_file_read, enable_file_write, enable_network, hooks, created_at, updated_at FROM agents ORDER BY created_at DESC")
        .map_err(|e| ApiError {
            status: axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            message: format!("Failed to prepare statement: {}", e),
        })?;

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
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| ApiError {
            status: axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            message: format!("Failed to query agents: {}", e),
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| ApiError {
            status: axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            message: format!("Failed to collect agents: {}", e),
        })?;
    
    Ok(success_response(agents))
}

/// Create new agent
pub async fn create_agent(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // TODO: Implement
    Ok(success_response("Agent created"))
}

/// Get agent details
pub async fn get_agent(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // TODO: Implement
    Ok(success_response("Agent details"))
}

/// Update agent
pub async fn update_agent(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // TODO: Implement
    Ok(success_response("Agent updated"))
}

/// Delete agent
pub async fn delete_agent(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // TODO: Implement
    Ok(success_response("Agent deleted"))
}

/// Execute agent
pub async fn execute_agent(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // TODO: Implement
    Ok(success_response("Agent execution started"))
}

/// List agent runs
pub async fn list_agent_runs(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // TODO: Implement
    Ok(success_response(vec!["Agent runs"]))
}