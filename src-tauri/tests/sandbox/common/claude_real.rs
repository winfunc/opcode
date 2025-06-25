//! Helper functions for executing real Claude commands in tests
use anyhow::{Context, Result};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Duration;

/// Execute Claude with a specific task and capture output
pub fn execute_claude_task(
    project_path: &Path,
    task: &str,
    system_prompt: Option<&str>,
    model: Option<&str>,
    sandbox_profile_id: Option<i64>,
    timeout_secs: u64,
) -> Result<ClaudeOutput> {
    let mut cmd = Command::new("claude");

    // Add task
    cmd.arg("-p").arg(task);

    // Add system prompt if provided
    if let Some(prompt) = system_prompt {
        cmd.arg("--system-prompt").arg(prompt);
    }

    // Add model if provided
    if let Some(m) = model {
        cmd.arg("--model").arg(m);
    }

    // Always add these flags for testing
    cmd.arg("--output-format")
        .arg("stream-json")
        .arg("--verbose")
        .arg("--dangerously-skip-permissions")
        .current_dir(project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Add sandbox profile ID if provided
    if let Some(profile_id) = sandbox_profile_id {
        cmd.env("CLAUDIA_SANDBOX_PROFILE_ID", profile_id.to_string());
    }

    // Execute with timeout (use gtimeout on macOS, timeout on Linux)
    let start = std::time::Instant::now();

    let timeout_cmd = if cfg!(target_os = "macos") {
        // On macOS, try gtimeout (from GNU coreutils) first, fallback to direct execution
        if std::process::Command::new("which")
            .arg("gtimeout")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            "gtimeout"
        } else {
            // If gtimeout not available, just run without timeout
            ""
        }
    } else {
        "timeout"
    };

    let output = if timeout_cmd.is_empty() {
        // Run without timeout wrapper
        cmd.output().context("Failed to execute Claude command")?
    } else {
        // Run with timeout wrapper
        let mut timeout_cmd = Command::new(timeout_cmd);
        timeout_cmd
            .arg(timeout_secs.to_string())
            .arg("claude")
            .args(cmd.get_args())
            .current_dir(project_path)
            .envs(cmd.get_envs().filter_map(|(k, v)| v.map(|v| (k, v))))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .context("Failed to execute Claude command with timeout")?
    };

    let duration = start.elapsed();

    Ok(ClaudeOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
        duration,
    })
}

/// Result of Claude execution
#[derive(Debug)]
pub struct ClaudeOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration: Duration,
}

impl ClaudeOutput {
    /// Check if the output contains evidence of a specific operation
    pub fn contains_operation(&self, operation: &str) -> bool {
        self.stdout.contains(operation) || self.stderr.contains(operation)
    }

    /// Check if operation was blocked (look for permission denied, sandbox violation, etc)
    pub fn operation_was_blocked(&self, operation: &str) -> bool {
        let blocked_patterns = [
            "permission denied",
            "not permitted",
            "blocked by sandbox",
            "operation not allowed",
            "access denied",
            "sandbox violation",
        ];

        let output = format!("{}\n{}", self.stdout, self.stderr).to_lowercase();
        let op_lower = operation.to_lowercase();

        // Check if operation was mentioned along with a block pattern
        blocked_patterns
            .iter()
            .any(|pattern| output.contains(&op_lower) && output.contains(pattern))
    }

    /// Check if file read was successful
    pub fn file_read_succeeded(&self, filename: &str) -> bool {
        // Look for patterns indicating successful file read
        let patterns = [
            &format!("Read {}", filename),
            &format!("Reading {}", filename),
            &format!("Contents of {}", filename),
            "test content", // Our test files contain this
        ];

        patterns
            .iter()
            .any(|pattern| self.contains_operation(pattern))
    }

    /// Check if network connection was attempted
    pub fn network_attempted(&self, host: &str) -> bool {
        let patterns = [
            &format!("Connecting to {}", host),
            &format!("Connected to {}", host),
            &format!("connect to {}", host),
            host,
        ];

        patterns
            .iter()
            .any(|pattern| self.contains_operation(pattern))
    }
}

/// Common test tasks for Claude
pub mod tasks {
    /// Task to read a file
    pub fn read_file(filename: &str) -> String {
        format!("Read the file {} and show me its contents", filename)
    }

    /// Task to attempt network connection
    pub fn connect_network(host: &str) -> String {
        format!("Try to connect to {} and tell me if it works", host)
    }

    /// Task to do multiple operations
    pub fn multi_operation() -> String {
        "Read the file ./test.txt in the current directory and show its contents".to_string()
    }

    /// Task to test file write
    pub fn write_file(filename: &str, content: &str) -> String {
        format!(
            "Create a file called {} with the content '{}'",
            filename, content
        )
    }

    /// Task to test process spawning
    pub fn spawn_process(command: &str) -> String {
        format!("Run the command '{}' and show me the output", command)
    }
}
