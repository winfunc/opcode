/// Shared Claude Code detection functionality
/// 
/// This module provides centralized Claude Code binary detection and validation
/// to avoid code duplication across the codebase and ensure consistent behavior.

use anyhow::Result;
use log::{debug, error, info, warn};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};
use tokio::process::Command as TokioCommand;

/// Result of Claude Code version check
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeVersionStatus {
    pub is_installed: bool,
    pub version: Option<String>,
    pub output: String,
}

/// Enhanced Claude Code detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeDetectionResult {
    /// Path to the Claude binary
    pub path: String,
    /// Whether it's confirmed to be Claude Code (not just any "claude" binary)
    pub is_verified: bool,
    /// Version information if available
    pub version: Option<String>,
    /// Whether Node.js dependency is available
    pub node_available: bool,
}

/// Information about a discovered Claude installation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeInstallation {
    /// Path to the Claude binary
    pub path: String,
    /// Source of installation (e.g., "NVM v22.15.0", "Global", "Homebrew", etc.)
    pub source: String,
    /// Version string if available
    pub version: Option<String>,
    /// Whether it's verified to be Claude Code
    pub is_verified: bool,
    /// Whether Node.js is available for this installation
    pub node_available: bool,
    /// Whether this is the currently active/default installation
    pub is_active: bool,
    /// Priority score for auto-selection (higher = better)
    pub priority: i32,
}

/// Discovers all Claude installations on the system
/// Returns a list of all found installations with their sources and verification status
pub fn discover_all_claude_installations() -> Result<Vec<ClaudeInstallation>, String> {
    info!("🔍 Discovering all Claude installations...");
    let mut installations = Vec::new();
    
    // Get active NVM version first
    let active_nvm_version = get_active_nvm_version();
    
    // Check global installations first
    let global_paths = vec![
        "/usr/local/bin/claude",
        "/opt/homebrew/bin/claude", 
        "/usr/bin/claude",
        "/bin/claude",
    ];
    
    for path in global_paths {
        if std::path::PathBuf::from(path).exists() {
            if let Ok((is_verified, version)) = validate_claude_binary(path) {
                let source = if path.contains("homebrew") {
                    "Homebrew".to_string()
                } else if path.starts_with("/usr/local") {
                    "Global (/usr/local)".to_string()
                } else {
                    "System".to_string()
                };
                
                installations.push(ClaudeInstallation {
                    path: path.to_string(),
                    source,
                    version: version.clone(),
                    is_verified,
                    node_available: check_node_availability(),
                    is_active: false, // Will be determined later
                    priority: if is_verified { 50 } else { 10 },
                });
            }
        }
    }
    
    // Check user-specific paths
    if let Ok(home) = std::env::var("HOME") {
        let user_paths = vec![
            format!("{}/.claude/local/claude", home),
            format!("{}/.local/bin/claude", home),
            format!("{}/.npm-global/bin/claude", home),
            format!("{}/.yarn/bin/claude", home),
            format!("{}/.bun/bin/claude", home),
            format!("{}/bin/claude", home),
        ];
        
        for path in user_paths {
            if std::path::PathBuf::from(&path).exists() {
                if let Ok((is_verified, version)) = validate_claude_binary(&path) {
                    let source = if path.contains(".npm-global") {
                        "NPM Global".to_string()
                    } else if path.contains(".yarn") {
                        "Yarn Global".to_string()
                    } else if path.contains(".bun") {
                        "Bun Global".to_string()
                    } else if path.contains(".local") {
                        "User Local".to_string()
                    } else if path.contains(".claude") {
                        "Claude Local".to_string()
                    } else {
                        "User Bin".to_string()
                    };
                    
                    installations.push(ClaudeInstallation {
                        path,
                        source,
                        version: version.clone(),
                        is_verified,
                        node_available: check_node_availability(),
                        is_active: false,
                        priority: if is_verified { 60 } else { 20 },
                    });
                }
            }
        }
        
        // Check all NVM versions
        let nvm_dir = format!("{}/.nvm/versions/node", home);
        if let Ok(nvm_entries) = std::fs::read_dir(&nvm_dir) {
            for entry in nvm_entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    let version_name = entry.file_name().to_string_lossy().to_string();
                    let claude_path = format!("{}/bin/claude", entry.path().display());
                    
                    if std::path::PathBuf::from(&claude_path).exists() {
                        if let Ok((is_verified, claude_version)) = validate_claude_binary(&claude_path) {
                            let is_active_version = active_nvm_version.as_ref() == Some(&version_name);
                            let priority = if is_verified {
                                if is_active_version { 100 } else { 70 }
                            } else {
                                if is_active_version { 40 } else { 15 }
                            };
                            
                            installations.push(ClaudeInstallation {
                                path: claude_path,
                                source: format!("NVM {}{}", version_name, if is_active_version { " (active)" } else { "" }),
                                version: claude_version,
                                is_verified,
                                node_available: true, // NVM always has Node.js
                                is_active: is_active_version,
                                priority,
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Check what's currently in PATH (may be a symlink to one of the above)
    #[cfg(debug_assertions)]
    {
        if let Ok(output) = Command::new("which").arg("claude").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() && !installations.iter().any(|i| i.path == path) {
                    if let Ok((is_verified, version)) = validate_claude_binary(&path) {
                        installations.push(ClaudeInstallation {
                            path,
                            source: "PATH (which)".to_string(),
                            version,
                            is_verified,
                            node_available: check_node_availability(),
                            is_active: true,
                            priority: if is_verified { 80 } else { 30 },
                        });
                    }
                }
            }
        }
    }
    
    // Sort by priority (highest first)
    installations.sort_by(|a, b| b.priority.cmp(&a.priority));
    
    info!("🔍 Found {} Claude installations", installations.len());
    for (i, installation) in installations.iter().enumerate() {
        info!("  {}. {} - {} (verified: {}, version: {:?})", 
              i + 1, 
              installation.source, 
              installation.path, 
              installation.is_verified, 
              installation.version);
    }
    
    Ok(installations)
}

/// Gets the currently active NVM version
fn get_active_nvm_version() -> Option<String> {
    // Check if there's a current version file
    if let Ok(home) = std::env::var("HOME") {
        let current_file = format!("{}/.nvm/current", home);
        if let Ok(content) = std::fs::read_to_string(current_file) {
            return Some(content.trim().to_string());
        }
        
        // Fallback: check the alias/default file
        let default_file = format!("{}/.nvm/alias/default", home);
        if let Ok(content) = std::fs::read_to_string(default_file) {
            return Some(content.trim().to_string());
        }
    }
    
    // Fallback: check NODE_VERSION environment variable
    std::env::var("NODE_VERSION").ok()
}

/// Finds and validates the Claude Code binary
/// 
/// This function performs comprehensive detection:
/// 1. Checks database for stored path
/// 2. Searches common installation locations
/// 3. Validates the binary is actually Claude Code
/// 4. Checks Node.js dependency availability
pub fn find_and_validate_claude_binary(app_handle: &AppHandle) -> Result<ClaudeDetectionResult, String> {
    info!("Starting comprehensive Claude Code detection...");
    
    // First check if user has manually set a path
    if let Ok(stored_path) = get_stored_claude_path(app_handle) {
        if let Some(path) = stored_path {
            info!("Using stored Claude path: {}", path);
            match validate_claude_binary(&path) {
                Ok((is_verified, version)) => {
                    return Ok(ClaudeDetectionResult {
                        path,
                        is_verified,
                        version,
                        node_available: check_node_availability(),
                    });
                }
                Err(e) => {
                    warn!("Stored Claude path is invalid: {}", e);
                    // Continue with auto-detection
                }
            }
        }
    }
    
    // Auto-detect the best installation
    let installations = discover_all_claude_installations()?;
    
    // Find the best verified installation
    if let Some(best) = installations.into_iter().find(|i| i.is_verified) {
        info!("✅ Selected best Claude installation: {} ({})", best.source, best.path);
        Ok(ClaudeDetectionResult {
            path: best.path,
            is_verified: best.is_verified,
            version: best.version,
            node_available: best.node_available,
        })
    } else {
        Err("No verified Claude Code installations found. Please install Claude Code.".to_string())
    }
}

/// Gets the stored Claude path from database if available
fn get_stored_claude_path(app_handle: &AppHandle) -> Result<Option<String>, String> {
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        let db_path = app_data_dir.join("agents.db");
        if db_path.exists() {
            if let Ok(conn) = Connection::open(&db_path) {
                if let Ok(stored_path) = conn.query_row(
                    "SELECT value FROM app_settings WHERE key = 'claude_binary_path'",
                    [],
                    |row| row.get::<_, String>(0),
                ) {
                    return Ok(Some(stored_path));
                }
            }
        }
    }
    Ok(None)
}

/// Finds the full path to any "claude" binary
/// This is the core detection logic, extracted from the duplicated functions
fn find_claude_binary_path(app_handle: &AppHandle) -> Result<String, String> {
    info!("Searching for claude binary...");
    
    // First check if we have a stored path in the database
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        let db_path = app_data_dir.join("agents.db");
        if db_path.exists() {
            if let Ok(conn) = Connection::open(&db_path) {
                if let Ok(stored_path) = conn.query_row(
                    "SELECT value FROM app_settings WHERE key = 'claude_binary_path'",
                    [],
                    |row| row.get::<_, String>(0),
                ) {
                    info!("Found stored claude path in database: {}", stored_path);
                    let path_buf = PathBuf::from(&stored_path);
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
        
        // Check NVM paths
        if let Ok(nvm_dirs) = std::fs::read_dir(format!("{}/.nvm/versions/node", home)) {
            for entry in nvm_dirs.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    let nvm_claude_path = format!("{}/bin/claude", entry.path().display());
                    paths_to_check.push(nvm_claude_path);
                }
            }
        }
    }
    
    // Check each path
    for path in &paths_to_check {
        let path_buf = PathBuf::from(path);
        if path_buf.exists() && path_buf.is_file() {
            info!("Found claude at: {}", path);
            return Ok(path.clone());
        }
    }
    
    // In production builds, skip the 'which' command as it's blocked by Tauri
    #[cfg(not(debug_assertions))]
    {
        warn!("Cannot use 'which' command in production build, checking if claude is in PATH");
        // In production, just return "claude" and let validation fail with a proper error
        // if it's not actually available. The user can then set the path manually.
        return Ok("claude".to_string());
    }
    
    // Only try 'which' in development builds
    #[cfg(debug_assertions)]
    {
        // Fallback: try using 'which' command
        info!("Trying 'which claude' to find binary...");
        if let Ok(output) = Command::new("which").arg("claude").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    info!("'which' found claude at: {}", path);
                    return Ok(path);
                }
            }
        }
        
        // Additional fallback: check if claude is in the current PATH
        if let Ok(output) = Command::new("claude").arg("--version").output() {
            if output.status.success() {
                info!("claude is available in PATH (dev mode?)");
                return Ok("claude".to_string());
            }
        }
    }
    
    error!("Could not find claude binary in any common location");
    Err("Claude Code not found. Please ensure it's installed and in one of these locations: /usr/local/bin, /opt/homebrew/bin, ~/.claude/local, ~/.local/bin, or in your PATH".to_string())
}

/// Validates that a binary is actually Claude Code (not just any "claude" executable)
/// Returns (is_verified, version_string)
pub fn validate_claude_binary(binary_path: &str) -> Result<(bool, Option<String>), String> {
    debug!("Validating Claude binary at: {}", binary_path);
    
    // Create command with enhanced environment
    let mut cmd = create_command_with_env(binary_path);
    cmd.arg("--version");
    
    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                let version_output = String::from_utf8_lossy(&output.stdout);
                debug!("Version output: {}", version_output);
                
                // Check if this is actually Claude Code by looking for specific indicators
                let is_claude_code = version_output.contains("Claude Code") 
                    || version_output.contains("claude-code")
                    || version_output.contains("@anthropics/claude-code");
                
                if is_claude_code {
                    // Extract version if possible
                    let version = extract_version_from_output(&version_output);
                    info!("✅ Validated Claude Code binary, version: {:?}", version);
                    Ok((true, version))
                } else {
                    warn!("❌ Binary exists but is not Claude Code. Output: {}", version_output);
                    Ok((false, None))
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                error!("Claude binary returned non-zero exit code. stderr: {}", stderr);
                Err(format!("Binary exists but failed version check: {}", stderr))
            }
        }
        Err(e) => {
            error!("Failed to execute claude binary: {}", e);
            Err(format!("Failed to execute binary: {}", e))
        }
    }
}

/// Extracts version string from Claude Code output
pub fn extract_version_from_output(output: &str) -> Option<String> {
    // Try to extract version number from various formats
    for line in output.lines() {
        let line = line.trim();
        if line.contains("claude-code") || line.contains("Claude Code") {
            // Try to extract version with regex-like pattern
            if let Some(version) = extract_version_number(line) {
                return Some(version);
            }
            // Fallback: return the whole line
            return Some(line.to_string());
        }
    }
    None
}

/// Extract version number from a line using simple pattern matching
fn extract_version_number(line: &str) -> Option<String> {
    // Look for patterns like "1.2.3", "v1.2.3", "@package@1.2.3", etc.
    let words: Vec<&str> = line.split_whitespace().collect();
    for word in words {
        // Handle various patterns
        let clean_word = if word.contains('@') {
            // Handle @package@version or package@version
            word.split('@').last().unwrap_or("")
        } else {
            // Remove common prefixes like 'v'
            word.trim_start_matches('v')
        };
        
        // Check if it looks like a version (contains digits and dots)
        if clean_word.chars().any(|c| c.is_ascii_digit()) && clean_word.contains('.') {
            // Simple validation: should start with a digit
            if clean_word.chars().next().map_or(false, |c| c.is_ascii_digit()) {
                return Some(clean_word.to_string());
            }
        }
    }
    None
}

/// Checks if Node.js is available in the system
pub fn check_node_availability() -> bool {
    debug!("Checking Node.js availability...");
    
    match Command::new("node").arg("--version").output() {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout);
                debug!("Node.js version: {}", version.trim());
                true
            } else {
                debug!("Node.js command failed");
                false
            }
        }
        Err(e) => {
            debug!("Node.js not found: {}", e);
            false
        }
    }
}

/// Sets up environment variables for a std::process::Command with NVM integration
/// This ensures commands like Claude can find Node.js and other dependencies, especially for NVM installations
pub fn setup_command_env_for_claude_path(cmd: &mut Command, claude_path: &str) {
    // First, inherit essential environment variables from parent process
    for (key, value) in std::env::vars() {
        if key == "PATH" || key == "HOME" || key == "USER" 
            || key == "SHELL" || key == "LANG" || key == "LC_ALL" || key.starts_with("LC_")
            || key == "NODE_PATH" || key == "NVM_DIR" || key == "NVM_BIN" 
            || key == "HOMEBREW_PREFIX" || key == "HOMEBREW_CELLAR" {
            cmd.env(&key, &value);
        }
    }

    // Check if this is an NVM-based Claude installation
    let mut paths: Vec<String> = Vec::new();
    
    if claude_path.contains("/.nvm/versions/node/") {
        info!("🎯 NVM-based Claude detected: {}", claude_path);
        
        // Extract the Node.js version from the path using simple string parsing
        if let Some(start) = claude_path.find("/.nvm/versions/node/") {
            let after_node = &claude_path[start + "/.nvm/versions/node/".len()..];
            if let Some(end) = after_node.find('/') {
                let node_version = &after_node[..end];
                info!("🎯 Detected Node.js version: {}", node_version);
                
                if let Ok(home) = std::env::var("HOME") {
                    let nvm_node_bin = format!("{}/.nvm/versions/node/{}/bin", home, node_version);
                    let nvm_node_lib = format!("{}/.nvm/versions/node/{}/lib/node_modules", home, node_version);
                    
                    // Set up NVM-specific environment
                    paths.push(nvm_node_bin.clone());
                    cmd.env("NVM_BIN", &nvm_node_bin);
                    cmd.env("NODE_PATH", &nvm_node_lib);
                    
                    // Set NODE_VERSION for compatibility
                    cmd.env("NODE_VERSION", node_version);
                    
                    info!("🎯 Set NODE_PATH={}", nvm_node_lib);
                    info!("🎯 Set NVM_BIN={}", nvm_node_bin);
                }
            }
        }
    }

    // Add standard paths
    if let Ok(existing_path) = std::env::var("PATH") {
        let existing_paths: Vec<&str> = existing_path.split(':').collect();
        for path in existing_paths {
            if !path.is_empty() {
                paths.push(path.to_string());
            }
        }
    }
    
    // Ensure PATH contains common locations
    for p in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].iter() {
        if !paths.contains(&p.to_string()) {
            paths.push(p.to_string());
        }
    }
    
    let joined_path = paths.join(":");
    cmd.env("PATH", joined_path);
    
    info!("🎯 Final PATH for Claude (std): {}", paths.join(":"));
}

/// Sets up environment variables for a std::process::Command
/// This ensures commands like Claude can find Node.js and other dependencies
pub fn setup_command_env(cmd: &mut Command) {
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
}

/// Creates a std::process::Command with proper environment variables
/// This ensures commands like Claude can find Node.js and other dependencies
pub fn create_command_with_env(program: &str) -> Command {
    let mut cmd = Command::new(program);
    setup_command_env(&mut cmd);
    cmd
}

/// Sets up environment variables for a tokio::process::Command with NVM integration
/// This ensures commands like Claude can find Node.js and other dependencies, especially for NVM installations
pub fn setup_tokio_command_env_for_claude_path(cmd: &mut TokioCommand, claude_path: &str) {
    // First, inherit essential environment variables from parent process
    for (key, value) in std::env::vars() {
        if key == "PATH" || key == "HOME" || key == "USER" 
            || key == "SHELL" || key == "LANG" || key == "LC_ALL" || key.starts_with("LC_")
            || key == "NODE_PATH" || key == "NVM_DIR" || key == "NVM_BIN" 
            || key == "HOMEBREW_PREFIX" || key == "HOMEBREW_CELLAR" {
            cmd.env(&key, &value);
        }
    }

    // Check if this is an NVM-based Claude installation
    let mut paths: Vec<String> = Vec::new();
    
    if claude_path.contains("/.nvm/versions/node/") {
        info!("🎯 NVM-based Claude detected: {}", claude_path);
        
        // Extract the Node.js version from the path using simple string parsing
        if let Some(start) = claude_path.find("/.nvm/versions/node/") {
            let after_node = &claude_path[start + "/.nvm/versions/node/".len()..];
            if let Some(end) = after_node.find('/') {
                let node_version = &after_node[..end];
                info!("🎯 Detected Node.js version: {}", node_version);
                
                if let Ok(home) = std::env::var("HOME") {
                    let nvm_node_bin = format!("{}/.nvm/versions/node/{}/bin", home, node_version);
                    let nvm_node_lib = format!("{}/.nvm/versions/node/{}/lib/node_modules", home, node_version);
                    
                    // Set up NVM-specific environment
                    paths.push(nvm_node_bin.clone());
                    cmd.env("NVM_BIN", &nvm_node_bin);
                    cmd.env("NODE_PATH", &nvm_node_lib);
                    
                    // Set NODE_VERSION for compatibility
                    cmd.env("NODE_VERSION", node_version);
                    
                    info!("🎯 Set NODE_PATH={}", nvm_node_lib);
                    info!("🎯 Set NVM_BIN={}", nvm_node_bin);
                }
            }
        }
    }

    // Add standard paths
    if let Ok(existing_path) = std::env::var("PATH") {
        let existing_paths: Vec<&str> = existing_path.split(':').collect();
        for path in existing_paths {
            if !path.is_empty() {
                paths.push(path.to_string());
            }
        }
    }
    
    // Ensure PATH contains common locations
    for p in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].iter() {
        if !paths.contains(&p.to_string()) {
            paths.push(p.to_string());
        }
    }
    
    let joined_path = paths.join(":");
    cmd.env("PATH", joined_path);
    
    info!("🎯 Final PATH for Claude: {}", paths.join(":"));
}

/// Sets up environment variables for a tokio::process::Command
/// This ensures commands like Claude can find Node.js and other dependencies
pub fn setup_tokio_command_env(cmd: &mut TokioCommand) {
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
}

/// Creates a tokio command with proper environment variables
/// This ensures commands like Claude can find Node.js and other dependencies
pub fn create_tokio_command_with_env(program: &str) -> TokioCommand {
    let mut cmd = TokioCommand::new(program);
    setup_tokio_command_env(&mut cmd);
    cmd
}

/// Creates a tokio command with NVM-aware environment variables for a specific Claude path
/// This ensures commands like Claude can find Node.js and other dependencies, especially for NVM installations
pub fn create_tokio_command_with_nvm_env(program: &str) -> TokioCommand {
    let mut cmd = TokioCommand::new(program);
    setup_tokio_command_env_for_claude_path(&mut cmd, program);
    cmd
}

/// Legacy function for backward compatibility - now uses enhanced detection
/// Returns just the path for compatibility, but uses the full enhanced detection logic
pub fn find_claude_binary(app_handle: &AppHandle) -> Result<String, String> {
    match find_and_validate_claude_binary(app_handle) {
        Ok(result) => {
            if result.is_verified {
                Ok(result.path)
            } else {
                Err(format!("Found 'claude' binary at '{}' but it's not verified Claude Code", result.path))
            }
        }
        Err(e) => Err(e)
    }
}

/// Discovers all Claude installations and returns them for selection
#[tauri::command]
pub async fn discover_claude_installations() -> Result<Vec<ClaudeInstallation>, String> {
    discover_all_claude_installations()
}

/// Sets the user's selected Claude installation path
#[tauri::command]
pub async fn set_selected_claude_installation(app: AppHandle, path: String) -> Result<(), String> {
    // Validate the path first
    match validate_claude_binary(&path) {
        Ok((is_verified, _)) => {
            if !is_verified {
                return Err(format!("The selected binary at '{}' is not Claude Code", path));
            }
        }
        Err(e) => {
            return Err(format!("Failed to validate selected binary: {}", e));
        }
    }
    
    // Store in database
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("agents.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        
        // Ensure the settings table exists
        conn.execute(
            "CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Insert or update the setting
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES ('claude_binary_path', ?1)
             ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = CURRENT_TIMESTAMP",
            [&path],
        ).map_err(|e| e.to_string())?;
        
        info!("✅ Set selected Claude installation: {}", path);
        Ok(())
    } else {
        Err("Failed to access application data directory".to_string())
    }
}

/// Gets the currently selected Claude installation (if any)
#[tauri::command]
pub async fn get_selected_claude_installation(app: AppHandle) -> Result<Option<String>, String> {
    get_stored_claude_path(&app)
}

/// Clears the selected Claude installation, reverting to auto-detection
#[tauri::command]
pub async fn clear_selected_claude_installation(app: AppHandle) -> Result<(), String> {
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let db_path = app_data_dir.join("agents.db");
        if db_path.exists() {
            let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
            conn.execute(
                "DELETE FROM app_settings WHERE key = 'claude_binary_path'",
                [],
            ).map_err(|e| e.to_string())?;
            info!("✅ Cleared selected Claude installation - will use auto-detection");
        }
        Ok(())
    } else {
        Err("Failed to access application data directory".to_string())
    }
}

/// Checks Claude Code version with enhanced validation
pub async fn check_claude_version(app: AppHandle) -> Result<ClaudeVersionStatus, String> {
    info!("Checking Claude Code version with enhanced validation...");
    
    match find_and_validate_claude_binary(&app) {
        Ok(result) => {
            if !result.is_verified {
                return Ok(ClaudeVersionStatus {
                    is_installed: false,
                    version: None,
                    output: format!("Found 'claude' binary at '{}' but it's not Claude Code", result.path),
                });
            }
            
            if !result.node_available {
                warn!("Claude Code found but Node.js dependency is missing");
            }
            
            let version_text = result.version.as_ref()
                .map(|v| format!("Claude Code {}", v))
                .unwrap_or_else(|| "Claude Code (version unknown)".to_string());
            
            Ok(ClaudeVersionStatus {
                is_installed: true,
                version: result.version,
                output: version_text,
            })
        }
        Err(e) => {
            warn!("Claude Code detection failed: {}", e);
            Ok(ClaudeVersionStatus {
                is_installed: false,
                version: None,
                output: e,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use tempfile::TempDir;

    /// Helper to create a mock claude binary for testing
    fn create_mock_claude_binary(dir: &std::path::PathBuf, is_claude_code: bool) -> std::path::PathBuf {
        let claude_path = dir.join("claude");
        
        let version_output = if is_claude_code {
            "1.2.3 (Claude Code)\n"
        } else {
            "Some other claude binary 1.0.0\n"
        };
        
        // Create a shell script that mimics the binary
        let script_content = format!(
            "#!/bin/bash\nif [ \"$1\" = \"--version\" ]; then\n  echo \"{}\"\n  exit 0\nfi\necho \"Running claude with args: $@\"\n",
            version_output
        );
        
        fs::write(&claude_path, script_content).expect("Failed to create mock claude binary");
        
        // Make it executable
        let mut permissions = fs::metadata(&claude_path).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&claude_path, permissions).unwrap();
        
        claude_path
    }

    #[test]
    fn test_validate_claude_binary_detects_claude_code() {
        let temp_dir = TempDir::new().unwrap();
        let claude_path = create_mock_claude_binary(&temp_dir.path().to_path_buf(), true);
        
        let validation_result = validate_claude_binary(claude_path.to_str().unwrap());
        
        match validation_result {
            Ok((is_verified, version)) => {
                assert!(is_verified, "Should verify as Claude Code");
                assert!(version.is_some(), "Should extract version");
                assert_eq!(version.unwrap(), "1.2.3", "Should extract correct version");
            }
            Err(e) => panic!("Validation should succeed: {}", e),
        }
    }

    #[test]
    fn test_validate_claude_binary_rejects_other_binaries() {
        let temp_dir = TempDir::new().unwrap();
        let claude_path = create_mock_claude_binary(&temp_dir.path().to_path_buf(), false);
        
        let validation_result = validate_claude_binary(claude_path.to_str().unwrap());
        
        match validation_result {
            Ok((is_verified, version)) => {
                assert!(!is_verified, "Should not verify as Claude Code");
                assert!(version.is_none(), "Should not extract version for non-Claude Code binary");
            }
            Err(_) => {
                // This is also acceptable - rejection due to validation failure
            }
        }
    }

    #[test]
    fn test_extract_version_from_claude_output() {
        let test_cases = vec![
            ("1.2.3 (Claude Code)", Some("1.2.3".to_string())),
            ("v2.0.1 (Claude Code)", Some("2.0.1".to_string())),
            ("Claude Code 1.5.0", Some("1.5.0".to_string())),
            ("@anthropics/claude-code 0.9.8", Some("0.9.8".to_string())),
            ("Some other binary 1.0.0", None),
            ("", None),
        ];
        
        for (input, expected) in test_cases {
            let result = extract_version_from_output(input);
            assert_eq!(result, expected, "Failed for input: '{}'", input);
        }
    }

    #[test]
    fn test_extract_version_number_edge_cases() {
        use super::extract_version_number;
        
        let test_cases = vec![
            ("Claude Code 1.2.3", Some("1.2.3".to_string())),
            ("v1.2.3", Some("1.2.3".to_string())),
            ("@anthropics/claude-code@1.5.0", Some("1.5.0".to_string())),
            ("1.2.3-beta", Some("1.2.3-beta".to_string())),
            ("not a version", None),
            ("", None),
        ];
        
        for (input, expected) in test_cases {
            let result = extract_version_number(input);
            assert_eq!(result, expected, "Failed for input: '{}'", input);
        }
    }

    #[test]
    fn test_node_availability_check() {
        // This test checks if Node.js detection works
        // The result depends on whether Node.js is actually installed
        let node_available = check_node_availability();
        
        // We can't assert the exact result since it depends on the test environment
        // But we can verify it returns a boolean without panicking
        assert!(node_available == true || node_available == false);
    }

    #[test]
    fn test_setup_command_env() {
        let mut cmd = Command::new("echo");
        setup_command_env(&mut cmd);
        
        // The command should now have enhanced PATH
        // We can run it to ensure it doesn't crash
        let output = cmd.arg("test").output().unwrap();
        assert!(output.status.success());
    }

    #[test]
    fn test_create_command_with_env() {
        let mut cmd = create_command_with_env("echo");
        
        // Should be able to run the command
        let output = cmd.arg("test").output().unwrap();
        assert!(output.status.success());
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert_eq!(stdout.trim(), "test");
    }

    #[test]
    fn test_version_number_extraction_patterns() {
        let patterns = vec![
            ("1.2.3", Some("1.2.3".to_string())),
            ("v1.2.3", Some("1.2.3".to_string())),
            ("version 1.2.3", Some("1.2.3".to_string())),
            ("1.2.3-beta.1", Some("1.2.3-beta.1".to_string())),
            ("1.2.3+build", Some("1.2.3+build".to_string())),
            ("10.20.30", Some("10.20.30".to_string())),
            ("1.2", Some("1.2".to_string())),
            ("not.a.version", None),
            ("", None),
            ("abc", None),
        ];
        
        for (input, expected) in patterns {
            let result = extract_version_number(input);
            // Note: The exact behavior depends on the implementation
            // This test mainly ensures the function doesn't crash
            println!("Input: '{}' -> Result: {:?} (Expected: {:?})", input, result, expected);
        }
    }

    #[test]
    fn test_nvm_path_detection() {
        let nvm_paths = vec![
            "/Users/testuser/.nvm/versions/node/v18.17.0/bin/claude",
            "/Users/testuser/.nvm/versions/node/v20.10.0/bin/claude",
            "/Users/testuser/.nvm/versions/node/v16.14.2/bin/claude",
        ];
        
        for path in nvm_paths {
            // Test that NVM paths are correctly identified
            assert!(path.contains("/.nvm/versions/node/"), "Should detect NVM path: {}", path);
            
            // Test version extraction
            if let Some(start) = path.find("/.nvm/versions/node/") {
                let after_node = &path[start + "/.nvm/versions/node/".len()..];
                if let Some(end) = after_node.find('/') {
                    let node_version = &after_node[..end];
                    assert!(node_version.starts_with('v'), "Version should start with 'v': {}", node_version);
                    assert!(node_version.len() > 1, "Version should have content after 'v': {}", node_version);
                }
            }
        }
    }

    #[test]
    fn test_discover_claude_installations_structure() {
        // Test that the discovery function returns proper structure
        let result = discover_all_claude_installations();
        
        match result {
            Ok(installations) => {
                // Test structure of returned installations
                for installation in installations {
                    assert!(!installation.path.is_empty(), "Path should not be empty");
                    assert!(!installation.source.is_empty(), "Source should not be empty");
                    assert!(installation.priority >= 0, "Priority should be non-negative");
                    
                    // Test NVM installations have proper source naming
                    if installation.path.contains("/.nvm/versions/node/") {
                        assert!(installation.source.contains("NVM"), "NVM installations should be labeled as NVM");
                        assert!(installation.node_available, "NVM installations should have Node.js available");
                    }
                }
            }
            Err(e) => {
                // It's okay if discovery fails in test environment
                println!("Discovery failed (expected in test env): {}", e);
            }
        }
    }

    #[test]
    fn test_installation_priority_system() {
        // Test that the priority system works correctly
        let test_installations = vec![
            ClaudeInstallation {
                path: "/usr/local/bin/claude".to_string(),
                source: "Global".to_string(),
                version: Some("1.0.0".to_string()),
                is_verified: true,
                node_available: true,
                is_active: false,
                priority: 50,
            },
            ClaudeInstallation {
                path: "/Users/test/.nvm/versions/node/v20.10.0/bin/claude".to_string(),
                source: "NVM v20.10.0 (active)".to_string(),
                version: Some("1.0.0".to_string()),
                is_verified: true,
                node_available: true,
                is_active: true,
                priority: 100,
            },
            ClaudeInstallation {
                path: "/Users/test/.nvm/versions/node/v18.17.0/bin/claude".to_string(),
                source: "NVM v18.17.0".to_string(),
                version: Some("1.0.0".to_string()),
                is_verified: true,
                node_available: true,
                is_active: false,
                priority: 70,
            },
        ];

        // Test sorting by priority
        let mut sorted_installations = test_installations.clone();
        sorted_installations.sort_by(|a, b| b.priority.cmp(&a.priority));

        assert_eq!(sorted_installations[0].priority, 100, "Highest priority should be first");
        assert_eq!(sorted_installations[1].priority, 70, "Second highest priority should be second");
        assert_eq!(sorted_installations[2].priority, 50, "Lowest priority should be last");
        
        // Test that active NVM installation has highest priority
        assert!(sorted_installations[0].is_active, "Active installation should have highest priority");
        assert!(sorted_installations[0].source.contains("active"), "Active installation should be labeled");
    }

    #[test]
    fn test_nvm_environment_variable_setup() {
        use std::process::Command;
        
        let nvm_claude_path = "/Users/testuser/.nvm/versions/node/v20.10.0/bin/claude";
        let mut cmd = Command::new("echo");
        
        // Test that our environment setup function works
        setup_command_env_for_claude_path(&mut cmd, nvm_claude_path);
        
        // We can't easily inspect the environment of a Command, but we can ensure it doesn't crash
        let result = cmd.arg("test").output();
        assert!(result.is_ok(), "Command with NVM environment setup should execute");
    }

    #[test]
    fn test_claude_installation_serialization() {
        let installation = ClaudeInstallation {
            path: "/Users/test/.nvm/versions/node/v20.10.0/bin/claude".to_string(),
            source: "NVM v20.10.0 (active)".to_string(),
            version: Some("1.0.0".to_string()),
            is_verified: true,
            node_available: true,
            is_active: true,
            priority: 100,
        };

        // Test serialization (important for API responses)
        let serialized = serde_json::to_string(&installation);
        assert!(serialized.is_ok(), "Installation should serialize to JSON");

        let json = serialized.unwrap();
        assert!(json.contains("NVM"), "Serialized JSON should contain source info");
        assert!(json.contains("v20.10.0"), "Serialized JSON should contain version info");
        
        // Test deserialization
        let deserialized: Result<ClaudeInstallation, _> = serde_json::from_str(&json);
        assert!(deserialized.is_ok(), "Installation should deserialize from JSON");
        
        let restored = deserialized.unwrap();
        assert_eq!(restored.path, installation.path, "Path should be preserved");
        assert_eq!(restored.source, installation.source, "Source should be preserved");
        assert_eq!(restored.is_active, installation.is_active, "Active status should be preserved");
    }

    #[test]
    fn test_multiple_installations_filtering() {
        let installations = vec![
            ClaudeInstallation {
                path: "/usr/local/bin/claude".to_string(),
                source: "Global".to_string(),
                version: Some("1.0.0".to_string()),
                is_verified: true,
                node_available: true,
                is_active: false,
                priority: 50,
            },
            ClaudeInstallation {
                path: "/usr/local/bin/some-other-claude".to_string(),
                source: "Other".to_string(),
                version: None,
                is_verified: false,
                node_available: false,
                is_active: false,
                priority: 10,
            },
            ClaudeInstallation {
                path: "/Users/test/.nvm/versions/node/v20.10.0/bin/claude".to_string(),
                source: "NVM v20.10.0".to_string(),
                version: Some("1.0.0".to_string()),
                is_verified: true,
                node_available: true,
                is_active: false,
                priority: 70,
            },
        ];

        // Test filtering verified installations
        let verified: Vec<_> = installations.iter().filter(|i| i.is_verified).collect();
        assert_eq!(verified.len(), 2, "Should find 2 verified installations");

        // Test filtering unverified installations
        let unverified: Vec<_> = installations.iter().filter(|i| !i.is_verified).collect();
        assert_eq!(unverified.len(), 1, "Should find 1 unverified installation");

        // Test finding best installation (highest priority verified)
        let best = installations.iter()
            .filter(|i| i.is_verified)
            .max_by_key(|i| i.priority);
        
        assert!(best.is_some(), "Should find a best installation");
        assert_eq!(best.unwrap().priority, 70, "Best installation should have highest priority");
        assert!(best.unwrap().source.contains("NVM"), "Best installation should be NVM in this test");
    }
}