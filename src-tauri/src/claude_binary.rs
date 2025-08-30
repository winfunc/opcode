use anyhow::Result;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
/// Shared module for detecting Claude Code binary installations
/// Supports NVM installations, aliased paths, and version-based selection
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

/// Type of Claude installation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InstallationType {
    /// System-installed binary
    System,
    /// Custom path specified by user
    Custom,
}

/// Command type for Claude installations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CommandType {
    /// Standard claude command
    Claude,
    /// CCR (Cursor) command requiring "code" argument
    CCR,
}

/// Represents a Claude installation with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeInstallation {
    /// Full path to the Claude binary
    pub path: String,
    /// Version string if available
    pub version: Option<String>,
    /// Source of discovery (e.g., "nvm", "system", "homebrew", "which")
    pub source: String,
    /// Type of installation
    pub installation_type: InstallationType,
    /// Command type (claude or ccr)
    pub command_type: CommandType,
}

/// Find the best Claude installation and return its information
/// This is the new preferred function that returns full installation details
pub fn find_claude_installation(app_handle: &tauri::AppHandle) -> Result<ClaudeInstallation, String> {
    info!("Searching for claude installation...");

    // First check if we have a stored path and preference in the database
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        let db_path = app_data_dir.join("agents.db");
        if db_path.exists() {
            if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                // Check for stored path first
                if let Ok(stored_path) = conn.query_row(
                    "SELECT value FROM app_settings WHERE key = 'claude_binary_path'",
                    [],
                    |row| row.get::<_, String>(0),
                ) {
                    info!("Found stored claude path in database: {}", stored_path);
                    
                    // Check if the path still exists
                    let path_buf = PathBuf::from(&stored_path);
                    if path_buf.exists() && path_buf.is_file() {
                        // Determine command type from path
                        let command_type = if stored_path.contains("ccr") {
                            CommandType::CCR
                        } else {
                            CommandType::Claude
                        };

                        // Get version
                        let version = match command_type {
                            CommandType::Claude => get_claude_version(&stored_path).ok().flatten(),
                            CommandType::CCR => get_ccr_version(&stored_path).ok().flatten(),
                        };

                        return Ok(ClaudeInstallation {
                            path: stored_path,
                            version,
                            source: "database".to_string(),
                            installation_type: InstallationType::Custom,
                            command_type,
                        });
                    } else {
                        warn!("Stored claude path no longer exists: {}", stored_path);
                    }
                }
            }
        }
    }

    // Discover all available system installations
    let installations = discover_system_installations();

    if installations.is_empty() {
        error!("Could not find claude binary in any location");
        let error_msg = if cfg!(target_os = "windows") {
            "Claude Code not found. Please ensure it's installed and accessible. Common locations on Windows:\n\
            • In system PATH (try 'claude --version' in Command Prompt)\n\
            • %APPDATA%\\npm\\claude.cmd (npm global install)\n\
            • %USERPROFILE%\\AppData\\Roaming\\npm\\claude.cmd\n\
            • Check if npm global modules are in your system PATH\n\n\
            If you installed Claude Code via npm, ensure npm global bin directory is in PATH:\n\
            Run 'npm config get prefix' to see your npm global path.".to_string()
        } else {
            "Claude Code not found. Please ensure it's installed in one of these locations: PATH, /usr/local/bin, /opt/homebrew/bin, ~/.nvm/versions/node/*/bin, ~/.claude/local, ~/.local/bin".to_string()
        };
        return Err(error_msg);
    }

    // Log all found installations
    for installation in &installations {
        info!("Found installation: {:?}", installation);
    }

    // Select the best installation (highest version)
    if let Some(best) = select_best_installation(installations) {
        info!(
            "Selected installation: path={}, version={:?}, source={}, command_type={:?}",
            best.path, best.version, best.source, best.command_type
        );
        Ok(best)
    } else {
        Err("No valid Claude installation found".to_string())
    }
}

/// Main function to find the Claude binary (backward compatibility)
/// Checks database first for stored path and preference, then prioritizes accordingly
pub fn find_claude_binary(app_handle: &tauri::AppHandle) -> Result<String, String> {
    find_claude_installation(app_handle).map(|installation| installation.path)
}

/// Discovers all available Claude installations and returns them for selection
/// This allows UI to show a version selector
pub fn discover_claude_installations() -> Vec<ClaudeInstallation> {
    info!("Discovering all Claude installations...");
    
    // Log OS and environment info for debugging
    info!("Operating System: {}", std::env::consts::OS);
    if let Some(home) = dirs::home_dir() {
        info!("Home directory: {:?}", home);
    }
    if let Ok(path) = std::env::var("PATH") {
        info!("PATH environment variable length: {} chars", path.len());
        // On Windows, log first few PATH entries for debugging
        if cfg!(target_os = "windows") {
            let paths: Vec<&str> = path.split(';').take(5).collect();
            info!("First 5 PATH entries: {:?}", paths);
        }
    }

    let mut installations = discover_system_installations();

    // Sort by version (highest first), then by source preference
    installations.sort_by(|a, b| {
        match (&a.version, &b.version) {
            (Some(v1), Some(v2)) => {
                // Compare versions in descending order (newest first)
                match compare_versions(v2, v1) {
                    Ordering::Equal => {
                        // If versions are equal, prefer by source
                        source_preference(a).cmp(&source_preference(b))
                    }
                    other => other,
                }
            }
            (Some(_), None) => Ordering::Less, // Version comes before no version
            (None, Some(_)) => Ordering::Greater,
            (None, None) => source_preference(a).cmp(&source_preference(b)),
        }
    });

    installations
}

/// Returns a preference score for installation sources (lower is better)
fn source_preference(installation: &ClaudeInstallation) -> u8 {
    match installation.source.as_str() {
        "which" => 1,
        "homebrew" => 2,
        "system" => 3,
        source if source.starts_with("nvm") => 4,
        "local-bin" => 5,
        "claude-local" => 6,
        "npm-global" => 7,
        "yarn" | "yarn-global" => 8,
        "bun" => 9,
        "node-modules" => 10,
        "home-bin" => 11,
        "PATH" => 12,
        _ => 13,
    }
}

/// Discovers all Claude installations on the system
fn discover_system_installations() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();
    info!("Starting system-wide Claude installation discovery");

    // 1. Try 'which' command first (now works in production)
    debug!("Trying 'which' command to find Claude and CCR");
    let which_installations = try_which_command();
    if which_installations.is_empty() {
        debug!("'which' command did not find Claude or CCR");
    } else {
        info!("Found {} installations via 'which': {:?}", which_installations.len(), which_installations);
        installations.extend(which_installations);
    }

    // 2. Check NVM paths
    debug!("Checking NVM installations");
    let nvm_installations = find_nvm_installations();
    if nvm_installations.is_empty() {
        debug!("No NVM Claude installations found");
    } else {
        info!("Found {} NVM Claude installations", nvm_installations.len());
    }
    installations.extend(nvm_installations);

    // 3. Check standard paths
    debug!("Checking standard installation paths");
    let standard_installations = find_standard_installations();
    if standard_installations.is_empty() {
        debug!("No standard Claude installations found");
    } else {
        info!("Found {} standard Claude installations", standard_installations.len());
    }
    installations.extend(standard_installations);

    info!("Total Claude installations found before deduplication: {}", installations.len());

    // Remove duplicates by path
    let mut unique_paths = std::collections::HashSet::new();
    installations.retain(|install| {
        let is_new = unique_paths.insert(install.path.clone());
        if !is_new {
            debug!("Removing duplicate installation: {}", install.path);
        }
        is_new
    });
    
    info!("Final unique Claude installations found: {}", installations.len());
    for installation in &installations {
        info!("  - {} (source: {}, version: {:?})", installation.path, installation.source, installation.version);
    }

    installations
}

/// Try using the 'which' command to find Claude and CCR
fn try_which_command() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();
    
    // Try to find 'claude' command
    debug!("Trying 'which claude' to find binary...");
    if let Some(installation) = try_which_for_binary("claude", CommandType::Claude) {
        installations.push(installation);
    }
    
    // Try to find 'ccr' command
    debug!("Trying 'which ccr' to find binary...");
    if let Some(installation) = try_which_for_binary("ccr", CommandType::CCR) {
        installations.push(installation);
    }
    
    installations
}

/// Helper function to find a specific binary using 'which'
fn try_which_for_binary(binary_name: &str, command_type: CommandType) -> Option<ClaudeInstallation> {
    match Command::new("which").arg(binary_name).output() {
        Ok(output) if output.status.success() => {
            let output_str = String::from_utf8_lossy(&output.stdout).trim().to_string();

            if output_str.is_empty() {
                return None;
            }

            // Parse aliased output: "binary: aliased to /path/to/binary"
            let path = if output_str.starts_with(&format!("{}:", binary_name)) && output_str.contains("aliased to") {
                output_str
                    .split("aliased to")
                    .nth(1)
                    .map(|s| s.trim().to_string())
            } else {
                Some(output_str)
            }?;

            debug!("'which' found {} at: {}", binary_name, path);

            // Verify the path exists
            if !PathBuf::from(&path).exists() {
                warn!("Path from 'which' does not exist: {}", path);
                return None;
            }

            // Get version based on command type
            let version = match command_type {
                CommandType::Claude => get_claude_version(&path).ok().flatten(),
                CommandType::CCR => get_ccr_version(&path).ok().flatten(),
            };

            Some(ClaudeInstallation {
                path,
                version,
                source: "which".to_string(),
                installation_type: InstallationType::System,
                command_type,
            })
        }
        _ => None,
    }
}

/// Find Claude installations in NVM directories
fn find_nvm_installations() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();

    // Use dirs::home_dir() for cross-platform home directory detection
    if let Some(home) = dirs::home_dir() {
        let nvm_dir = PathBuf::from(&home)
            .join(".nvm")
            .join("versions")
            .join("node");

        debug!("Checking NVM directory: {:?}", nvm_dir);

        if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    let bin_dir = entry.path().join("bin");
                    let node_version = entry.file_name().to_string_lossy().to_string();

                    // Check for claude
                    let claude_path = bin_dir.join("claude");
                    if claude_path.exists() && claude_path.is_file() {
                        let path_str = claude_path.to_string_lossy().to_string();
                        debug!("Found Claude in NVM node {}: {}", node_version, path_str);

                        let version = get_claude_version(&path_str).ok().flatten();
                        installations.push(ClaudeInstallation {
                            path: path_str,
                            version,
                            source: format!("nvm ({})", node_version),
                            installation_type: InstallationType::System,
                            command_type: CommandType::Claude,
                        });
                    }

                    // Check for ccr
                    let ccr_path = bin_dir.join("ccr");
                    if ccr_path.exists() && ccr_path.is_file() {
                        let path_str = ccr_path.to_string_lossy().to_string();
                        debug!("Found CCR in NVM node {}: {}", node_version, path_str);

                        let version = get_ccr_version(&path_str).ok().flatten();
                        installations.push(ClaudeInstallation {
                            path: path_str,
                            version,
                            source: format!("nvm ({})", node_version),
                            installation_type: InstallationType::System,
                            command_type: CommandType::CCR,
                        });
                    }
                }
            }
        }
    }

    installations
}

/// Check standard installation paths
fn find_standard_installations() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();

    // Define common directory paths to check
    let mut directories_to_check: Vec<(PathBuf, String)> = vec![
        (PathBuf::from("/usr/local/bin"), "system".to_string()),
        (PathBuf::from("/opt/homebrew/bin"), "homebrew".to_string()),
        (PathBuf::from("/usr/bin"), "system".to_string()),
        (PathBuf::from("/bin"), "system".to_string()),
    ];

    // Also check user-specific paths
    if let Some(home) = dirs::home_dir() {
        directories_to_check.extend(vec![
            (home.join(".claude").join("local"), "claude-local".to_string()),
            (home.join(".local").join("bin"), "local-bin".to_string()),
            (home.join(".npm-global").join("bin"), "npm-global".to_string()),
            (home.join(".yarn").join("bin"), "yarn".to_string()),
            (home.join(".bun").join("bin"), "bun".to_string()),
            (home.join("bin"), "home-bin".to_string()),
            (home.join("node_modules").join(".bin"), "node-modules".to_string()),
            (home.join(".config").join("yarn").join("global").join("node_modules").join(".bin"), "yarn-global".to_string()),
        ]);
        
        // Windows-specific paths
        if cfg!(target_os = "windows") {
            debug!("Adding Windows-specific paths");
            
            // Check APPDATA npm global path
            if let Ok(appdata) = std::env::var("APPDATA") {
                directories_to_check.push((
                    PathBuf::from(appdata).join("npm"),
                    "npm-global-appdata".to_string(),
                ));
            }
            
            // Check npm prefix path from npm config
            if let Ok(output) = std::process::Command::new("npm")
                .args(["config", "get", "prefix"])
                .output() {
                if output.status.success() {
                    let npm_prefix_raw = String::from_utf8_lossy(&output.stdout);
                    let npm_prefix = npm_prefix_raw.trim();
                    if !npm_prefix.is_empty() {
                        directories_to_check.push((
                            PathBuf::from(npm_prefix),
                            "npm-prefix".to_string(),
                        ));
                    }
                }
            }
            
            directories_to_check.push((home.join("AppData").join("Roaming").join("npm"), "npm-roaming".to_string()));
        }
    }

    // For each directory, check for both claude and ccr binaries
    for (dir_path, source) in directories_to_check {
        // Check for claude
        let claude_path = if cfg!(target_os = "windows") {
            dir_path.join("claude.cmd")
        } else {
            dir_path.join("claude")
        };
        
        if claude_path.exists() && claude_path.is_file() {
            let path_str = claude_path.to_string_lossy().to_string();
            debug!("Found claude at standard path: {} ({})", path_str, source);

            let version = get_claude_version(&path_str).ok().flatten();
            installations.push(ClaudeInstallation {
                path: path_str,
                version,
                source: source.clone(),
                installation_type: InstallationType::System,
                command_type: CommandType::Claude,
            });
        }

        // Check for ccr
        let ccr_path = if cfg!(target_os = "windows") {
            dir_path.join("ccr.cmd")
        } else {
            dir_path.join("ccr")
        };
        
        if ccr_path.exists() && ccr_path.is_file() {
            let path_str = ccr_path.to_string_lossy().to_string();
            debug!("Found ccr at standard path: {} ({})", path_str, source);

            let version = get_ccr_version(&path_str).ok().flatten();
            installations.push(ClaudeInstallation {
                path: path_str,
                version,
                source: source.clone(),
                installation_type: InstallationType::System,
                command_type: CommandType::CCR,
            });
        }
    }

    // Also check if binaries are available in PATH (without full path)
    // Try both 'claude' and 'claude.cmd' for Windows compatibility
    let claude_commands = if cfg!(target_os = "windows") {
        vec!["claude", "claude.cmd"]
    } else {
        vec!["claude"]
    };
    
    let mut found_claude_in_path = false;
    for cmd in claude_commands {
        if !found_claude_in_path {
            if let Ok(output) = Command::new(cmd).arg("--version").output() {
                if output.status.success() {
                    debug!("{} is available in PATH", cmd);
                    let version = extract_version_from_output(&output.stdout);

                    installations.push(ClaudeInstallation {
                        path: cmd.to_string(),
                        version,
                        source: "PATH".to_string(),
                        installation_type: InstallationType::System,
                        command_type: CommandType::Claude,
                    });
                    found_claude_in_path = true;
                }
            }
        }
    }

    // Check for ccr in PATH
    let ccr_commands = if cfg!(target_os = "windows") {
        vec!["ccr", "ccr.cmd"]
    } else {
        vec!["ccr"]
    };
    
    let mut found_ccr_in_path = false;
    for cmd in ccr_commands {
        if !found_ccr_in_path {
            // For CCR, we need to check if 'ccr code --version' works to get Claude version
            if let Ok(output) = Command::new(cmd).args(["code", "--version"]).output() {
                if output.status.success() {
                    debug!("{} code is available in PATH", cmd);
                    let version = extract_version_from_output(&output.stdout);

                    installations.push(ClaudeInstallation {
                        path: cmd.to_string(),
                        version,
                        source: "PATH".to_string(),
                        installation_type: InstallationType::System,
                        command_type: CommandType::CCR,
                    });
                    found_ccr_in_path = true;
                }
            } else {
                // If 'ccr code' doesn't work, check if ccr itself exists but may not support Claude
                if let Ok(output) = Command::new(cmd).arg("--version").output() {
                    if output.status.success() {
                        debug!("{} is available in PATH but may not support Claude Code", cmd);
                        // Still add it but without version info, user can try to use it
                        installations.push(ClaudeInstallation {
                            path: cmd.to_string(),
                            version: None,
                            source: "PATH".to_string(),
                            installation_type: InstallationType::System,
                            command_type: CommandType::CCR,
                        });
                        found_ccr_in_path = true;
                    }
                }
            }
        }
    }

    installations
}

/// Get Claude version by running --version command
fn get_claude_version(path: &str) -> Result<Option<String>, String> {
    match Command::new(path).arg("--version").output() {
        Ok(output) => {
            if output.status.success() {
                Ok(extract_version_from_output(&output.stdout))
            } else {
                Ok(None)
            }
        }
        Err(e) => {
            warn!("Failed to get version for {}: {}", path, e);
            Ok(None)
        }
    }
}

/// Get CCR version by running 'ccr code --version' command
/// Since ccr code is essentially Claude, we need to get the Claude version through ccr
fn get_ccr_version(path: &str) -> Result<Option<String>, String> {
    match Command::new(path).args(["code", "--version"]).output() {
        Ok(output) => {
            if output.status.success() {
                Ok(extract_version_from_output(&output.stdout))
            } else {
                // If 'ccr code --version' fails, try just 'ccr --version' to see if ccr itself is working
                match Command::new(path).arg("--version").output() {
                    Ok(fallback_output) if fallback_output.status.success() => {
                        debug!("ccr code --version failed but ccr --version worked, ccr may not support Claude");
                        Ok(None) // CCR exists but doesn't support Claude
                    }
                    _ => Ok(None)
                }
            }
        }
        Err(e) => {
            warn!("Failed to get CCR version for {}: {}", path, e);
            Ok(None)
        }
    }
}

/// Extract version string from command output
fn extract_version_from_output(stdout: &[u8]) -> Option<String> {
    let output_str = String::from_utf8_lossy(stdout);
    
    // Debug log the raw output
    debug!("Raw version output: {:?}", output_str);
    
    // Use regex to directly extract version pattern (e.g., "1.0.41")
    // This pattern matches:
    // - One or more digits, followed by
    // - A dot, followed by
    // - One or more digits, followed by
    // - A dot, followed by
    // - One or more digits
    // - Optionally followed by pre-release/build metadata
    let version_regex = regex::Regex::new(r"(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?)").ok()?;
    
    if let Some(captures) = version_regex.captures(&output_str) {
        if let Some(version_match) = captures.get(1) {
            let version = version_match.as_str().to_string();
            debug!("Extracted version: {:?}", version);
            return Some(version);
        }
    }
    
    debug!("No version found in output");
    None
}

/// Select the best installation based on version
fn select_best_installation(installations: Vec<ClaudeInstallation>) -> Option<ClaudeInstallation> {
    // In production builds, version information may not be retrievable because
    // spawning external processes can be restricted. We therefore no longer
    // discard installations that lack a detected version – the mere presence
    // of a readable binary on disk is enough to consider it valid. We still
    // prefer binaries with version information when it is available so that
    // in development builds we keep the previous behaviour of picking the
    // most recent version.
    installations.into_iter().max_by(|a, b| {
        match (&a.version, &b.version) {
            // If both have versions, compare them semantically.
            (Some(v1), Some(v2)) => compare_versions(v1, v2),
            // Prefer the entry that actually has version information.
            (Some(_), None) => Ordering::Greater,
            (None, Some(_)) => Ordering::Less,
            // Neither have version info: prefer the one that is not just
            // the bare "claude" lookup from PATH, because that may fail
            // at runtime if PATH is modified.
            (None, None) => {
                if a.path == "claude" && b.path != "claude" {
                    Ordering::Less
                } else if a.path != "claude" && b.path == "claude" {
                    Ordering::Greater
                } else {
                    Ordering::Equal
                }
            }
        }
    })
}

/// Compare two version strings
fn compare_versions(a: &str, b: &str) -> Ordering {
    // Simple semantic version comparison
    let a_parts: Vec<u32> = a
        .split('.')
        .filter_map(|s| {
            // Handle versions like "1.0.17-beta" by taking only numeric part
            s.chars()
                .take_while(|c| c.is_numeric())
                .collect::<String>()
                .parse()
                .ok()
        })
        .collect();

    let b_parts: Vec<u32> = b
        .split('.')
        .filter_map(|s| {
            s.chars()
                .take_while(|c| c.is_numeric())
                .collect::<String>()
                .parse()
                .ok()
        })
        .collect();

    // Compare each part
    for i in 0..std::cmp::max(a_parts.len(), b_parts.len()) {
        let a_val = a_parts.get(i).unwrap_or(&0);
        let b_val = b_parts.get(i).unwrap_or(&0);
        match a_val.cmp(b_val) {
            Ordering::Equal => continue,
            other => return other,
        }
    }

    Ordering::Equal
}

/// Helper function to create a Command with proper environment variables
/// This ensures commands like Claude can find Node.js and other dependencies
pub fn create_command_with_env(program: &str) -> Command {
    let mut cmd = Command::new(program);
    
    info!("Creating command for: {}", program);

    // Inherit essential environment variables from parent process
    for (key, value) in std::env::vars() {
        // Pass through PATH and other essential environment variables
        if key == "PATH"
            || key == "HOME"
            || key == "USER"
            || key == "SHELL"
            || key == "LANG"
            || key == "LC_ALL"
            || key.starts_with("LC_")
            || key == "NODE_PATH"
            || key == "NVM_DIR"
            || key == "NVM_BIN"
            || key == "HOMEBREW_PREFIX"
            || key == "HOMEBREW_CELLAR"
            // Add proxy environment variables (only uppercase)
            || key == "HTTP_PROXY"
            || key == "HTTPS_PROXY"
            || key == "NO_PROXY"
            || key == "ALL_PROXY"
        {
            debug!("Inheriting env var: {}={}", key, value);
            cmd.env(&key, &value);
        }
    }
    
    // Log proxy-related environment variables for debugging
    info!("Command will use proxy settings:");
    if let Ok(http_proxy) = std::env::var("HTTP_PROXY") {
        info!("  HTTP_PROXY={}", http_proxy);
    }
    if let Ok(https_proxy) = std::env::var("HTTPS_PROXY") {
        info!("  HTTPS_PROXY={}", https_proxy);
    }

    // Path separator based on OS
    let path_separator = if cfg!(target_os = "windows") { ";" } else { ":" };
    
    // Add NVM support if the program is in an NVM directory
    if program.contains("/.nvm/versions/node/") {
        if let Some(node_bin_dir) = std::path::Path::new(program).parent() {
            // Ensure the Node.js bin directory is in PATH
            let current_path = std::env::var("PATH").unwrap_or_default();
            let node_bin_str = node_bin_dir.to_string_lossy();
            if !current_path.contains(&node_bin_str.as_ref()) {
                let new_path = format!("{}{}{}", node_bin_str, path_separator, current_path);
                debug!("Adding NVM bin directory to PATH: {}", node_bin_str);
                cmd.env("PATH", new_path);
            }
        }
    }
    
    // Add Homebrew support if the program is in a Homebrew directory
    if program.contains("/homebrew/") || program.contains("/opt/homebrew/") {
        if let Some(program_dir) = std::path::Path::new(program).parent() {
            // Ensure the Homebrew bin directory is in PATH
            let current_path = std::env::var("PATH").unwrap_or_default();
            let homebrew_bin_str = program_dir.to_string_lossy();
            if !current_path.contains(&homebrew_bin_str.as_ref()) {
                let new_path = format!("{}{}{}", homebrew_bin_str, path_separator, current_path);
                debug!("Adding Homebrew bin directory to PATH: {}", homebrew_bin_str);
                cmd.env("PATH", new_path);
            }
        }
    }

    cmd
}
