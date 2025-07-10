use axum::{
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
    body::Body,
    extract::FromRequestParts,
    http::request::Parts,
};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Serialize, Deserialize};
use chrono::{Utc, Duration};

/// JWT claims
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: String,
    /// Expiration time
    pub exp: i64,
    /// Issued at
    pub iat: i64,
    /// User role
    pub role: String,
}

/// User information extracted from JWT
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: String,
    pub role: String,
}

/// JWT token generation
pub fn generate_token(user_id: &str, role: &str, secret: &str, expiry_hours: u64) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::hours(expiry_hours as i64);
    
    let claims = Claims {
        sub: user_id.to_string(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
        role: role.to_string(),
    };
    
    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_ref()))
}

/// JWT token validation
pub fn validate_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default()
    ).map(|data| data.claims)
}

/// Authentication middleware
pub async fn auth_middleware<B>(
    mut req: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    // Skip auth for health check and other public endpoints
    let path = req.uri().path();
    if path == "/api/health" || path.starts_with("/ws") {
        return Ok(next.run(req).await);
    }
    
    // Extract token from Authorization header
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|auth| auth.to_str().ok())
        .and_then(|auth| auth.strip_prefix("Bearer "));
    
    match token {
        Some(token) => {
            // TODO: Get JWT secret from app state
            let secret = "change-me-in-production"; // This should come from config
            
            match validate_token(token, secret) {
                Ok(claims) => {
                    // Add user info to request extensions
                    let user = AuthUser {
                        id: claims.sub,
                        role: claims.role,
                    };
                    req.extensions_mut().insert(user);
                    Ok(next.run(req).await)
                }
                Err(_) => Err(StatusCode::UNAUTHORIZED),
            }
        }
        None => Err(StatusCode::UNAUTHORIZED),
    }
}

/// Extract authenticated user from request
#[axum::async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or(StatusCode::UNAUTHORIZED)
    }
}

/// Login request
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Login response
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user_id: String,
    pub role: String,
}

/// User management (simplified for now)
pub async fn validate_user(_username: &str, _password: &str) -> Option<(String, String)> {
    // TODO: Implement proper user validation
    // For now, accept any login with a default user
    Some(("default-user".to_string(), "admin".to_string()))
}