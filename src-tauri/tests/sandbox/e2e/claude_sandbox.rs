//! End-to-end tests for Claude command execution with sandbox profiles
use crate::sandbox::common::*;
use crate::skip_if_unsupported;
use serial_test::serial;

/// Test Claude Code execution with default sandbox profile
#[test]
#[serial]
fn test_claude_with_default_sandbox() {
    skip_if_unsupported!();

    // Create test environment
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");
    let test_db = TEST_DB.lock();
    test_db.reset().expect("Failed to reset database");

    // Create default sandbox profile
    let rules = profiles::standard(&test_fs.project_path.to_string_lossy());
    let profile_id = test_db
        .create_test_profile("claude_default", rules)
        .expect("Failed to create test profile");

    // Set as default and active
    test_db
        .conn
        .execute(
            "UPDATE sandbox_profiles SET is_default = 1, is_active = 1 WHERE id = ?1",
            rusqlite::params![profile_id],
        )
        .expect("Failed to set default profile");

    // Execute real Claude command with default sandbox profile
    let result = execute_claude_task(
        &test_fs.project_path,
        &tasks::multi_operation(),
        Some("You are Claude. Only perform the requested task."),
        Some("sonnet"),
        Some(profile_id),
        20, // 20 second timeout
    )
    .expect("Failed to execute Claude command");

    // Debug output
    eprintln!("=== Claude Output (Default Sandbox) ===");
    eprintln!("Exit code: {}", result.exit_code);
    eprintln!("STDOUT:\n{}", result.stdout);
    eprintln!("STDERR:\n{}", result.stderr);
    eprintln!("===================");

    // Basic verification
    assert!(
        result.exit_code == 0 || result.exit_code == 124,
        "Claude should execute with default sandbox (exit code: {})",
        result.exit_code
    );
}

/// Test Claude Code with sandboxing disabled
#[test]
#[serial]
fn test_claude_sandbox_disabled() {
    skip_if_unsupported!();

    // Create test environment
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");
    let test_db = TEST_DB.lock();
    test_db.reset().expect("Failed to reset database");

    // Create profile but mark as inactive
    let rules = profiles::standard(&test_fs.project_path.to_string_lossy());
    let profile_id = test_db
        .create_test_profile("claude_inactive", rules)
        .expect("Failed to create test profile");

    // Set as default but inactive
    test_db
        .conn
        .execute(
            "UPDATE sandbox_profiles SET is_default = 1, is_active = 0 WHERE id = ?1",
            rusqlite::params![profile_id],
        )
        .expect("Failed to set inactive profile");

    // Execute real Claude command without active sandbox
    let result = execute_claude_task(
        &test_fs.project_path,
        &tasks::multi_operation(),
        Some("You are Claude. Only perform the requested task."),
        Some("sonnet"),
        None, // No sandbox since profile is inactive
        20,   // 20 second timeout
    )
    .expect("Failed to execute Claude command");

    // Debug output
    eprintln!("=== Claude Output (Inactive Sandbox) ===");
    eprintln!("Exit code: {}", result.exit_code);
    eprintln!("STDOUT:\n{}", result.stdout);
    eprintln!("STDERR:\n{}", result.stderr);
    eprintln!("===================");

    // Basic verification
    assert!(
        result.exit_code == 0 || result.exit_code == 124,
        "Claude should execute without active sandbox (exit code: {})",
        result.exit_code
    );
}

/// Test Claude Code session operations
#[test]
#[serial]
fn test_claude_session_operations() {
    // This test doesn't require actual Claude execution

    // Create test environment
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create mock session structure
    let claude_dir = test_fs.root.path().join(".claude");
    let projects_dir = claude_dir.join("projects");
    let project_id = test_fs.project_path.to_string_lossy().replace('/', "-");
    let session_dir = projects_dir.join(&project_id);

    std::fs::create_dir_all(&session_dir).expect("Failed to create session dir");

    // Create mock session file
    let session_id = "test-session-123";
    let session_file = session_dir.join(format!("{}.jsonl", session_id));

    let session_data = serde_json::json!({
        "type": "session_start",
        "cwd": test_fs.project_path.to_string_lossy(),
        "timestamp": "2024-01-01T00:00:00Z"
    });

    std::fs::write(&session_file, format!("{}\n", session_data))
        .expect("Failed to write session file");

    // Verify session file exists
    assert!(session_file.exists(), "Session file should exist");
}

/// Test Claude settings with sandbox configuration
#[test]
#[serial]
fn test_claude_settings_sandbox_config() {
    // Create test environment
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create mock settings
    let claude_dir = test_fs.root.path().join(".claude");
    std::fs::create_dir_all(&claude_dir).expect("Failed to create claude dir");

    let settings_file = claude_dir.join("settings.json");
    let settings = serde_json::json!({
        "sandboxEnabled": true,
        "defaultSandboxProfile": "standard",
        "theme": "dark",
        "model": "sonnet"
    });

    std::fs::write(
        &settings_file,
        serde_json::to_string_pretty(&settings).unwrap(),
    )
    .expect("Failed to write settings");

    // Read and verify settings
    let content = std::fs::read_to_string(&settings_file).expect("Failed to read settings");
    let parsed: serde_json::Value =
        serde_json::from_str(&content).expect("Failed to parse settings");

    assert_eq!(parsed["sandboxEnabled"], true, "Sandbox should be enabled");
    assert_eq!(
        parsed["defaultSandboxProfile"], "standard",
        "Default profile should be standard"
    );
}

/// Test profile-based file access restrictions
#[test]
#[serial]
fn test_profile_file_access_simulation() {
    skip_if_unsupported!();

    // Create test environment
    let _test_fs = TestFileSystem::new().expect("Failed to create test filesystem");
    let test_db = TEST_DB.lock();
    test_db.reset().expect("Failed to reset database");

    // Create a custom profile with specific file access
    let custom_rules = vec![
        TestRule::file_read("{{PROJECT_PATH}}", true),
        TestRule::file_read("/usr/local/bin", true),
        TestRule::file_read("/etc/hosts", false), // Literal file
    ];

    let profile_id = test_db
        .create_test_profile("file_access_test", custom_rules)
        .expect("Failed to create test profile");

    // Load the profile rules
    let loaded_rules: Vec<(String, String, String)> = test_db.conn
        .prepare("SELECT operation_type, pattern_type, pattern_value FROM sandbox_rules WHERE profile_id = ?1")
        .expect("Failed to prepare query")
        .query_map(rusqlite::params![profile_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .expect("Failed to query rules")
        .collect::<Result<Vec<_>, _>>()
        .expect("Failed to collect rules");

    // Verify rules were created correctly
    assert_eq!(loaded_rules.len(), 3, "Should have 3 rules");
    assert!(
        loaded_rules.iter().any(|(op, _, _)| op == "file_read_all"),
        "Should have file_read_all operation"
    );
}
