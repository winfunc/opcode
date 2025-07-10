use serde::{Deserialize, Serialize};

/// Web server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebServerConfig {
    /// Whether the web server is enabled
    pub enabled: bool,
    /// Port to listen on
    pub port: u16,
    /// Host to bind to
    pub host: String,
    /// JWT secret for authentication
    pub jwt_secret: String,
    /// JWT token expiry duration in hours
    pub jwt_expiry_hours: u64,
    /// Whether to enable authentication
    pub auth_enabled: bool,
}

impl Default for WebServerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 3000,
            host: "0.0.0.0".to_string(),
            jwt_secret: "change-me-in-production".to_string(),
            jwt_expiry_hours: 24,
            auth_enabled: true,
        }
    }
}

impl WebServerConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Self {
        let mut config = Self::default();

        if let Ok(enabled) = std::env::var("WEB_SERVER_ENABLED") {
            config.enabled = enabled.parse().unwrap_or(false);
        }

        if let Ok(port) = std::env::var("WEB_SERVER_PORT") {
            if let Ok(p) = port.parse() {
                config.port = p;
            }
        }

        if let Ok(host) = std::env::var("WEB_SERVER_HOST") {
            config.host = host;
        }

        if let Ok(secret) = std::env::var("JWT_SECRET") {
            config.jwt_secret = secret;
        }

        if let Ok(expiry) = std::env::var("JWT_EXPIRY_HOURS") {
            if let Ok(h) = expiry.parse() {
                config.jwt_expiry_hours = h;
            }
        }

        if let Ok(auth) = std::env::var("AUTH_ENABLED") {
            config.auth_enabled = auth.parse().unwrap_or(true);
        }

        config
    }
}