use axum::response::Json;
use serde_json::json;

/// Health check endpoint
pub async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "claudia-web",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}