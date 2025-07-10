use std::sync::Arc;
use crate::checkpoint::state::CheckpointState;
use crate::process::ProcessRegistryState;
use crate::commands::claude::ClaudeProcessState;
use super::config::WebServerConfig;

/// Shared application state for web handlers
#[derive(Clone)]
pub struct AppState {
    /// Agent database connection
    pub agent_db: Arc<std::sync::Mutex<rusqlite::Connection>>,
    /// Checkpoint state
    pub checkpoint_state: CheckpointState,
    /// Process registry for tracking running processes
    pub process_registry: ProcessRegistryState,
    /// Claude process state
    pub claude_process_state: ClaudeProcessState,
    /// Web server configuration
    pub config: WebServerConfig,
}