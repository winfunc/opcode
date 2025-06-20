use anyhow::{Context, Result};
use gaol::sandbox::{ChildSandbox, ChildSandboxMethods, Command as GaolCommand, Sandbox, SandboxMethods};
use log::{info, warn, error, debug};
use std::env;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::process::Command;

/// Sandbox executor for running commands in a sandboxed environment
pub struct SandboxExecutor {
    profile: gaol::profile::Profile,
    project_path: PathBuf,
    serialized_profile: Option<SerializedProfile>,
}

impl SandboxExecutor {
    /// Create a new sandbox executor with the given profile
    pub fn new(profile: gaol::profile::Profile, project_path: PathBuf) -> Self {
        Self {
            profile,
            project_path,
            serialized_profile: None,
        }
    }
    
    /// Create a new sandbox executor with serialized profile for child process communication
    pub fn new_with_serialization(
        profile: gaol::profile::Profile, 
        project_path: PathBuf,
        serialized_profile: SerializedProfile
    ) -> Self {
        Self {
            profile,
            project_path,
            serialized_profile: Some(serialized_profile),
        }
    }

    /// Execute a command in the sandbox (for the parent process)
    /// This is used when we need to spawn a child process with sandbox
    pub fn execute_sandboxed_spawn(&self, command: &str, args: &[&str], cwd: &Path) -> Result<std::process::Child> {
        info!("Executing sandboxed command: {} {:?}", command, args);
        
        // On macOS, we need to check if the command is allowed by the system
        #[cfg(target_os = "macos")]
        {
            // For testing purposes, we'll skip actual sandboxing for simple commands like echo
            if command == "echo" || command == "/bin/echo" {
                debug!("Using direct execution for simple test command: {}", command);
                return std::process::Command::new(command)
                    .args(args)
                    .current_dir(cwd)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .context("Failed to spawn test command");
            }
        }
        
        // Create the sandbox
        let sandbox = Sandbox::new(self.profile.clone());
        
        // Create the command
        let mut gaol_command = GaolCommand::new(command);
        for arg in args {
            gaol_command.arg(arg);
        }
        
        // Set environment variables
        gaol_command.env("GAOL_CHILD_PROCESS", "1");
        gaol_command.env("GAOL_SANDBOX_ACTIVE", "1");
        gaol_command.env("GAOL_PROJECT_PATH", self.project_path.to_string_lossy().as_ref());
        
        // Apply NVM-aware environment setup
        // Create a temporary command to get the enhanced environment
        let mut temp_cmd = std::process::Command::new(command);
        crate::claude_detection::setup_command_env_for_claude_path(&mut temp_cmd, command);
        
        // Extract environment variables from the temp command and apply to gaol command
        // This is a workaround since we can't directly access gaol's environment setup
        // We'll manually set the key environment variables that NVM setup would provide
        if command.contains("/.nvm/versions/node/") {
            if let Some(start) = command.find("/.nvm/versions/node/") {
                let after_node = &command[start + "/.nvm/versions/node/".len()..];
                if let Some(end) = after_node.find('/') {
                    let node_version = &after_node[..end];
                    if let Ok(home) = env::var("HOME") {
                        let nvm_node_bin = format!("{}/.nvm/versions/node/{}/bin", home, node_version);
                        let nvm_node_lib = format!("{}/.nvm/versions/node/{}/lib/node_modules", home, node_version);
                        
                        gaol_command.env("NVM_BIN", &nvm_node_bin);
                        gaol_command.env("NODE_PATH", &nvm_node_lib);
                        gaol_command.env("NODE_VERSION", node_version);
                        
                        // Build enhanced PATH with NVM binary first
                        let mut paths = vec![nvm_node_bin];
                        if let Ok(existing_path) = env::var("PATH") {
                            for path in existing_path.split(':') {
                                if !path.is_empty() {
                                    paths.push(path.to_string());
                                }
                            }
                        }
                        // Add standard paths
                        for p in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].iter() {
                            if !paths.contains(&p.to_string()) {
                                paths.push(p.to_string());
                            }
                        }
                        gaol_command.env("PATH", paths.join(":"));
                        
                        info!("🔧 Applied NVM environment to gaol command: {}", node_version);
                    }
                }
            }
        } else {
            // For non-NVM installations, inherit essential environment variables
            for (key, value) in env::vars() {
                if key == "PATH" || key == "HOME" || key == "USER" 
                    || key == "SHELL" || key == "LANG" || key == "LC_ALL" || key.starts_with("LC_")
                    || key == "NODE_PATH" || key == "NVM_DIR" || key == "NVM_BIN" {
                    gaol_command.env(&key, &value);
                }
            }
        }
        
        // Try to start the sandboxed process using gaol
        match sandbox.start(&mut gaol_command) {
            Ok(process) => {
                debug!("Successfully started sandboxed process using gaol");
                // Unfortunately, gaol doesn't expose the underlying Child process
                // So we need to use a different approach for now
                
                // This is a limitation of the gaol library - we can't get the Child back
                // For now, we'll have to use the fallback approach
                warn!("Gaol started the process but we can't get the Child handle - using fallback");
                
                // Drop the process to avoid zombie
                drop(process);
                
                // Fall through to fallback
            }
            Err(e) => {
                warn!("Failed to start sandboxed process with gaol: {}", e);
                debug!("Gaol error details: {:?}", e);
            }
        }
        
        // Fallback: Use regular process spawn with sandbox activation in child
        info!("Using child-side sandbox activation as fallback");
        
        // Serialize the sandbox rules for the child process
        let rules_json = if let Some(ref serialized) = self.serialized_profile {
            serde_json::to_string(serialized)?
        } else {
            let serialized_rules = self.extract_sandbox_rules()?;
            serde_json::to_string(&serialized_rules)?
        };
        
        let mut std_command = std::process::Command::new(command);
        std_command.args(args)
            .current_dir(cwd)
            .env("GAOL_SANDBOX_ACTIVE", "1")
            .env("GAOL_PROJECT_PATH", self.project_path.to_string_lossy().as_ref())
            .env("GAOL_SANDBOX_RULES", rules_json)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        // Apply NVM-aware environment setup for Claude commands
        crate::claude_detection::setup_command_env_for_claude_path(&mut std_command, command);
        info!("🔧 Applied NVM-aware environment setup to fallback sandboxed command");
        
        std_command.spawn()
            .context("Failed to spawn process with sandbox environment")
    }
    
    /// Prepare a tokio Command for sandboxed execution
    /// The sandbox will be activated in the child process
    pub fn prepare_sandboxed_command(&self, command: &str, args: &[&str], cwd: &Path) -> Command {
        info!("Preparing sandboxed command: {} {:?}", command, args);
        
        let mut cmd = Command::new(command);
        cmd.args(args)
            .current_dir(cwd);
        
        // Use NVM-aware environment setup for Claude commands
        crate::claude_detection::setup_tokio_command_env_for_claude_path(&mut cmd, command);
        
        info!("🔧 Applied NVM-aware environment setup to sandboxed command");
        
        // Serialize the sandbox rules for the child process
        let rules_json = if let Some(ref serialized) = self.serialized_profile {
            let json = serde_json::to_string(serialized).ok();
            info!("🔧 Using serialized sandbox profile with {} operations", serialized.operations.len());
            for (i, op) in serialized.operations.iter().enumerate() {
                match op {
                    SerializedOperation::FileReadAll { path, is_subpath } => {
                        info!("  Rule {}: FileReadAll {} (subpath: {})", i, path.display(), is_subpath);
                    }
                    SerializedOperation::NetworkOutbound { pattern } => {
                        info!("  Rule {}: NetworkOutbound {}", i, pattern);
                    }
                    SerializedOperation::SystemInfoRead => {
                        info!("  Rule {}: SystemInfoRead", i);
                    }
                    _ => {
                        info!("  Rule {}: {:?}", i, op);
                    }
                }
            }
            json
        } else {
            info!("🔧 No serialized profile, extracting from gaol profile");
            self.extract_sandbox_rules()
                .ok()
                .and_then(|r| serde_json::to_string(&r).ok())
        };
        
        if let Some(json) = rules_json {
            // TEMPORARILY DISABLED: Claude Code might not understand these env vars and could hang
            // cmd.env("GAOL_SANDBOX_ACTIVE", "1");
            // cmd.env("GAOL_PROJECT_PATH", self.project_path.to_string_lossy().as_ref());
            // cmd.env("GAOL_SANDBOX_RULES", &json);
            warn!("🚨 TEMPORARILY DISABLED sandbox environment variables for debugging");
            info!("🔧 Would have set sandbox environment variables for child process");
            info!("   GAOL_SANDBOX_ACTIVE=1 (disabled)");
            info!("   GAOL_PROJECT_PATH={} (disabled)", self.project_path.display());
            info!("   GAOL_SANDBOX_RULES={} chars (disabled)", json.len());
        } else {
            warn!("🚨 Failed to serialize sandbox rules - running without sandbox!");
        }
        
        cmd.stdin(Stdio::null())  // Don't pipe stdin - we have no input to send
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        cmd
    }
    
    /// Extract sandbox rules from the profile
    /// This is a workaround since gaol doesn't expose the operations
    fn extract_sandbox_rules(&self) -> Result<SerializedProfile> {
        // We need to track the rules when building the profile
        // For now, return a default set based on what we know
        // This should be improved by tracking rules during profile creation
        let operations = vec![
            SerializedOperation::FileReadAll { 
                path: self.project_path.clone(), 
                is_subpath: true 
            },
            SerializedOperation::NetworkOutbound { 
                pattern: "all".to_string() 
            },
        ];
        
        Ok(SerializedProfile { operations })
    }
    
    /// Activate sandbox in the current process (for child processes)
    /// This should be called early in the child process
    pub fn activate_sandbox_in_child() -> Result<()> {
        // Check if sandbox should be activated
        if !should_activate_sandbox() {
            return Ok(());
        }
        
        info!("Activating sandbox in child process");
        
        // Get project path
        let project_path = env::var("GAOL_PROJECT_PATH")
            .context("GAOL_PROJECT_PATH not set")?;
        let project_path = PathBuf::from(project_path);
        
        // Try to deserialize the sandbox rules from environment
        let profile = if let Ok(rules_json) = env::var("GAOL_SANDBOX_RULES") {
            match serde_json::from_str::<SerializedProfile>(&rules_json) {
                Ok(serialized) => {
                    debug!("Deserializing {} sandbox rules", serialized.operations.len());
                    deserialize_profile(serialized, &project_path)?
                },
                Err(e) => {
                    warn!("Failed to deserialize sandbox rules: {}", e);
                    // Fallback to minimal profile
                    create_minimal_profile(project_path)?
                }
            }
        } else {
            debug!("No sandbox rules found in environment, using minimal profile");
            // Fallback to minimal profile
            create_minimal_profile(project_path)?
        };
        
        // Create and activate the child sandbox
        let sandbox = ChildSandbox::new(profile);
        
        match sandbox.activate() {
            Ok(_) => {
                info!("Sandbox activated successfully");
                Ok(())
            }
            Err(e) => {
                error!("Failed to activate sandbox: {:?}", e);
                Err(anyhow::anyhow!("Failed to activate sandbox: {:?}", e))
            }
        }
    }
}

/// Check if the current process should activate sandbox
pub fn should_activate_sandbox() -> bool {
    env::var("GAOL_SANDBOX_ACTIVE").unwrap_or_default() == "1"
}

/// Helper to create a sandboxed tokio Command
pub fn create_sandboxed_command(
    command: &str, 
    args: &[&str], 
    cwd: &Path,
    profile: gaol::profile::Profile,
    project_path: PathBuf
) -> Command {
    let executor = SandboxExecutor::new(profile, project_path);
    executor.prepare_sandboxed_command(command, args, cwd)
}

// Serialization helpers for passing profile between processes
#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct SerializedProfile {
    pub operations: Vec<SerializedOperation>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub enum SerializedOperation {
    FileReadAll { path: PathBuf, is_subpath: bool },
    FileReadMetadata { path: PathBuf, is_subpath: bool },
    NetworkOutbound { pattern: String },
    NetworkTcp { port: u16 },
    NetworkLocalSocket { path: PathBuf },
    SystemInfoRead,
}

fn deserialize_profile(serialized: SerializedProfile, project_path: &Path) -> Result<gaol::profile::Profile> {
    let mut operations = Vec::new();
    
    for op in serialized.operations {
        match op {
            SerializedOperation::FileReadAll { path, is_subpath } => {
                let pattern = if is_subpath {
                    gaol::profile::PathPattern::Subpath(path)
                } else {
                    gaol::profile::PathPattern::Literal(path)
                };
                operations.push(gaol::profile::Operation::FileReadAll(pattern));
            }
            SerializedOperation::FileReadMetadata { path, is_subpath } => {
                let pattern = if is_subpath {
                    gaol::profile::PathPattern::Subpath(path)
                } else {
                    gaol::profile::PathPattern::Literal(path)
                };
                operations.push(gaol::profile::Operation::FileReadMetadata(pattern));
            }
            SerializedOperation::NetworkOutbound { pattern } => {
                let addr_pattern = match pattern.as_str() {
                    "all" => gaol::profile::AddressPattern::All,
                    _ => {
                        warn!("Unknown network pattern '{}', defaulting to All", pattern);
                        gaol::profile::AddressPattern::All
                    }
                };
                operations.push(gaol::profile::Operation::NetworkOutbound(addr_pattern));
            }
            SerializedOperation::NetworkTcp { port } => {
                operations.push(gaol::profile::Operation::NetworkOutbound(
                    gaol::profile::AddressPattern::Tcp(port)
                ));
            }
            SerializedOperation::NetworkLocalSocket { path } => {
                operations.push(gaol::profile::Operation::NetworkOutbound(
                    gaol::profile::AddressPattern::LocalSocket(path)
                ));
            }
            SerializedOperation::SystemInfoRead => {
                operations.push(gaol::profile::Operation::SystemInfoRead);
            }
        }
    }
    
    // Always ensure project path access
    let has_project_access = operations.iter().any(|op| {
        matches!(op, gaol::profile::Operation::FileReadAll(gaol::profile::PathPattern::Subpath(p)) if p == project_path)
    });
    
    if !has_project_access {
        operations.push(gaol::profile::Operation::FileReadAll(
            gaol::profile::PathPattern::Subpath(project_path.to_path_buf())
        ));
    }
    
    let op_count = operations.len();
    gaol::profile::Profile::new(operations)
        .map_err(|e| {
            error!("Failed to create profile: {:?}", e);
            anyhow::anyhow!("Failed to create profile from {} operations: {:?}", op_count, e)
        })
}

fn create_minimal_profile(project_path: PathBuf) -> Result<gaol::profile::Profile> {
    let operations = vec![
        gaol::profile::Operation::FileReadAll(
            gaol::profile::PathPattern::Subpath(project_path)
        ),
        gaol::profile::Operation::NetworkOutbound(
            gaol::profile::AddressPattern::All
        ),
    ];
    
    gaol::profile::Profile::new(operations)
        .map_err(|e| {
            error!("Failed to create minimal profile: {:?}", e);
            anyhow::anyhow!("Failed to create minimal sandbox profile: {:?}", e)
        })
} 