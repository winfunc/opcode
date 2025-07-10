pub mod health;
pub mod projects;
pub mod sessions;
pub mod claude;
pub mod agents;
pub mod usage;
pub mod mcp;
pub mod checkpoints;
pub mod websocket;

use axum::{
    http::StatusCode,
    response::{Json, IntoResponse},
};
use serde_json::json;

/// Common error response type
pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let body = Json(json!({
            "error": self.message,
            "status": self.status.as_u16()
        }));
        (self.status, body).into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        ApiError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: err.to_string(),
        }
    }
}

/// Success response helper
pub fn success_response<T: serde::Serialize>(data: T) -> impl IntoResponse {
    Json(json!({
        "success": true,
        "data": data
    }))
}