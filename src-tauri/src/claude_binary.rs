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
    /// Bundled sidecar binary
    Bundled,
    /// System-installed binary
    System,
    /// Custom path specified by user
    Custom,
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
}

/// Main function to find the Claude binary
/// Checks database first for stored path and preference, then prioritizes accordingly
pub fn find_claude_binary(app_handle: &tauri::AppHandle) -> Result<String, String> {
    info!("Searching for claude binary...");

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

                    // If it's a sidecar reference, return it directly
                    if stored_path == "claude-code" {
                        info!("Using bundled sidecar as configured");
                        return Ok(stored_path);
                    }

                    // Otherwise check if the path still exists
                    let path_buf = PathBuf::from(&stored_path);
                    if path_buf.exists() && path_buf.is_file() {
                        return Ok(stored_path);
                    } else {
                        warn!("Stored claude path no longer exists: {}", stored_path);
                    }
                }

                // Check user preference
                let preference = conn.query_row(
                    "SELECT value FROM app_settings WHERE key = 'claude_installation_preference'",
                    [],
                    |row| row.get::<_, String>(0),
                ).unwrap_or_else(|_| "system".to_string());

                info!("User preference for Claude installation: {}", preference);
            }
        }
    }

    // Discover all available system installations
    let installations = discover_system_installations();

    if installations.is_empty() {
        error!("Could not find claude binary in any location");
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
        "bundled" => 0, // Bundled sidecar has highest preference
        "which" | "where" => 1, // Both which (Unix) and where (Windows) have same priority
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

    // 1. Check for bundled sidecar first (highest priority)
    if let Some(installation) = find_bundled_installation() {
        installations.push(installation);
    }

    // 2. Try 'which' command (now works in production)
    if let Some(installation) = try_which_command() {
        installations.push(installation);
    }

    // 3. Check NVM paths
    installations.extend(find_nvm_installations());

    // 4. Check standard paths
    installations.extend(find_standard_installations());

    // Remove duplicates by path
    let mut unique_paths = std::collections::HashSet::new();
    installations.retain(|install| unique_paths.insert(install.path.clone()));

    installations
}

/// Find bundled sidecar installation
fn find_bundled_installation() -> Option<ClaudeInstallation> {
    // The bundled sidecar is referenced by the special identifier "claude-code"
    // This will be resolved by Tauri's sidecar system at runtime
    Some(ClaudeInstallation {
        path: "claude-code".to_string(),
        version: None, // Version will be determined at runtime
        source: "bundled".to_string(),
        installation_type: InstallationType::Bundled,
    })
}

/// Try using the 'which' command to find Claude (or 'where' on Windows)
fn try_which_command() -> Option<ClaudeInstallation> {
    // Use 'where' on Windows, 'which' on Unix-like systems
    let (command, arg) = if cfg!(target_os = "windows") {
        ("where", "claude")
    } else {
        ("which", "claude")
    };

    debug!("Trying '{} claude' to find binary...", command);

    let mut cmd = Command::new(command);
    cmd.arg(arg);
    
    // On Windows, hide the console window to prevent CMD popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    match cmd.output() {
        Ok(output) if output.status.success() => {
            let output_str = String::from_utf8_lossy(&output.stdout).trim().to_string();

            if output_str.is_empty() {
                return None;
            }

            // Parse output based on the command used
            let path = if cfg!(target_os = "windows") {
                // On Windows, 'where' command returns full paths, potentially multiple lines
                // Prefer .cmd, .bat, or .exe files over files without extensions
                let mut best_path = None;
                for line in output_str.lines() {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    // Check if this path has a valid Windows executable extension
                    let path_buf = PathBuf::from(trimmed);
                    if let Some(extension) = path_buf.extension() {
                        let ext = extension.to_string_lossy().to_lowercase();
                        if ext == "cmd" || ext == "bat" || ext == "exe" {
                            best_path = Some(trimmed.to_string());
                            break; // Prefer the first executable file found
                        }
                    }

                    // If no executable extension found yet, keep the first path as fallback
                    if best_path.is_none() {
                        best_path = Some(trimmed.to_string());
                    }
                }
                best_path
            } else {
                // Parse aliased output on Unix: "claude: aliased to /path/to/claude"
                if output_str.starts_with("claude:") && output_str.contains("aliased to") {
                    output_str
                        .split("aliased to")
                        .nth(1)
                        .map(|s| s.trim().to_string())
                } else {
                    Some(output_str)
                }
            }?;

            debug!("'{}' found claude at: {}", command, path);

            // Verify the path exists
            if !PathBuf::from(&path).exists() {
                warn!("Path from '{}' does not exist: {}", command, path);
                return None;
            }

            // Get version
            let version = get_claude_version(&path).ok().flatten();

            Some(ClaudeInstallation {
                path,
                version,
                source: if cfg!(target_os = "windows") { "where".to_string() } else { "which".to_string() },
                installation_type: InstallationType::System,
            })
        }
        _ => None,
    }
}

/// Find Claude installations in NVM directories
fn find_nvm_installations() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();

    let home_var = if cfg!(target_os = "windows") { "USERPROFILE" } else { "HOME" };
    if let Ok(home) = std::env::var(home_var) {
        let claude_exe = if cfg!(target_os = "windows") { "claude.exe" } else { "claude" };

        // Check different NVM directory structures
        let nvm_dirs = if cfg!(target_os = "windows") {
            vec![
                PathBuf::from(&home).join("AppData").join("Roaming").join("nvm").join("versions").join("node"),
                PathBuf::from(&home).join(".nvm").join("versions").join("node"),
            ]
        } else {
            vec![
                PathBuf::from(&home).join(".nvm").join("versions").join("node"),
            ]
        };

        for nvm_dir in nvm_dirs {
            debug!("Checking NVM directory: {:?}", nvm_dir);

            if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                        let claude_path = entry.path().join("bin").join(&claude_exe);

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
                                installation_type: InstallationType::System,
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

    // Common installation paths for claude
    let mut paths_to_check: Vec<(String, String)> = if cfg!(target_os = "windows") {
        // Windows-specific paths
        vec![
            ("C:\\Program Files\\Claude\\claude.exe".to_string(), "system".to_string()),
            ("C:\\Program Files (x86)\\Claude\\claude.exe".to_string(), "system".to_string()),
            ("C:\\Windows\\System32\\claude.exe".to_string(), "system".to_string()),
        ]
    } else {
        // Unix-like systems
        vec![
            ("/usr/local/bin/claude".to_string(), "system".to_string()),
            (
                "/opt/homebrew/bin/claude".to_string(),
                "homebrew".to_string(),
            ),
            ("/usr/bin/claude".to_string(), "system".to_string()),
            ("/bin/claude".to_string(), "system".to_string()),
        ]
    };

    // Also check user-specific paths
    let home_var = if cfg!(target_os = "windows") { "USERPROFILE" } else { "HOME" };
    if let Ok(home) = std::env::var(home_var) {
        let claude_exe = if cfg!(target_os = "windows") { "claude.exe" } else { "claude" };

        if cfg!(target_os = "windows") {
            // Windows-specific user paths
            paths_to_check.extend(vec![
                (
                    format!("{}\\AppData\\Local\\Claude\\{}", home, claude_exe),
                    "claude-local".to_string(),
                ),
                (
                    format!("{}\\AppData\\Roaming\\npm\\{}", home, claude_exe),
                    "npm-global".to_string(),
                ),
                (
                    format!("{}\\AppData\\Roaming\\npm\\node_modules\\.bin\\{}", home, claude_exe),
                    "node-modules".to_string(),
                ),
            ]);
        } else {
            // Unix-like user paths
            paths_to_check.extend(vec![
                (
                    format!("{}/.claude/local/{}", home, claude_exe),
                    "claude-local".to_string(),
                ),
                (
                    format!("{}/.local/bin/{}", home, claude_exe),
                    "local-bin".to_string(),
                ),
                (
                    format!("{}/.npm-global/bin/{}", home, claude_exe),
                    "npm-global".to_string(),
                ),
                (format!("{}/.yarn/bin/{}", home, claude_exe), "yarn".to_string()),
                (format!("{}/.bun/bin/{}", home, claude_exe), "bun".to_string()),
                (format!("{}/bin/{}", home, claude_exe), "home-bin".to_string()),
                // Check common node_modules locations
                (
                    format!("{}/node_modules/.bin/{}", home, claude_exe),
                    "node-modules".to_string(),
                ),
                (
                    format!("{}/.config/yarn/global/node_modules/.bin/{}", home, claude_exe),
                    "yarn-global".to_string(),
                ),
            ]);
        }
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
                installation_type: InstallationType::System,
            });
        }
    }

    // Also check if claude is available in PATH (without full path)
    let claude_cmd = if cfg!(target_os = "windows") { "claude.exe" } else { "claude" };
    let mut cmd = Command::new(claude_cmd);
    cmd.arg("--version");
    
    // On Windows, hide the console window to prevent CMD popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    if let Ok(output) = cmd.output() {
        if output.status.success() {
            debug!("claude is available in PATH");
            let version = extract_version_from_output(&output.stdout);

            installations.push(ClaudeInstallation {
                path: claude_cmd.to_string(),
                version,
                source: "PATH".to_string(),
                installation_type: InstallationType::System,
            });
        }
    }

    installations
}

/// Get Claude version by running --version command
fn get_claude_version(path: &str) -> Result<Option<String>, String> {
    let mut cmd = Command::new(path);
    cmd.arg("--version");
    
    // On Windows, hide the console window to prevent CMD popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    match cmd.output() {
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

    // On Windows, hide the console window to prevent CMD popup
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

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

    // On Windows, ensure SHELL environment variable is set for Claude CLI
    if cfg!(target_os = "windows") {
        // Always set SHELL environment variable on Windows for Claude CLI compatibility
        let shell_candidates = [
            "C:\\Program Files\\Git\\bin\\bash.exe",
            "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
            "C:\\msys64\\usr\\bin\\bash.exe",
            "C:\\cygwin64\\bin\\bash.exe",
            "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
            "powershell.exe",
            "cmd.exe"
        ];

        let mut shell_found = false;
        for shell_path in &shell_candidates {
            if std::path::Path::new(shell_path).exists() {
                debug!("Setting SHELL environment variable for Windows: {}", shell_path);
                cmd.env("SHELL", shell_path);
                shell_found = true;
                break;
            }
        }

        // If no shell found, default to bash (Claude CLI prefers POSIX shells)
        if !shell_found {
            debug!("No suitable shell found, defaulting to bash for Claude CLI compatibility");
            cmd.env("SHELL", "bash");
        }

        // Also set other Windows-specific environment variables that Claude CLI might need
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            cmd.env("HOME", userprofile);
        }
        if let Ok(comspec) = std::env::var("COMSPEC") {
            cmd.env("COMSPEC", comspec);
        }
    }

    // Add NVM support if the program is in an NVM directory
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

    cmd
}
