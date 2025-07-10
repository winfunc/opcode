pub mod config;
pub mod routes;
pub mod handlers;
pub mod websocket;
pub mod auth;
pub mod state;

use axum::{
    Router,
    extract::State as AxumState,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{CorsLayer, Any};
use tower_http::trace::TraceLayer;
use crate::AgentDb;
use crate::checkpoint::state::CheckpointState;
use crate::process::ProcessRegistryState;
use crate::commands::claude::ClaudeProcessState;

/// Web server configuration
pub use config::WebServerConfig;

/// Application state shared across web handlers
pub use state::AppState;

/// Initialize and start the web server
pub async fn start_web_server(
    config: WebServerConfig,
    agent_db: Arc<std::sync::Mutex<rusqlite::Connection>>,
    checkpoint_state: CheckpointState,
    process_registry: ProcessRegistryState,
    claude_process_state: ClaudeProcessState,
) -> anyhow::Result<()> {
    // Create shared application state
    let app_state = Arc::new(AppState {
        agent_db,
        checkpoint_state,
        process_registry,
        claude_process_state,
        config: config.clone(),
    });

    // Build the router with all routes
    let app = Router::new()
        .merge(routes::build_routes())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        )
        .layer(TraceLayer::new_for_http())
        .with_state(app_state.clone());

    // Create socket address
    let addr = SocketAddr::new(config.host.parse()?, config.port);
    
    log::info!("Starting web server on http://{}", addr);

    // Create the server
    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    // Start WebSocket handler in background
    let ws_state = app_state.clone();
    tokio::spawn(async move {
        websocket::handle_websocket_connections(ws_state).await;
    });

    // Run the server
    axum::serve(listener, app)
        .await
        .map_err(|e| anyhow::anyhow!("Server error: {}", e))?;

    Ok(())
}