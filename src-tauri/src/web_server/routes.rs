use axum::{
    Router,
    routing::{get, post, put, delete},
};
use super::state::AppState;
use super::handlers;

/// Build all API routes
pub fn build_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Health check
        .route("/api/health", get(handlers::health::health_check))
        
        // Project management routes
        .route("/api/projects", get(handlers::projects::list_projects))
        .route("/api/projects/:id/sessions", get(handlers::projects::get_project_sessions))
        
        // Session management routes
        .route("/api/sessions/:id", get(handlers::sessions::get_session))
        .route("/api/sessions/:id/history", get(handlers::sessions::get_session_history))
        .route("/api/sessions/new", post(handlers::sessions::create_new_session))
        
        // Claude execution routes
        .route("/api/claude/execute", post(handlers::claude::execute_claude))
        .route("/api/claude/continue", post(handlers::claude::continue_claude))
        .route("/api/claude/resume", post(handlers::claude::resume_claude))
        .route("/api/claude/cancel", post(handlers::claude::cancel_claude))
        .route("/api/claude/status/:session_id", get(handlers::claude::get_claude_status))
        .route("/api/claude/running", get(handlers::claude::list_running_sessions))
        
        // Agent management routes
        .route("/api/agents", get(handlers::agents::list_agents))
        .route("/api/agents", post(handlers::agents::create_agent))
        .route("/api/agents/:id", get(handlers::agents::get_agent))
        .route("/api/agents/:id", put(handlers::agents::update_agent))
        .route("/api/agents/:id", delete(handlers::agents::delete_agent))
        .route("/api/agents/:id/execute", post(handlers::agents::execute_agent))
        .route("/api/agents/:id/runs", get(handlers::agents::list_agent_runs))
        
        // Usage analytics routes
        .route("/api/usage/stats", get(handlers::usage::get_usage_stats))
        .route("/api/usage/details", get(handlers::usage::get_usage_details))
        .route("/api/usage/date-range", get(handlers::usage::get_usage_by_date_range))
        .route("/api/usage/session/:id/stats", get(handlers::usage::get_session_stats))
        
        // MCP server routes
        .route("/api/mcp/servers", get(handlers::mcp::list_servers))
        .route("/api/mcp/servers", post(handlers::mcp::add_server))
        .route("/api/mcp/servers/:name", get(handlers::mcp::get_server))
        .route("/api/mcp/servers/:name", delete(handlers::mcp::remove_server))
        .route("/api/mcp/test", post(handlers::mcp::test_connection))
        
        // Checkpoint/Timeline routes
        .route("/api/checkpoints", post(handlers::checkpoints::create_checkpoint))
        .route("/api/checkpoints/:session_id", get(handlers::checkpoints::list_checkpoints))
        .route("/api/checkpoints/:id/restore", post(handlers::checkpoints::restore_checkpoint))
        .route("/api/checkpoints/:id/fork", post(handlers::checkpoints::fork_checkpoint))
        .route("/api/checkpoints/:id/diff", get(handlers::checkpoints::get_checkpoint_diff))
        
        // WebSocket route
        .route("/ws", get(handlers::websocket::websocket_handler))
}