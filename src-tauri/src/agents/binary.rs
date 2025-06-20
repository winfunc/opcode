//! Claude binary discovery and command creation utilities

use tauri::{AppHandle, Manager};
use tokio::process::Command;
use log::{info, warn, error};

/// Finds the full path to the claude binary
/// This is necessary because macOS apps have a limited PATH environment
pub fn find_claude_binary(app_handle: &AppHandle) -> Result<String, String> {
    info!("Searching for claude binary...");
    
    // First check if we have a stored path in the database
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        let db_path = app_data_dir.join("agents.db");
        if db_path.exists() {
            if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                if let Ok(stored_path) = conn.query_row(
                    "SELECT value FROM app_settings WHERE key = 'claude_binary_path'",
                    [],
                    |row| row.get::<_, String>(0),
                ) {
                    info!("Found stored claude path in database: {}", stored_path);
                    let path_buf = std::path::PathBuf::from(&stored_path);
                    if path_buf.exists() && path_buf.is_file() {
                        return Ok(stored_path);
                    } else {
                        warn!("Stored claude path no longer exists: {}", stored_path);
                    }
                }
            }
        }
    }
    
    // Common installation paths for claude
    let mut paths_to_check: Vec<String> = vec![
        "/usr/local/bin/claude".to_string(),
        "/opt/homebrew/bin/claude".to_string(),
        "/usr/bin/claude".to_string(),
        "/bin/claude".to_string(),
    ];
    
    // Also check user-specific paths
    if let Ok(home) = std::env::var("HOME") {
        paths_to_check.extend(vec![
            format!("{}/.claude/local/claude", home),
            format!("{}/.local/bin/claude", home),
            format!("{}/.npm-global/bin/claude", home),
            format!("{}/.yarn/bin/claude", home),
            format!("{}/.bun/bin/claude", home),
            format!("{}/bin/claude", home),
            // Check common node_modules locations
            format!("{}/node_modules/.bin/claude", home),
            format!("{}/.config/yarn/global/node_modules/.bin/claude", home),
        ]);
    }
    
    // Check each path
    for path in paths_to_check {
        let path_buf = std::path::PathBuf::from(&path);
        if path_buf.exists() && path_buf.is_file() {
            info!("Found claude at: {}", path);
            return Ok(path);
        }
    }
    
    // Fallback: try using 'which' command
    info!("Trying 'which claude' to find binary...");
    if let Ok(output) = std::process::Command::new("which")
        .arg("claude")
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                info!("'which' found claude at: {}", path);
                return Ok(path);
            }
        }
    }
    
    // Additional fallback: check if claude is in the current PATH
    // This might work in dev mode
    if let Ok(output) = std::process::Command::new("claude")
        .arg("--version")
        .output()
    {
        if output.status.success() {
            info!("claude is available in PATH (dev mode?)");
            return Ok("claude".to_string());
        }
    }
    
    error!("Could not find claude binary in any common location");
    Err("Claude Code not found. Please ensure it's installed and in one of these locations: /usr/local/bin, /opt/homebrew/bin, ~/.claude/local, ~/.local/bin, or in your PATH".to_string())
}

/// Helper function to create a tokio Command with proper environment variables
/// This ensures commands like Claude can find Node.js and other dependencies
pub fn create_command_with_env(program: &str) -> Command {
    let mut cmd = Command::new(program);

    // Inherit essential environment variables from parent process
    for (key, value) in std::env::vars() {
        if key == "PATH" || key == "HOME" || key == "USER" 
            || key == "SHELL" || key == "LANG" || key == "LC_ALL" || key.starts_with("LC_")
            || key == "NODE_PATH" || key == "NVM_DIR" || key == "NVM_BIN" 
            || key == "HOMEBREW_PREFIX" || key == "HOMEBREW_CELLAR" {
            cmd.env(&key, &value);
        }
    }

    // Ensure PATH contains common Homebrew locations so that `/usr/bin/env node` resolves
    // when the application is launched from the macOS GUI (PATH is very minimal there).
    if let Ok(existing_path) = std::env::var("PATH") {
        let mut paths: Vec<&str> = existing_path.split(':').collect();
        for p in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].iter() {
            if !paths.contains(p) {
                paths.push(p);
            }
        }
        let joined = paths.join(":");
        cmd.env("PATH", joined);
    } else {
        // Fallback: set a reasonable default PATH
        cmd.env("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin");
    }

    cmd
}
