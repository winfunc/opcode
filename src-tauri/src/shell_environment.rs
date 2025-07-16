use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

/// Simple shell configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellConfig {
    pub shell_path: String,
    pub shell_type: ShellType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShellType {
    Bash,
    WSL,
    PowerShell,
    Cmd,
}

/// Find the best available shell on Windows
pub fn find_best_shell() -> Result<ShellConfig, String> {
    // Try to find bash first (preferred for Claude Code)
    if let Some(bash_path) = find_bash_shell() {
        info!("Found bash shell at: {}", bash_path);
        return Ok(ShellConfig {
            shell_path: bash_path,
            shell_type: ShellType::Bash,
        });
    }

    // Try WSL as second choice
    if let Some(wsl_path) = find_wsl_shell() {
        info!("Found WSL shell at: {}", wsl_path);
        return Ok(ShellConfig {
            shell_path: wsl_path,
            shell_type: ShellType::WSL,
        });
    }

    // No POSIX shell found - return clear error message
    Err("Claude Code requires a POSIX shell environment to work properly on Windows (git bash or WSL)

Quick fix: Install Git for Windows with 'Git Bash' option
Download: https://git-scm.com/download/win

Alternative: Enable WSL with 'wsl --install' in PowerShell (as Admin)".to_string())
}

/// Find bash shell using multiple detection methods
pub fn find_bash_shell() -> Option<String> {
    // Method 1: Check common installation paths
    let common_paths = vec![
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
        r"C:\msys64\usr\bin\bash.exe",
        r"C:\cygwin64\bin\bash.exe",
    ];

    for path in common_paths {
        if Path::new(path).exists() {
            debug!("Found bash at: {}", path);
            return Some(path.to_string());
        }
    }

    // Method 2: Try to find bash in PATH
    if let Ok(output) = Command::new("where").arg("bash").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() && Path::new(&path).exists() {
                debug!("Found bash in PATH: {}", path);
                return Some(path);
            }
        }
    }

    // Method 3: Check Git installation via registry
    if let Some(git_path) = find_git_from_registry() {
        let bash_path = format!("{}\\bin\\bash.exe", git_path);
        if Path::new(&bash_path).exists() {
            debug!("Found bash via Git registry: {}", bash_path);
            return Some(bash_path);
        }
    }

    None
}

/// Find WSL shell
pub fn find_wsl_shell() -> Option<String> {
    // Check if WSL is available
    if let Ok(output) = Command::new("wsl").arg("--list").arg("--quiet").output() {
        if output.status.success() && !output.stdout.is_empty() {
            debug!("Found WSL");
            return Some("wsl.exe".to_string());
        }
    }
    None
}

/// Find PowerShell executable
pub fn find_powershell() -> Option<String> {
    let pwsh_paths = vec![
        r"C:\Program Files\PowerShell\7\pwsh.exe",
        r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
    ];

    for path in pwsh_paths {
        if Path::new(path).exists() {
            return Some(path.to_string());
        }
    }

    None
}

/// Find Git installation path from Windows registry
#[cfg(target_os = "windows")]
fn find_git_from_registry() -> Option<String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    let git_paths = vec![
        r"SOFTWARE\GitForWindows",
        r"SOFTWARE\WOW6432Node\GitForWindows",
    ];

    for path in git_paths {
        if let Ok(git_key) = hklm.open_subkey(path) {
            if let Ok(install_path) = git_key.get_value::<String, _>("InstallPath") {
                debug!("Found Git in registry: {}", install_path);
                return Some(install_path);
            }
        }
    }

    None
}

#[cfg(not(target_os = "windows"))]
fn find_git_from_registry() -> Option<String> {
    None
}

/// Set up environment variables for Claude Code execution
pub fn setup_claude_environment() -> Result<std::collections::HashMap<String, String>, String> {
    let mut env_vars = std::collections::HashMap::new();

    if cfg!(target_os = "windows") {
        // Find the best available shell
        let shell_config = find_best_shell()?;
        
        env_vars.insert("SHELL".to_string(), shell_config.shell_path);
        
        // Set shell-specific environment variables
        match shell_config.shell_type {
            ShellType::Bash | ShellType::WSL => {
                env_vars.insert("TERM".to_string(), "xterm".to_string());
            }
            ShellType::PowerShell => {
                warn!("Using PowerShell fallback - some features may not work");
                env_vars.insert("CLAUDE_SHELL_COMPAT".to_string(), "powershell".to_string());
            }
            ShellType::Cmd => {
                warn!("Using cmd.exe fallback - some features may not work");
                env_vars.insert("CLAUDE_SHELL_COMPAT".to_string(), "cmd".to_string());
            }
        }

        // Set other required environment variables
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            env_vars.insert("HOME".to_string(), userprofile);
        }

        if std::env::var("LANG").is_err() {
            env_vars.insert("LANG".to_string(), "en_US.UTF-8".to_string());
        }

        if let Ok(path) = std::env::var("PATH") {
            env_vars.insert("PATH".to_string(), path);
        }
    }

    Ok(env_vars)
}

/// Apply environment variables to a tokio Command
pub fn apply_environment_to_command(cmd: &mut tokio::process::Command, env_vars: &std::collections::HashMap<String, String>) {
    for (key, value) in env_vars {
        cmd.env(key, value);
    }
}

/// Apply environment variables to a std Command
pub fn apply_environment_to_std_command(cmd: &mut std::process::Command, env_vars: &std::collections::HashMap<String, String>) {
    for (key, value) in env_vars {
        cmd.env(key, value);
    }
}

/// Apply environment variables to a Tauri sidecar command
pub fn apply_environment_to_sidecar(mut cmd: tauri_plugin_shell::process::Command, env_vars: &std::collections::HashMap<String, String>) -> tauri_plugin_shell::process::Command {
    for (key, value) in env_vars {
        cmd = cmd.env(key, value);
    }
    cmd
} 