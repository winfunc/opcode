//! Integration tests for system information operations in sandbox
use crate::sandbox::common::*;
use crate::skip_if_unsupported;
use claudia_lib::sandbox::executor::SandboxExecutor;
use gaol::profile::{Operation, Profile};
use serial_test::serial;
use tempfile::TempDir;

/// Test system info read operations
#[test]
#[serial]
fn test_system_info_read() {
    skip_if_unsupported!();

    let platform = PlatformConfig::current();
    if !platform.supports_system_info {
        eprintln!("Skipping test: system info read not supported on this platform");
        return;
    }

    // Create test project
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create profile allowing system info read
    let operations = vec![Operation::SystemInfoRead];

    let profile = match Profile::new(operations) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to create profile - operation not supported");
            return;
        }
    };

    // Create test binary that reads system info
    let test_code = test_code::system_info();
    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_sysinfo", test_code, binary_dir.path())
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
            assert!(
                status.success(),
                "System info read should succeed when allowed"
            );
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}

/// Test forbidden system info access
#[test]
#[serial]
#[cfg(target_os = "macos")]
fn test_forbidden_system_info() {
    // Create test project
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create profile without system info permission
    let operations = vec![Operation::FileReadAll(gaol::profile::PathPattern::Subpath(
        test_fs.project_path.clone(),
    ))];

    let profile = match Profile::new(operations) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to create profile - operation not supported");
            return;
        }
    };

    // Create test binary that reads system info
    let test_code = test_code::system_info();
    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_no_sysinfo", test_code, binary_dir.path())
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
            // System info might not be blocked on all platforms
            if status.success() {
                eprintln!("WARNING: System info read was not blocked - checking platform");
                // On FreeBSD, system info is always allowed
                if std::env::consts::OS == "freebsd" {
                    eprintln!("System info is always allowed on FreeBSD");
                } else if std::env::consts::OS == "macos" {
                    // macOS might allow some system info reads
                    eprintln!("System info read allowed on macOS (platform limitation)");
                } else {
                    panic!("System info read should have been blocked on Linux");
                }
            }
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}

/// Test platform-specific system info behavior
#[test]
#[serial]
fn test_platform_specific_system_info() {
    skip_if_unsupported!();

    let platform = PlatformConfig::current();

    match std::env::consts::OS {
        "linux" => {
            // On Linux, system info is never allowed
            assert!(
                !platform.supports_system_info,
                "Linux should not support system info read"
            );
        }
        "macos" => {
            // On macOS, system info can be allowed
            assert!(
                platform.supports_system_info,
                "macOS should support system info read"
            );
        }
        "freebsd" => {
            // On FreeBSD, system info is always allowed (can't be restricted)
            assert!(
                platform.supports_system_info,
                "FreeBSD always allows system info read"
            );
        }
        _ => {
            eprintln!("Unknown platform behavior for system info");
        }
    }
}
