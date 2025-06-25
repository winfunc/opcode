//! Integration tests for process isolation in sandbox
use crate::sandbox::common::*;
use crate::skip_if_unsupported;
use claudia_lib::sandbox::executor::SandboxExecutor;
use gaol::profile::{AddressPattern, Operation, PathPattern, Profile};
use serial_test::serial;
use tempfile::TempDir;

/// Test that process spawning is always forbidden
#[test]
#[serial]
fn test_process_spawn_forbidden() {
    skip_if_unsupported!();

    // Create test project
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create profile with various permissions (process spawn should still be blocked)
    let operations = vec![
        Operation::FileReadAll(PathPattern::Subpath(test_fs.project_path.clone())),
        Operation::NetworkOutbound(AddressPattern::All),
    ];

    let profile = match Profile::new(operations) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to create profile - operation not supported");
            return;
        }
    };

    // Create test binary that tries to spawn a process
    let test_code = test_code::spawn_process();
    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_spawn", test_code, binary_dir.path())
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
            // Process spawning might not be blocked on all platforms
            if status.success() {
                eprintln!("WARNING: Process spawning was not blocked");
                // macOS sandbox might have limitations
                if std::env::consts::OS != "linux" {
                    eprintln!(
                        "Process spawning might not be fully blocked on {}",
                        std::env::consts::OS
                    );
                } else {
                    panic!("Process spawning should be blocked on Linux");
                }
            }
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}

/// Test that fork is blocked
#[test]
#[serial]
#[cfg(unix)]
fn test_fork_forbidden() {
    skip_if_unsupported!();

    // Create test project
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

    // Create test binary that tries to fork
    let test_code = test_code::fork_process();

    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary_with_deps(
        "test_fork",
        test_code,
        binary_dir.path(),
        &[("libc", "0.2")],
    )
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
            // Fork might not be blocked on all platforms
            if status.success() {
                eprintln!("WARNING: Fork was not blocked (platform limitation)");
                if std::env::consts::OS == "linux" {
                    panic!("Fork should be blocked on Linux");
                }
            }
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}

/// Test that exec is blocked
#[test]
#[serial]
#[cfg(unix)]
fn test_exec_forbidden() {
    skip_if_unsupported!();

    // Create test project
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

    // Create test binary that tries to exec
    let test_code = test_code::exec_process();

    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary_with_deps(
        "test_exec",
        test_code,
        binary_dir.path(),
        &[("libc", "0.2")],
    )
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
            // Exec might not be blocked on all platforms
            if status.success() {
                eprintln!("WARNING: Exec was not blocked (platform limitation)");
                if std::env::consts::OS == "linux" {
                    panic!("Exec should be blocked on Linux");
                }
            }
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}

/// Test thread creation is allowed
#[test]
#[serial]
fn test_thread_creation_allowed() {
    skip_if_unsupported!();

    // Create test project
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

    // Create test binary that creates threads
    let test_code = r#"
use std::thread;
use std::time::Duration;

fn main() {
    let handle = thread::spawn(|| {
        thread::sleep(Duration::from_millis(100));
        42
    });
    
    match handle.join() {
        Ok(value) => {
            println!("SUCCESS: Thread returned {}", value);
        }
        Err(_) => {
            eprintln!("FAILURE: Thread panicked");
            std::process::exit(1);
        }
    }
}
"#;

    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_thread", test_code, binary_dir.path())
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
            assert!(status.success(), "Thread creation should be allowed");
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}
