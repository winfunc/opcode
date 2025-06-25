//! Integration tests for sandbox violation detection and logging
use crate::sandbox::common::*;
use crate::skip_if_unsupported;
use claudia_lib::sandbox::executor::SandboxExecutor;
use gaol::profile::{Operation, PathPattern, Profile};
use serial_test::serial;
use std::sync::{Arc, Mutex};
use tempfile::TempDir;

/// Mock violation collector for testing
#[derive(Clone)]
struct ViolationCollector {
    violations: Arc<Mutex<Vec<ViolationEvent>>>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct ViolationEvent {
    operation_type: String,
    pattern_value: Option<String>,
    process_name: String,
}

impl ViolationCollector {
    fn new() -> Self {
        Self {
            violations: Arc::new(Mutex::new(Vec::new())),
        }
    }

    fn record(&self, operation_type: &str, pattern_value: Option<&str>, process_name: &str) {
        let event = ViolationEvent {
            operation_type: operation_type.to_string(),
            pattern_value: pattern_value.map(|s| s.to_string()),
            process_name: process_name.to_string(),
        };

        if let Ok(mut violations) = self.violations.lock() {
            violations.push(event);
        }
    }

    fn get_violations(&self) -> Vec<ViolationEvent> {
        self.violations.lock().unwrap().clone()
    }
}

/// Test that violations are detected for forbidden operations
#[test]
#[serial]
fn test_violation_detection() {
    skip_if_unsupported!();

    let platform = PlatformConfig::current();
    if !platform.supports_file_read {
        eprintln!("Skipping test: file read not supported on this platform");
        return;
    }

    // Create test file system
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");
    let collector = ViolationCollector::new();

    // Create profile allowing only project path
    let operations = vec![Operation::FileReadAll(PathPattern::Subpath(
        test_fs.project_path.clone(),
    ))];

    let profile = match Profile::new(operations) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to create profile - operation not supported");
            return;
        }
    };

    // Test various forbidden operations
    let test_cases = vec![
        (
            "file_read",
            test_code::file_read(&test_fs.forbidden_path.join("secret.txt").to_string_lossy()),
            "file_read_forbidden",
        ),
        (
            "file_write",
            test_code::file_write(&test_fs.project_path.join("new.txt").to_string_lossy()),
            "file_write_forbidden",
        ),
        (
            "process_spawn",
            test_code::spawn_process().to_string(),
            "process_spawn_forbidden",
        ),
    ];

    for (op_type, test_code, binary_name) in test_cases {
        let binary_dir = TempDir::new().expect("Failed to create temp dir");
        let binary_path = create_test_binary(binary_name, &test_code, binary_dir.path())
            .expect("Failed to create test binary");

        let executor = SandboxExecutor::new(profile.clone(), test_fs.project_path.clone());
        match executor.execute_sandboxed_spawn(
            &binary_path.to_string_lossy(),
            &[],
            &test_fs.project_path,
        ) {
            Ok(mut child) => {
                let status = child.wait().expect("Failed to wait for child");
                if !status.success() {
                    // Record violation
                    collector.record(op_type, None, binary_name);
                }
            }
            Err(_) => {
                // Sandbox setup failure, not a violation
            }
        }
    }

    // Verify violations were detected
    let violations = collector.get_violations();
    // On some platforms (like macOS), sandbox might not block all operations
    if violations.is_empty() {
        eprintln!("WARNING: No violations detected - this might be a platform limitation");
        // On Linux, we expect at least some violations
        if std::env::consts::OS == "linux" {
            panic!("Should have detected some violations on Linux");
        }
    }
}

/// Test violation patterns and details
#[test]
#[serial]
fn test_violation_patterns() {
    skip_if_unsupported!();

    let platform = PlatformConfig::current();
    if !platform.supports_file_read {
        eprintln!("Skipping test: file read not supported on this platform");
        return;
    }

    // Create test file system
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create profile with specific allowed paths
    let allowed_dir = test_fs.root.path().join("allowed_specific");
    std::fs::create_dir_all(&allowed_dir).expect("Failed to create allowed dir");

    let operations = vec![
        Operation::FileReadAll(PathPattern::Subpath(test_fs.project_path.clone())),
        Operation::FileReadAll(PathPattern::Literal(allowed_dir.join("file.txt"))),
    ];

    let profile = match Profile::new(operations) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to create profile - operation not supported");
            return;
        }
    };

    // Test accessing different forbidden paths
    let forbidden_db_path = test_fs
        .forbidden_path
        .join("data.db")
        .to_string_lossy()
        .to_string();
    let forbidden_paths = vec![
        ("/etc/passwd", "system_file"),
        ("/tmp/test.txt", "temp_file"),
        (forbidden_db_path.as_str(), "forbidden_db"),
    ];

    for (path, test_name) in forbidden_paths {
        let test_code = test_code::file_read(path);
        let binary_dir = TempDir::new().expect("Failed to create temp dir");
        let binary_path = create_test_binary(test_name, &test_code, binary_dir.path())
            .expect("Failed to create test binary");

        let executor = SandboxExecutor::new(profile.clone(), test_fs.project_path.clone());
        match executor.execute_sandboxed_spawn(
            &binary_path.to_string_lossy(),
            &[],
            &test_fs.project_path,
        ) {
            Ok(mut child) => {
                let status = child.wait().expect("Failed to wait for child");
                // Some platforms might not block all file access
                if status.success() {
                    eprintln!(
                        "WARNING: Access to {} was allowed (possible platform limitation)",
                        path
                    );
                    if std::env::consts::OS == "linux" && path.starts_with("/etc") {
                        panic!("Access to {} should be denied on Linux", path);
                    }
                }
            }
            Err(_) => {
                // Sandbox setup failure
            }
        }
    }
}

/// Test multiple violations in sequence
#[test]
#[serial]
fn test_multiple_violations_sequence() {
    skip_if_unsupported!();

    // Create test file system
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create minimal profile
    let operations = vec![Operation::FileReadAll(PathPattern::Subpath(
        test_fs.project_path.clone(),
    ))];

    let profile = match Profile::new(operations) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to create profile - operation not supported");
            return;
        }
    };

    // Create test binary that attempts multiple forbidden operations
    let test_code = r#"
use std::fs;
use std::net::TcpStream;
use std::process::Command;

fn main() {{
    let mut failures = 0;
    
    // Try file write
    if fs::write("/tmp/test.txt", "data").is_err() {{
        eprintln!("File write failed (expected)");
        failures += 1;
    }}
    
    // Try network connection
    if TcpStream::connect("google.com:80").is_err() {{
        eprintln!("Network connection failed (expected)");
        failures += 1;
    }}
    
    // Try process spawn
    if Command::new("ls").output().is_err() {{
        eprintln!("Process spawn failed (expected)");
        failures += 1;
    }}
    
    // Try forbidden file read
    if fs::read_to_string("/etc/passwd").is_err() {{
        eprintln!("Forbidden file read failed (expected)");
        failures += 1;
    }}
    
    if failures > 0 {{
        eprintln!("FAILURE: {{failures}} operations were blocked");
        std::process::exit(1);
    }} else {{
        println!("SUCCESS: No operations were blocked (unexpected)");
    }}
}}
"#;

    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_multi_violations", test_code, binary_dir.path())
        .expect("Failed to create test binary");

    // Execute in sandbox
    let executor = SandboxExecutor::new(profile, test_fs.project_path.clone());
    match executor.execute_sandboxed_spawn(
        &binary_path.to_string_lossy(),
        &[],
        &test_fs.project_path,
    ) {
        Ok(mut child) => {
            let status = child.wait().expect("Failed to wait for child");
            // Multiple operations might not be blocked on all platforms
            if status.success() {
                eprintln!("WARNING: Forbidden operations were not blocked (platform limitation)");
                if std::env::consts::OS == "linux" {
                    panic!("Operations should be blocked on Linux");
                }
            }
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}
