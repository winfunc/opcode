//! Helper functions for sandbox testing
use anyhow::{Context, Result};
use std::env;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::Duration;

/// Check if sandboxing is supported on the current platform
pub fn is_sandboxing_supported() -> bool {
    matches!(env::consts::OS, "linux" | "macos" | "freebsd")
}

/// Skip test if sandboxing is not supported
#[macro_export]
macro_rules! skip_if_unsupported {
    () => {
        if !$crate::sandbox::common::is_sandboxing_supported() {
            eprintln!(
                "Skipping test: sandboxing not supported on {}",
                std::env::consts::OS
            );
            return;
        }
    };
}

/// Platform-specific test configuration
pub struct PlatformConfig {
    pub supports_file_read: bool,
    pub supports_metadata_read: bool,
    pub supports_network_all: bool,
    pub supports_network_tcp: bool,
    pub supports_network_local: bool,
    pub supports_system_info: bool,
}

impl PlatformConfig {
    /// Get configuration for current platform
    pub fn current() -> Self {
        match env::consts::OS {
            "linux" => Self {
                supports_file_read: true,
                supports_metadata_read: false, // Cannot be precisely controlled
                supports_network_all: true,
                supports_network_tcp: false,   // Cannot filter by port
                supports_network_local: false, // Cannot filter by path
                supports_system_info: false,
            },
            "macos" => Self {
                supports_file_read: true,
                supports_metadata_read: true,
                supports_network_all: true,
                supports_network_tcp: true,
                supports_network_local: true,
                supports_system_info: true,
            },
            "freebsd" => Self {
                supports_file_read: false,
                supports_metadata_read: false,
                supports_network_all: false,
                supports_network_tcp: false,
                supports_network_local: false,
                supports_system_info: true, // Always allowed
            },
            _ => Self {
                supports_file_read: false,
                supports_metadata_read: false,
                supports_network_all: false,
                supports_network_tcp: false,
                supports_network_local: false,
                supports_system_info: false,
            },
        }
    }
}

/// Test command builder
pub struct TestCommand {
    command: String,
    args: Vec<String>,
    env_vars: Vec<(String, String)>,
    working_dir: Option<PathBuf>,
}

impl TestCommand {
    /// Create a new test command
    pub fn new(command: &str) -> Self {
        Self {
            command: command.to_string(),
            args: Vec::new(),
            env_vars: Vec::new(),
            working_dir: None,
        }
    }

    /// Add an argument
    pub fn arg(mut self, arg: &str) -> Self {
        self.args.push(arg.to_string());
        self
    }

    /// Add multiple arguments
    pub fn args(mut self, args: &[&str]) -> Self {
        self.args.extend(args.iter().map(|s| s.to_string()));
        self
    }

    /// Set an environment variable
    pub fn env(mut self, key: &str, value: &str) -> Self {
        self.env_vars.push((key.to_string(), value.to_string()));
        self
    }

    /// Set working directory
    pub fn current_dir(mut self, dir: &Path) -> Self {
        self.working_dir = Some(dir.to_path_buf());
        self
    }

    /// Execute the command with timeout
    pub fn execute_with_timeout(&self, timeout: Duration) -> Result<Output> {
        let mut cmd = Command::new(&self.command);

        cmd.args(&self.args);

        for (key, value) in &self.env_vars {
            cmd.env(key, value);
        }

        if let Some(dir) = &self.working_dir {
            cmd.current_dir(dir);
        }

        // On Unix, we can use a timeout mechanism
        #[cfg(unix)]
        {
            use std::time::Instant;

            let start = Instant::now();
            let mut child = cmd.spawn().context("Failed to spawn command")?;

            loop {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        let output = child.wait_with_output()?;
                        return Ok(Output {
                            status,
                            stdout: output.stdout,
                            stderr: output.stderr,
                        });
                    }
                    Ok(None) => {
                        if start.elapsed() > timeout {
                            child.kill()?;
                            return Err(anyhow::anyhow!("Command timed out"));
                        }
                        std::thread::sleep(Duration::from_millis(100));
                    }
                    Err(e) => return Err(e.into()),
                }
            }
        }

        #[cfg(not(unix))]
        {
            // Fallback for non-Unix platforms
            cmd.output().context("Failed to execute command")
        }
    }

    /// Execute and expect success
    pub fn execute_expect_success(&self) -> Result<String> {
        let output = self.execute_with_timeout(Duration::from_secs(10))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!(
                "Command failed with status {:?}. Stderr: {stderr}",
                output.status.code()
            ));
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    /// Execute and expect failure
    pub fn execute_expect_failure(&self) -> Result<String> {
        let output = self.execute_with_timeout(Duration::from_secs(10))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(anyhow::anyhow!(
                "Command unexpectedly succeeded. Stdout: {stdout}"
            ));
        }

        Ok(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Create a simple test binary that attempts an operation
pub fn create_test_binary(name: &str, code: &str, test_dir: &Path) -> Result<PathBuf> {
    create_test_binary_with_deps(name, code, test_dir, &[])
}

/// Create a test binary with optional dependencies
pub fn create_test_binary_with_deps(
    name: &str,
    code: &str,
    test_dir: &Path,
    dependencies: &[(&str, &str)],
) -> Result<PathBuf> {
    let src_dir = test_dir.join("src");
    std::fs::create_dir_all(&src_dir)?;

    // Build dependencies section
    let deps_section = if dependencies.is_empty() {
        String::new()
    } else {
        let mut deps = String::from("\n[dependencies]\n");
        for (dep_name, dep_version) in dependencies {
            deps.push_str(&format!("{dep_name} = \"{dep_version}\"\n"));
        }
        deps
    };

    // Create Cargo.toml
    let cargo_toml = format!(
        r#"[package]
name = "{name}"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "{name}"
path = "src/main.rs"
{deps_section}"#
    );
    std::fs::write(test_dir.join("Cargo.toml"), cargo_toml)?;

    // Create main.rs
    std::fs::write(src_dir.join("main.rs"), code)?;

    // Build the binary
    let output = Command::new("cargo")
        .arg("build")
        .arg("--release")
        .current_dir(test_dir)
        .output()
        .context("Failed to build test binary")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("Failed to build test binary: {stderr}"));
    }

    let binary_path = test_dir.join("target/release").join(name);
    Ok(binary_path)
}

/// Test code snippets for various operations
pub mod test_code {
    /// Code that reads a file
    pub fn file_read(path: &str) -> String {
        format!(
            r#"
fn main() {{
    match std::fs::read_to_string("{path}") {{
        Ok(content) => {{
            println!("SUCCESS: Read {{}} bytes", content.len());
        }}
        Err(e) => {{
            eprintln!("FAILURE: {{}}", e);
            std::process::exit(1);
        }}
    }}
}}
"#
        )
    }

    /// Code that reads file metadata
    pub fn file_metadata(path: &str) -> String {
        format!(
            r#"
fn main() {{
    match std::fs::metadata("{path}") {{
        Ok(metadata) => {{
            println!("SUCCESS: File size: {{}} bytes", metadata.len());
        }}
        Err(e) => {{
            eprintln!("FAILURE: {{}}", e);
            std::process::exit(1);
        }}
    }}
}}
"#
        )
    }

    /// Code that makes a network connection
    pub fn network_connect(addr: &str) -> String {
        format!(
            r#"
use std::net::TcpStream;

fn main() {{
    match TcpStream::connect("{addr}") {{
        Ok(_) => {{
            println!("SUCCESS: Connected to {addr}");
        }}
        Err(e) => {{
            eprintln!("FAILURE: {{}}", e);
            std::process::exit(1);
        }}
    }}
}}
"#
        )
    }

    /// Code that reads system information
    pub fn system_info() -> &'static str {
        r#"
#[cfg(target_os = "macos")]
fn main() {
    use std::ffi::CString;
    use std::os::raw::c_void;
    
    extern "C" {
        fn sysctlbyname(
            name: *const std::os::raw::c_char,
            oldp: *mut c_void,
            oldlenp: *mut usize,
            newp: *const c_void,
            newlen: usize,
        ) -> std::os::raw::c_int;
    }
    
    let name = CString::new("hw.ncpu").unwrap();
    let mut ncpu: i32 = 0;
    let mut len = std::mem::size_of::<i32>();
    
    unsafe {
        let result = sysctlbyname(
            name.as_ptr(),
            &mut ncpu as *mut _ as *mut c_void,
            &mut len,
            std::ptr::null(),
            0,
        );
        
        if result == 0 {
            println!("SUCCESS: CPU count: {}", ncpu);
        } else {
            eprintln!("FAILURE: sysctlbyname failed");
            std::process::exit(1);
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn main() {
    println!("SUCCESS: System info test not applicable on this platform");
}
"#
    }

    /// Code that tries to spawn a process
    pub fn spawn_process() -> &'static str {
        r#"
use std::process::Command;

fn main() {
    match Command::new("echo").arg("test").output() {
        Ok(_) => {
            println!("SUCCESS: Spawned process");
        }
        Err(e) => {
            eprintln!("FAILURE: {}", e);
            std::process::exit(1);
        }
    }
}
"#
    }

    /// Code that uses fork (requires libc)
    pub fn fork_process() -> &'static str {
        r#"
#[cfg(unix)]
fn main() {
    unsafe {
        let pid = libc::fork();
        if pid < 0 {
            eprintln!("FAILURE: fork failed");
            std::process::exit(1);
        } else if pid == 0 {
            // Child process
            println!("SUCCESS: Child process created");
            std::process::exit(0);
        } else {
            // Parent process
            let mut status = 0;
            libc::waitpid(pid, &mut status, 0);
            println!("SUCCESS: Fork completed");
        }
    }
}

#[cfg(not(unix))]
fn main() {
    eprintln!("FAILURE: fork not supported on this platform");
    std::process::exit(1);
}
"#
    }

    /// Code that uses exec (requires libc)
    pub fn exec_process() -> &'static str {
        r#"
use std::ffi::CString;

#[cfg(unix)]
fn main() {
    unsafe {
        let program = CString::new("/bin/echo").unwrap();
        let arg = CString::new("test").unwrap();
        let args = vec![program.as_ptr(), arg.as_ptr(), std::ptr::null()];
        
        let result = libc::execv(program.as_ptr(), args.as_ptr());
        
        // If we reach here, exec failed
        eprintln!("FAILURE: exec failed with result {}", result);
        std::process::exit(1);
    }
}

#[cfg(not(unix))]
fn main() {
    eprintln!("FAILURE: exec not supported on this platform");
    std::process::exit(1);
}
"#
    }

    /// Code that tries to write a file
    pub fn file_write(path: &str) -> String {
        format!(
            r#"
fn main() {{
    match std::fs::write("{path}", "test content") {{
        Ok(_) => {{
            println!("SUCCESS: Wrote file");
        }}
        Err(e) => {{
            eprintln!("FAILURE: {{}}", e);
            std::process::exit(1);
        }}
    }}
}}
"#
        )
    }
}

/// Assert that a command output contains expected text
pub fn assert_output_contains(output: &str, expected: &str) {
    assert!(
        output.contains(expected),
        "Expected output to contain '{expected}', but got: {output}"
    );
}

/// Assert that a command output indicates success
pub fn assert_sandbox_success(output: &str) {
    assert_output_contains(output, "SUCCESS:");
}

/// Assert that a command output indicates failure
pub fn assert_sandbox_failure(output: &str) {
    assert_output_contains(output, "FAILURE:");
}
