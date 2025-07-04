use anyhow::Result;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
/// Shared module for detecting Claude Code binary installations
/// Supports NVM installations, aliased paths, and version-based selection
/// Now includes Windows support
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

/// Represents a Claude installation with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeInstallation {
    /// Full path to the Claude binary
    pub path: String,
    /// Version string if available
    pub version: Option<String>,
    /// Source of discovery (e.g., "nvm", "system", "homebrew", "which")
    pub source: String,
}

/// Main function to find the Claude binary
/// Checks database first, then discovers all installations and selects the best one
pub fn find_claude_binary(app_handle: &tauri::AppHandle) -> Result<String, String> {
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

    // Discover all available installations
    let installations = discover_all_installations();

    if installations.is_empty() {
        error!("Could not find claude binary in any location");
        #[cfg(windows)]
        return Err("Claude Code not found. Please ensure it's installed in one of these locations: PATH, C:\\Program Files\\nodejs\\, %APPDATA%\\npm\\, %USERPROFILE%\\AppData\\Roaming\\npm\\, %USERPROFILE%\\.claude\\local, %USERPROFILE%\\.local\\bin".to_string());
        
        #[cfg(not(windows))]
        return Err("Claude Code not found. Please ensure it's installed in one of these locations: PATH, /usr/local/bin, /opt/homebrew/bin, ~/.nvm/versions/node/*/bin, ~/.claude/local, ~/.local/bin".to_string());
    }

    // Log all found installations
    for installation in &installations {
        info!("Found Claude installation: {:?}", installation);
    }

    // Select the best installation (highest version)
    if let Some(best) = select_best_installation(installations) {
        info!(
            "Selected Claude installation: path={}, version={:?}, source={}",
            best.path, best.version, best.source
        );
        Ok(best.path)
    } else {
        Err("No valid Claude installation found".to_string())
    }
}

/// Discovers all available Claude installations and returns them for selection
/// This allows UI to show a version selector
pub fn discover_claude_installations() -> Vec<ClaudeInstallation> {
    info!("Discovering all Claude installations...");

    let installations = discover_all_installations();

    // Sort by version (highest first), then by source preference
    let mut sorted = installations;
    sorted.sort_by(|a, b| {
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

    sorted
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
fn discover_all_installations() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();

    // 1. Try 'which' command first (now works in production)
    if let Some(installation) = try_which_command() {
        installations.push(installation);
    }

    // 2. Check NVM paths
    installations.extend(find_nvm_installations());

    // 3. Check standard paths
    installations.extend(find_standard_installations());

    // Remove duplicates by path
    let mut unique_paths = std::collections::HashSet::new();
    installations.retain(|install| unique_paths.insert(install.path.clone()));

    installations
}

/// Try using the 'which' command (Unix) or 'where' command (Windows) to find Claude
fn try_which_command() -> Option<ClaudeInstallation> {
    #[cfg(windows)]
    {
        debug!("Trying 'where claude' to find binary...");
        match Command::new("where").arg("claude").output() {
            Ok(output) if output.status.success() => {
                let output_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                
                if output_str.is_empty() {
                    return None;
                }

                // Windows 'where' command returns full paths, one per line
                let path = output_str.lines().next()?.to_string();
                
                debug!("'where' found claude at: {}", path);

                // Verify the path exists
                if !PathBuf::from(&path).exists() {
                    warn!("Path from 'where' does not exist: {}", path);
                    return None;
                }

                // Get version
                let version = get_claude_version(&path).ok().flatten();

                Some(ClaudeInstallation {
                    path,
                    version,
                    source: "where".to_string(),
                })
            }
            _ => None,
        }
    }

    #[cfg(not(windows))]
    {
        debug!("Trying 'which claude' to find binary...");

        match Command::new("which").arg("claude").output() {
            Ok(output) if output.status.success() => {
                let output_str = String::from_utf8_lossy(&output.stdout).trim().to_string();

                if output_str.is_empty() {
                    return None;
                }

                // Parse aliased output: "claude: aliased to /path/to/claude"
                let path = if output_str.starts_with("claude:") && output_str.contains("aliased to") {
                    output_str
                        .split("aliased to")
                        .nth(1)
                        .map(|s| s.trim().to_string())
                } else {
                    Some(output_str)
                }?;

                debug!("'which' found claude at: {}", path);

                // Verify the path exists
                if !PathBuf::from(&path).exists() {
                    warn!("Path from 'which' does not exist: {}", path);
                    return None;
                }

                // Get version
                let version = get_claude_version(&path).ok().flatten();

                Some(ClaudeInstallation {
                    path,
                    version,
                    source: "which".to_string(),
                })
            }
            _ => None,
        }
    }
}

/// Find Claude installations in NVM directories
fn find_nvm_installations() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();

    #[cfg(windows)]
    {
        // Check Windows NVM paths
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            // NVM for Windows uses different paths
            let nvm_dir = PathBuf::from(&userprofile).join("AppData").join("Roaming").join("nvm");
            
            debug!("Checking Windows NVM directory: {:?}", nvm_dir);

            if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                        let node_version = entry.file_name().to_string_lossy().to_string();
                        if node_version.starts_with('v') || node_version.chars().next().unwrap_or('x').is_numeric() {
                            let claude_path = entry.path().join("claude.exe");

                            if claude_path.exists() && claude_path.is_file() {
                                let path_str = claude_path.to_string_lossy().to_string();

                                debug!("Found Claude in Windows NVM node {}: {}", node_version, path_str);

                                // Get Claude version
                                let version = get_claude_version(&path_str).ok().flatten();

                                installations.push(ClaudeInstallation {
                                    path: path_str,
                                    version,
                                    source: format!("nvm-windows ({})", node_version),
                                });
                            }
                        }
                    }
                }
            }

            // Also check AppData\Local\nvs for nvs (Node Version Switcher)
            let nvs_dir = PathBuf::from(&userprofile).join("AppData").join("Local").join("nvs");
            
            if nvs_dir.exists() {
                debug!("Checking Windows NVS directory: {:?}", nvs_dir);
                
                if let Ok(entries) = std::fs::read_dir(&nvs_dir) {
                    for entry in entries.flatten() {
                        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                            let version_dir = entry.path();
                            let claude_path = version_dir.join("x64").join("claude.exe");
                            
                            if claude_path.exists() && claude_path.is_file() {
                                let path_str = claude_path.to_string_lossy().to_string();
                                let node_version = entry.file_name().to_string_lossy().to_string();

                                debug!("Found Claude in NVS node {}: {}", node_version, path_str);

                                let version = get_claude_version(&path_str).ok().flatten();

                                installations.push(ClaudeInstallation {
                                    path: path_str,
                                    version,
                                    source: format!("nvs ({})", node_version),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        if let Ok(home) = std::env::var("HOME") {
            let nvm_dir = PathBuf::from(&home)
                .join(".nvm")
                .join("versions")
                .join("node");

            debug!("Checking NVM directory: {:?}", nvm_dir);

            if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                        let claude_path = entry.path().join("bin").join("claude");

                        if claude_path.exists() && claude_path.is_file() {
                            let path_str = claude_path.to_string_lossy().to_string();
                            let node_version = entry.file_name().to_string_lossy().to_string();

                            debug!("Found Claude in NVM node {}: {}", node_version, path_str);

                            // Get Claude version
                            let version = get_claude_version(&path_str).ok().flatten();

                            installations.push(ClaudeInstallation {
                                path: path_str,
                                version,
                                source: format!("nvm ({})", node_version),
                            });
                        }
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

    #[cfg(windows)]
    {
        // Windows-specific paths
        let mut paths_to_check: Vec<(String, String)> = vec![
            ("C:\\Program Files\\nodejs\\claude.exe".to_string(), "nodejs-global".to_string()),
            ("C:\\Program Files (x86)\\nodejs\\claude.exe".to_string(), "nodejs-global-x86".to_string()),
        ];

        // Check user-specific paths
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            paths_to_check.extend(vec![
                (
                    format!("{}\\AppData\\Roaming\\npm\\claude.exe", userprofile),
                    "npm-global".to_string(),
                ),
                (
                    format!("{}\\AppData\\Roaming\\npm\\claude.cmd", userprofile),
                    "npm-global-cmd".to_string(),
                ),
                (
                    format!("{}\\.claude\\local\\claude.exe", userprofile),
                    "claude-local".to_string(),
                ),
                (
                    format!("{}\\.local\\bin\\claude.exe", userprofile),
                    "local-bin".to_string(),
                ),
                (
                    format!("{}\\scoop\\apps\\nodejs\\current\\claude.exe", userprofile),
                    "scoop".to_string(),
                ),
                (
                    format!("{}\\scoop\\shims\\claude.exe", userprofile),
                    "scoop-shims".to_string(),
                ),
            ]);
        }

        if let Ok(appdata) = std::env::var("APPDATA") {
            paths_to_check.extend(vec![
                (
                    format!("{}\\npm\\claude.exe", appdata),
                    "appdata-npm".to_string(),
                ),
                (
                    format!("{}\\npm\\claude.cmd", appdata),
                    "appdata-npm-cmd".to_string(),
                ),
            ]);
        }

        // Check Program Files
        if let Ok(programfiles) = std::env::var("ProgramFiles") {
            paths_to_check.push((
                format!("{}\\nodejs\\claude.exe", programfiles),
                "programfiles-nodejs".to_string(),
            ));
        }

        if let Ok(programfiles_x86) = std::env::var("ProgramFiles(x86)") {
            paths_to_check.push((
                format!("{}\\nodejs\\claude.exe", programfiles_x86),
                "programfiles-x86-nodejs".to_string(),
            ));
        }

        // Check each path
        for (path, source) in paths_to_check {
            let path_buf = PathBuf::from(&path);
            if path_buf.exists() && path_buf.is_file() {
                debug!("Found claude at Windows path: {} ({})", path, source);

                // Get version
                let version = get_claude_version(&path).ok().flatten();

                installations.push(ClaudeInstallation {
                    path,
                    version,
                    source,
                });
            }
        }

        // Also check if claude is available in PATH (without full path)
        if let Ok(output) = Command::new("claude").arg("--version").output() {
            if output.status.success() {
                debug!("claude is available in Windows PATH");
                let version = extract_version_from_output(&output.stdout);

                installations.push(ClaudeInstallation {
                    path: "claude".to_string(),
                    version,
                    source: "PATH".to_string(),
                });
            }
        }
    }

    #[cfg(not(windows))]
    {
        // Common installation paths for claude on Unix/Linux
        let mut paths_to_check: Vec<(String, String)> = vec![
            ("/usr/local/bin/claude".to_string(), "system".to_string()),
            (
                "/opt/homebrew/bin/claude".to_string(),
                "homebrew".to_string(),
            ),
            ("/usr/bin/claude".to_string(), "system".to_string()),
            ("/bin/claude".to_string(), "system".to_string()),
        ];

        // Also check user-specific paths
        if let Ok(home) = std::env::var("HOME") {
            paths_to_check.extend(vec![
                (
                    format!("{}/.claude/local/claude", home),
                    "claude-local".to_string(),
                ),
                (
                    format!("{}/.local/bin/claude", home),
                    "local-bin".to_string(),
                ),
                (
                    format!("{}/.npm-global/bin/claude", home),
                    "npm-global".to_string(),
                ),
                (format!("{}/.yarn/bin/claude", home), "yarn".to_string()),
                (format!("{}/.bun/bin/claude", home), "bun".to_string()),
                (format!("{}/bin/claude", home), "home-bin".to_string()),
                // Check common node_modules locations
                (
                    format!("{}/node_modules/.bin/claude", home),
                    "node-modules".to_string(),
                ),
                (
                    format!("{}/.config/yarn/global/node_modules/.bin/claude", home),
                    "yarn-global".to_string(),
                ),
            ]);
        }

        // Check each path
        for (path, source) in paths_to_check {
            let path_buf = PathBuf::from(&path);
            if path_buf.exists() && path_buf.is_file() {
                debug!("Found claude at standard path: {} ({})", path, source);

                // Get version
                let version = get_claude_version(&path).ok().flatten();

                installations.push(ClaudeInstallation {
                    path,
                    version,
                    source,
                });
            }
        }

        // Also check if claude is available in PATH (without full path)
        if let Ok(output) = Command::new("claude").arg("--version").output() {
            if output.status.success() {
                debug!("claude is available in PATH");
                let version = extract_version_from_output(&output.stdout);

                installations.push(ClaudeInstallation {
                    path: "claude".to_string(),
                    version,
                    source: "PATH".to_string(),
                });
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

/// Extract version string from command output
fn extract_version_from_output(stdout: &[u8]) -> Option<String> {
    let output_str = String::from_utf8_lossy(stdout);

    // Extract version: first token before whitespace that looks like a version
    output_str
        .split_whitespace()
        .find(|token| {
            // Version usually contains dots and numbers
            token.chars().any(|c| c == '.') && token.chars().any(|c| c.is_numeric())
        })
        .map(|s| s.to_string())
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

    // Inherit essential environment variables from parent process
    for (key, value) in std::env::vars() {
        // Pass through PATH and other essential environment variables
        #[cfg(windows)]
        {
            if key == "PATH"
                || key == "USERPROFILE"
                || key == "APPDATA"
                || key == "LOCALAPPDATA"
                || key == "ProgramFiles"
                || key == "ProgramFiles(x86)"
                || key == "SystemRoot"
                || key == "TEMP"
                || key == "TMP"
                || key == "USERNAME"
                || key == "COMPUTERNAME"
                || key == "NODE_PATH"
            {
                debug!("Inheriting Windows env var: {}={}", key, value);
                cmd.env(&key, &value);
            }
        }

        #[cfg(not(windows))]
        {
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
            {
                debug!("Inheriting env var: {}={}", key, value);
                cmd.env(&key, &value);
            }
        }
    }

    // Add NVM support if the program is in an NVM directory
    #[cfg(windows)]
    {
        if program.contains("\\AppData\\Roaming\\nvm\\") || program.contains("\\AppData\\Local\\nvs\\") {
            if let Some(node_bin_dir) = std::path::Path::new(program).parent() {
                // Ensure the Node.js bin directory is in PATH
                let current_path = std::env::var("PATH").unwrap_or_default();
                let node_bin_str = node_bin_dir.to_string_lossy();
                if !current_path.contains(&node_bin_str.as_ref()) {
                    let new_path = format!("{};{}", node_bin_str, current_path);
                    debug!("Adding Windows NVM bin directory to PATH: {}", node_bin_str);
                    cmd.env("PATH", new_path);
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        if program.contains("/.nvm/versions/node/") {
            if let Some(node_bin_dir) = std::path::Path::new(program).parent() {
                // Ensure the Node.js bin directory is in PATH
                let current_path = std::env::var("PATH").unwrap_or_default();
                let node_bin_str = node_bin_dir.to_string_lossy();
                if !current_path.contains(&node_bin_str.as_ref()) {
                    let new_path = format!("{}:{}", node_bin_str, current_path);
                    debug!("Adding NVM bin directory to PATH: {}", node_bin_str);
                    cmd.env("PATH", new_path);
                }
            }
        }
    }

    cmd
}
