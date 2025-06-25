//! Unit tests for SandboxExecutor
use claudia_lib::sandbox::executor::{should_activate_sandbox, SandboxExecutor};
use gaol::profile::{AddressPattern, Operation, PathPattern, Profile};
use std::env;
use std::path::PathBuf;

/// Create a simple test profile
fn create_test_profile(project_path: PathBuf) -> Profile {
    let operations = vec![
        Operation::FileReadAll(PathPattern::Subpath(project_path)),
        Operation::NetworkOutbound(AddressPattern::All),
    ];

    Profile::new(operations).expect("Failed to create test profile")
}

#[test]
fn test_executor_creation() {
    let project_path = PathBuf::from("/test/project");
    let profile = create_test_profile(project_path.clone());

    let _executor = SandboxExecutor::new(profile, project_path);
    // Executor should be created successfully
}

#[test]
fn test_should_activate_sandbox_env_var() {
    // Test when env var is not set
    env::remove_var("GAOL_SANDBOX_ACTIVE");
    assert!(
        !should_activate_sandbox(),
        "Should not activate when env var is not set"
    );

    // Test when env var is set to "1"
    env::set_var("GAOL_SANDBOX_ACTIVE", "1");
    assert!(
        should_activate_sandbox(),
        "Should activate when env var is '1'"
    );

    // Test when env var is set to other value
    env::set_var("GAOL_SANDBOX_ACTIVE", "0");
    assert!(
        !should_activate_sandbox(),
        "Should not activate when env var is not '1'"
    );

    // Clean up
    env::remove_var("GAOL_SANDBOX_ACTIVE");
}

#[test]
fn test_prepare_sandboxed_command() {
    let project_path = PathBuf::from("/test/project");
    let profile = create_test_profile(project_path.clone());
    let executor = SandboxExecutor::new(profile, project_path.clone());

    let _cmd = executor.prepare_sandboxed_command("echo", &["hello"], &project_path);

    // The command should have sandbox environment variables set
    // Note: We can't easily test Command internals, but we can verify it doesn't panic
}

#[test]
fn test_executor_with_empty_profile() {
    let project_path = PathBuf::from("/test/project");
    let profile = Profile::new(vec![]).expect("Failed to create empty profile");

    let executor = SandboxExecutor::new(profile, project_path.clone());
    let _cmd = executor.prepare_sandboxed_command("echo", &["test"], &project_path);

    // Should handle empty profile gracefully
}

#[test]
fn test_executor_with_complex_profile() {
    let project_path = PathBuf::from("/test/project");
    let operations = vec![
        Operation::FileReadAll(PathPattern::Subpath(project_path.clone())),
        Operation::FileReadAll(PathPattern::Subpath(PathBuf::from("/usr/lib"))),
        Operation::FileReadAll(PathPattern::Literal(PathBuf::from("/etc/hosts"))),
        Operation::FileReadMetadata(PathPattern::Subpath(PathBuf::from("/"))),
        Operation::NetworkOutbound(AddressPattern::All),
        Operation::NetworkOutbound(AddressPattern::Tcp(443)),
        Operation::SystemInfoRead,
    ];

    // Only create profile with supported operations
    let filtered_ops: Vec<_> = operations
        .into_iter()
        .filter(|op| {
            use gaol::profile::{OperationSupport, OperationSupportLevel};
            matches!(op.support(), OperationSupportLevel::CanBeAllowed)
        })
        .collect();

    if !filtered_ops.is_empty() {
        let profile = Profile::new(filtered_ops).expect("Failed to create complex profile");
        let executor = SandboxExecutor::new(profile, project_path.clone());
        let _cmd = executor.prepare_sandboxed_command("echo", &["test"], &project_path);
    }
}

#[test]
fn test_command_environment_setup() {
    let project_path = PathBuf::from("/test/project");
    let profile = create_test_profile(project_path.clone());
    let executor = SandboxExecutor::new(profile, project_path.clone());

    // Test with various arguments
    let _cmd1 = executor.prepare_sandboxed_command("ls", &[], &project_path);
    let _cmd2 = executor.prepare_sandboxed_command("cat", &["file.txt"], &project_path);
    let _cmd3 = executor.prepare_sandboxed_command("grep", &["-r", "pattern", "."], &project_path);

    // Commands should be prepared without panic
}

#[test]
#[cfg(unix)]
fn test_spawn_sandboxed_process() {
    use crate::sandbox::common::is_sandboxing_supported;

    if !is_sandboxing_supported() {
        return;
    }

    let project_path = env::current_dir().unwrap_or_else(|_| PathBuf::from("/tmp"));
    let profile = create_test_profile(project_path.clone());
    let executor = SandboxExecutor::new(profile, project_path.clone());

    // Try to spawn a simple command
    let result = executor.execute_sandboxed_spawn("echo", &["sandbox test"], &project_path);

    // On supported platforms, this should either succeed or fail gracefully
    match result {
        Ok(mut child) => {
            // If spawned successfully, wait for it to complete
            let _ = child.wait();
        }
        Err(e) => {
            // Sandboxing might fail due to permissions or platform limitations
            println!("Sandbox spawn failed (expected in some environments): {e}");
        }
    }
}
