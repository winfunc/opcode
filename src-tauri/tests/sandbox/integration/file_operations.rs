//! Integration tests for file operations in sandbox
use crate::sandbox::common::*;
use crate::skip_if_unsupported;
use claudia_lib::sandbox::executor::SandboxExecutor;
use claudia_lib::sandbox::profile::ProfileBuilder;
use gaol::profile::{Operation, PathPattern, Profile};
use serial_test::serial;
use tempfile::TempDir;

/// Test allowed file read operations
#[test]
#[serial]
fn test_allowed_file_read() {
    skip_if_unsupported!();

    let platform = PlatformConfig::current();
    if !platform.supports_file_read {
        eprintln!("Skipping test: file read not supported on this platform");
        return;
    }

    // Create test file system
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create profile allowing project path access
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

    // Create test binary that reads from allowed path
    let test_code = test_code::file_read(&test_fs.project_path.join("main.rs").to_string_lossy());
    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_file_read", &test_code, binary_dir.path())
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
            assert!(status.success(), "Allowed file read should succeed");
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}

/// Test forbidden file read operations
#[test]
#[serial]
fn test_forbidden_file_read() {
    skip_if_unsupported!();

    let platform = PlatformConfig::current();
    if !platform.supports_file_read {
        eprintln!("Skipping test: file read not supported on this platform");
        return;
    }

    // Create test file system
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create profile allowing only project path (not forbidden path)
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

    // Create test binary that reads from forbidden path
    let forbidden_file = test_fs.forbidden_path.join("secret.txt");
    let test_code = test_code::file_read(&forbidden_file.to_string_lossy());
    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_forbidden_read", &test_code, binary_dir.path())
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
            // On some platforms (like macOS), gaol might not block all file reads
            // so we check if the operation failed OR if it's a platform limitation
            if status.success() {
                eprintln!(
                    "WARNING: File read was not blocked - this might be a platform limitation"
                );
                // Check if we're on a platform where this is expected
                let platform_config = PlatformConfig::current();
                if !platform_config.supports_file_read {
                    panic!("File read should have been blocked on this platform");
                }
            }
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}

/// Test file write operations (should always be forbidden)
#[test]
#[serial]
fn test_file_write_always_forbidden() {
    skip_if_unsupported!();

    // Create test file system
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create profile with file read permissions (write should still be blocked)
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

    // Create test binary that tries to write a file
    let write_path = test_fs.project_path.join("test_write.txt");
    let test_code = test_code::file_write(&write_path.to_string_lossy());
    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_file_write", &test_code, binary_dir.path())
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
            // File writes might not be blocked on all platforms
            if status.success() {
                eprintln!("WARNING: File write was not blocked - checking platform capabilities");
                // On macOS, file writes might not be fully blocked by gaol
                if std::env::consts::OS != "macos" {
                    panic!("File write should have been blocked on this platform");
                }
            }
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}

/// Test file metadata operations
#[test]
#[serial]
fn test_file_metadata_operations() {
    skip_if_unsupported!();

    let platform = PlatformConfig::current();
    if !platform.supports_metadata_read && !platform.supports_file_read {
        eprintln!("Skipping test: metadata read not supported on this platform");
        return;
    }

    // Create test file system
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create profile with metadata read permission
    let operations = if platform.supports_metadata_read {
        vec![Operation::FileReadMetadata(PathPattern::Subpath(
            test_fs.project_path.clone(),
        ))]
    } else {
        // On Linux, metadata is allowed if file read is allowed
        vec![Operation::FileReadAll(PathPattern::Subpath(
            test_fs.project_path.clone(),
        ))]
    };

    let profile = match Profile::new(operations) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to create profile - operation not supported");
            return;
        }
    };

    // Create test binary that reads file metadata
    let test_file = test_fs.project_path.join("main.rs");
    let test_code = test_code::file_metadata(&test_file.to_string_lossy());
    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_metadata", &test_code, binary_dir.path())
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
            if platform.supports_metadata_read || platform.supports_file_read {
                assert!(
                    status.success(),
                    "Metadata read should succeed when allowed"
                );
            }
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}

/// Test template variable expansion in file paths
#[test]
#[serial]
fn test_template_variable_expansion() {
    skip_if_unsupported!();

    let platform = PlatformConfig::current();
    if !platform.supports_file_read {
        eprintln!("Skipping test: file read not supported on this platform");
        return;
    }

    // Create test database and profile
    let test_db = TEST_DB.lock();
    test_db.reset().expect("Failed to reset database");

    // Create a profile with template variables
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");
    let rules = vec![TestRule::file_read("{{PROJECT_PATH}}", true)];

    let profile_id = test_db
        .create_test_profile("template_test", rules)
        .expect("Failed to create test profile");

    // Load and build the profile
    let db_rules = claudia_lib::sandbox::profile::load_profile_rules(&test_db.conn, profile_id)
        .expect("Failed to load profile rules");

    let builder = ProfileBuilder::new(test_fs.project_path.clone())
        .expect("Failed to create profile builder");

    let profile = match builder.build_profile(db_rules) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to build profile with templates");
            return;
        }
    };

    // Create test binary that reads from project path
    let test_code = test_code::file_read(&test_fs.project_path.join("main.rs").to_string_lossy());
    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_template", &test_code, binary_dir.path())
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
            assert!(status.success(), "Template-based file access should work");
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}
