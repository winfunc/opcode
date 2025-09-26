use std::env;
use std::sync::Arc;
use parking_lot::Mutex;
use rusqlite::Connection;
use tempfile::TempDir;
use url::Url;

use super::proxy::{ProxySettings, apply_proxy_settings};
use super::agents::AgentDb;

/// Creates a temporary database connection with the necessary tables for proxy settings tests
fn create_test_db() -> (TempDir, AgentDb) {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");
    
    // Create a new SQLite connection
    let conn = Connection::open(&db_path).unwrap();
    
    // Create the app_settings table
    conn.execute(
        "CREATE TABLE app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    ).unwrap();
    
    // Create the AgentDb wrapper
    let agent_db = AgentDb(Arc::new(Mutex::new(conn)));
    
    (temp_dir, agent_db)
}

#[test]
fn test_add_auth_to_url() {
    // Extract the helper function for testing
    fn add_auth_to_url(url: &str, username: Option<&str>, password: Option<&str>) -> String {
        if username.is_none() || username.unwrap().is_empty() {
            return url.to_string();
        }
        
        if let Ok(mut parsed_url) = Url::parse(url) {
            // Set username
            let _ = parsed_url.set_username(username.unwrap());
            
            // Set password if available
            if let Some(pwd) = password {
                if !pwd.is_empty() {
                    let _ = parsed_url.set_password(Some(pwd));
                }
            }
            
            return parsed_url.to_string();
        }
        
        // Return original URL if parsing fails
        url.to_string()
    }

    // Test with no authentication
    let url = "http://example.com:8080";
    let result = add_auth_to_url(url, None, None);
    assert_eq!(result, "http://example.com:8080/");
    
    // Test with username only
    let result = add_auth_to_url(url, Some("user"), None);
    assert_eq!(result, "http://user@example.com:8080/");
    
    // Test with username and password
    let result = add_auth_to_url(url, Some("user"), Some("pass"));
    assert_eq!(result, "http://user:pass@example.com:8080/");
    
    // Test with empty username (should not modify URL)
    let result = add_auth_to_url(url, Some(""), Some("pass"));
    assert_eq!(result, "http://example.com:8080/");
    
    // Test with HTTPS URL
    let url = "https://secure.example.com";
    let result = add_auth_to_url(url, Some("user"), Some("pass"));
    assert_eq!(result, "https://user:pass@secure.example.com/");
    
    // Test with URL that already has a path
    let url = "http://example.com/api/v1";
    let result = add_auth_to_url(url, Some("user"), Some("pass"));
    assert_eq!(result, "http://user:pass@example.com/api/v1");
    
    // Test with special characters
    let url = "http://example.com";
    let result = add_auth_to_url(url, Some("user@domain"), Some("p@ss:word!"));
    // URL encoding should handle special characters
    assert!(result.contains("user%40domain"));
    assert!(result.contains("p%40ss%3Aword%21"));
}

#[test]
fn test_proxy_settings_with_auth() {
    // Setup - clear any existing proxy env vars
    env::remove_var("HTTP_PROXY");
    env::remove_var("HTTPS_PROXY");
    env::remove_var("ALL_PROXY");

    // Create settings with authentication
    let settings = ProxySettings {
        http_proxy: Some("http://example.com:8080".to_string()),
        https_proxy: Some("http://secure.example.com:8443".to_string()),
        no_proxy: Some("localhost,127.0.0.1".to_string()),
        all_proxy: Some("socks5://proxy.example.com:1080".to_string()),
        proxy_username: Some("testuser".to_string()),
        proxy_password: Some("testpassword".to_string()),
        enabled: true,
    };

    // Apply the settings
    apply_proxy_settings(&settings);

    // Check environment variables contain authentication
    let http_proxy = env::var("HTTP_PROXY").unwrap();
    let https_proxy = env::var("HTTPS_PROXY").unwrap();
    let all_proxy = env::var("ALL_PROXY").unwrap();
    
    assert!(http_proxy.contains("testuser:testpassword@"));
    assert!(https_proxy.contains("testuser:testpassword@"));
    assert!(all_proxy.contains("testuser:testpassword@"));
    
    assert_eq!(http_proxy, "http://testuser:testpassword@example.com:8080/");
    assert_eq!(https_proxy, "http://testuser:testpassword@secure.example.com:8443/");
    assert_eq!(all_proxy, "socks5://testuser:testpassword@proxy.example.com:1080/");
    
    // Cleanup
    env::remove_var("HTTP_PROXY");
    env::remove_var("HTTPS_PROXY");
    env::remove_var("NO_PROXY");
    env::remove_var("ALL_PROXY");
}

#[test]
fn test_proxy_settings_without_auth() {
    // Setup - clear any existing proxy env vars
    env::remove_var("HTTP_PROXY");
    env::remove_var("HTTPS_PROXY");
    env::remove_var("ALL_PROXY");

    // Create settings without authentication
    let settings = ProxySettings {
        http_proxy: Some("http://example.com:8080".to_string()),
        https_proxy: Some("http://secure.example.com:8443".to_string()),
        no_proxy: Some("localhost,127.0.0.1".to_string()),
        all_proxy: Some("socks5://proxy.example.com:1080".to_string()),
        proxy_username: None,
        proxy_password: None,
        enabled: true,
    };

    // Apply the settings
    apply_proxy_settings(&settings);

    // Check environment variables don't contain authentication
    let http_proxy = env::var("HTTP_PROXY").unwrap();
    let https_proxy = env::var("HTTPS_PROXY").unwrap();
    let all_proxy = env::var("ALL_PROXY").unwrap();
    
    assert!(!http_proxy.contains('@'));
    assert!(!https_proxy.contains('@'));
    assert!(!all_proxy.contains('@'));
    
    // Cleanup
    env::remove_var("HTTP_PROXY");
    env::remove_var("HTTPS_PROXY");
    env::remove_var("NO_PROXY");
    env::remove_var("ALL_PROXY");
}

#[test]
fn test_proxy_settings_disabled() {
    // Setup - set some proxy env vars
    env::set_var("HTTP_PROXY", "http://example.com");
    env::set_var("HTTPS_PROXY", "http://example.com");
    
    // Create settings with disabled flag
    let settings = ProxySettings {
        http_proxy: Some("http://example.com:8080".to_string()),
        https_proxy: Some("http://secure.example.com:8443".to_string()),
        no_proxy: None,
        all_proxy: None,
        proxy_username: Some("user".to_string()),
        proxy_password: Some("pass".to_string()),
        enabled: false,
    };

    // Apply the settings
    apply_proxy_settings(&settings);

    // Environment variables should be removed
    assert!(env::var("HTTP_PROXY").is_err());
    assert!(env::var("HTTPS_PROXY").is_err());
}

#[tokio::test]
async fn test_proxy_settings_db_storage() {
    // Create a test database
    let (_temp_dir, db) = create_test_db();
    
    // Create settings with authentication
    let settings = ProxySettings {
        http_proxy: Some("http://example.com:8080".to_string()),
        https_proxy: Some("http://secure.example.com:8443".to_string()),
        no_proxy: Some("localhost,127.0.0.1".to_string()),
        all_proxy: Some("socks5://proxy.example.com:1080".to_string()),
        proxy_username: Some("testuser".to_string()),
        proxy_password: Some("testpassword".to_string()),
        enabled: true,
    };
    
    // Save settings to database
    {
        let conn = db.0.lock();
        
        // Insert each setting
        let values = vec![
            ("proxy_enabled", settings.enabled.to_string()),
            ("proxy_http", settings.http_proxy.clone().unwrap_or_default()),
            ("proxy_https", settings.https_proxy.clone().unwrap_or_default()),
            ("proxy_no", settings.no_proxy.clone().unwrap_or_default()),
            ("proxy_all", settings.all_proxy.clone().unwrap_or_default()),
            ("proxy_username", settings.proxy_username.clone().unwrap_or_default()),
            ("proxy_password", settings.proxy_password.clone().unwrap_or_default()),
        ];
        
        for (key, value) in values {
            conn.execute(
                "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2)",
                rusqlite::params![key, value],
            ).unwrap();
        }
    }
    
    // Retrieve settings from database
    let mut retrieved_settings = ProxySettings::default();
    {
        let conn = db.0.lock();
        
        let keys = vec![
            ("proxy_enabled", "enabled"),
            ("proxy_http", "http_proxy"),
            ("proxy_https", "https_proxy"),
            ("proxy_no", "no_proxy"),
            ("proxy_all", "all_proxy"),
            ("proxy_username", "proxy_username"),
            ("proxy_password", "proxy_password"),
        ];
        
        for (db_key, field) in keys {
            if let Ok(value) = conn.query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                rusqlite::params![db_key],
                |row| row.get::<_, String>(0),
            ) {
                match field {
                    "enabled" => retrieved_settings.enabled = value == "true",
                    "http_proxy" => retrieved_settings.http_proxy = Some(value).filter(|s| !s.is_empty()),
                    "https_proxy" => retrieved_settings.https_proxy = Some(value).filter(|s| !s.is_empty()),
                    "no_proxy" => retrieved_settings.no_proxy = Some(value).filter(|s| !s.is_empty()),
                    "all_proxy" => retrieved_settings.all_proxy = Some(value).filter(|s| !s.is_empty()),
                    "proxy_username" => retrieved_settings.proxy_username = Some(value).filter(|s| !s.is_empty()),
                    "proxy_password" => retrieved_settings.proxy_password = Some(value).filter(|s| !s.is_empty()),
                    _ => {}
                }
            }
        }
    }
    
    // Verify retrieved settings match the original
    assert_eq!(retrieved_settings.enabled, settings.enabled);
    assert_eq!(retrieved_settings.http_proxy, settings.http_proxy);
    assert_eq!(retrieved_settings.https_proxy, settings.https_proxy);
    assert_eq!(retrieved_settings.no_proxy, settings.no_proxy);
    assert_eq!(retrieved_settings.all_proxy, settings.all_proxy);
    assert_eq!(retrieved_settings.proxy_username, settings.proxy_username);
    assert_eq!(retrieved_settings.proxy_password, settings.proxy_password);
}

// This test manually extracts and tests the add_auth_to_url function
// from apply_proxy_settings to verify its behavior with complex URLs
#[test]
fn test_complex_auth_urls() {
    // Helper function extracted from apply_proxy_settings
    fn add_auth_to_url(url: &str, username: Option<&str>, password: Option<&str>) -> String {
        if username.is_none() || username.unwrap().is_empty() {
            return url.to_string();
        }
        
        if let Ok(mut parsed_url) = Url::parse(url) {
            // Set username
            let _ = parsed_url.set_username(username.unwrap());
            
            // Set password if available
            if let Some(pwd) = password {
                if !pwd.is_empty() {
                    let _ = parsed_url.set_password(Some(pwd));
                }
            }
            
            return parsed_url.to_string();
        }
        
        // Return original URL if parsing fails
        url.to_string()
    }

    // Test complex URL with path, query parameters, and fragment
    let complex_url = "http://example.com:8080/api/path?query=value#fragment";
    let result = add_auth_to_url(complex_url, Some("user"), Some("pass"));
    
    assert_eq!(result, "http://user:pass@example.com:8080/api/path?query=value#fragment");
    
    // Test with special characters in URL
    let url_with_special = "https://example.com/path with spaces/resource?q=value with spaces";
    let result = add_auth_to_url(url_with_special, Some("user"), Some("pass"));
    
    // URL should maintain proper encoding
    assert!(result.contains("user:pass@"));
    assert!(result.contains("path%20with%20spaces"));
    assert!(result.contains("value%20with%20spaces"));
    
    // Test URL with username but no password
    let result = add_auth_to_url(complex_url, Some("user"), None);
    assert_eq!(result, "http://user@example.com:8080/api/path?query=value#fragment");
    
    // Test edge case with existing authentication in URL
    let url_with_auth = "http://existing:auth@example.com";
    let result = add_auth_to_url(url_with_auth, Some("new"), Some("creds"));
    
    // New credentials should replace existing ones
    assert_eq!(result, "http://new:creds@example.com/");
    assert!(!result.contains("existing:auth"));
}