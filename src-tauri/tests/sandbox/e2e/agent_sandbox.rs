//! End-to-end tests for agent execution with sandbox profiles
use crate::sandbox::common::*;
use crate::skip_if_unsupported;
use serial_test::serial;

/// Test agent execution with minimal sandbox profile
#[test]
#[serial]
fn test_agent_with_minimal_profile() {
    skip_if_unsupported!();

    // Create test environment
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");
    let test_db = TEST_DB.lock();
    test_db.reset().expect("Failed to reset database");

    // Create minimal sandbox profile
    let rules = profiles::minimal(&test_fs.project_path.to_string_lossy());
    let profile_id = test_db
        .create_test_profile("minimal_agent_test", rules)
        .expect("Failed to create test profile");

    // Create test agent
    test_db.conn.execute(
        "INSERT INTO agents (name, icon, system_prompt, model, sandbox_profile_id) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            "Test Agent",
            "🤖",
            "You are a test agent. Only perform the requested task.",
            "sonnet",
            profile_id
        ],
    ).expect("Failed to create agent");

    let _agent_id = test_db.conn.last_insert_rowid();

    // Execute real Claude command with minimal profile
    let result = execute_claude_task(
        &test_fs.project_path,
        &tasks::multi_operation(),
        Some("You are a test agent. Only perform the requested task."),
        Some("sonnet"),
        Some(profile_id),
        20, // 20 second timeout
    )
    .expect("Failed to execute Claude command");

    // Debug output
    eprintln!("=== Claude Output ===");
    eprintln!("Exit code: {}", result.exit_code);
    eprintln!("STDOUT:\n{}", result.stdout);
    eprintln!("STDERR:\n{}", result.stderr);
    eprintln!("Duration: {:?}", result.duration);
    eprintln!("===================");

    // Basic verification - just check Claude ran
    assert!(
        result.exit_code == 0 || result.exit_code == 124, // 0 = success, 124 = timeout
        "Claude should execute (exit code: {})",
        result.exit_code
    );
}

/// Test agent execution with standard sandbox profile
#[test]
#[serial]
fn test_agent_with_standard_profile() {
    skip_if_unsupported!();

    // Create test environment
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");
    let test_db = TEST_DB.lock();
    test_db.reset().expect("Failed to reset database");

    // Create standard sandbox profile
    let rules = profiles::standard(&test_fs.project_path.to_string_lossy());
    let profile_id = test_db
        .create_test_profile("standard_agent_test", rules)
        .expect("Failed to create test profile");

    // Create test agent
    test_db.conn.execute(
        "INSERT INTO agents (name, icon, system_prompt, model, sandbox_profile_id) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            "Standard Agent",
            "🔧",
            "You are a test agent with standard permissions.",
            "sonnet",
            profile_id
        ],
    ).expect("Failed to create agent");

    let _agent_id = test_db.conn.last_insert_rowid();

    // Execute real Claude command with standard profile
    let result = execute_claude_task(
        &test_fs.project_path,
        &tasks::multi_operation(),
        Some("You are a test agent with standard permissions."),
        Some("sonnet"),
        Some(profile_id),
        20, // 20 second timeout
    )
    .expect("Failed to execute Claude command");

    // Debug output
    eprintln!("=== Claude Output (Standard Profile) ===");
    eprintln!("Exit code: {}", result.exit_code);
    eprintln!("STDOUT:\n{}", result.stdout);
    eprintln!("STDERR:\n{}", result.stderr);
    eprintln!("===================");

    // Basic verification
    assert!(
        result.exit_code == 0 || result.exit_code == 124,
        "Claude should execute with standard profile (exit code: {})",
        result.exit_code
    );
}

/// Test agent execution without sandbox (control test)
#[test]
#[serial]
fn test_agent_without_sandbox() {
    skip_if_unsupported!();

    // Create test environment
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");
    let test_db = TEST_DB.lock();
    test_db.reset().expect("Failed to reset database");

    // Create agent without sandbox profile
    test_db
        .conn
        .execute(
            "INSERT INTO agents (name, icon, system_prompt, model) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                "Unsandboxed Agent",
                "⚠️",
                "You are a test agent without sandbox restrictions.",
                "sonnet"
            ],
        )
        .expect("Failed to create agent");

    let _agent_id = test_db.conn.last_insert_rowid();

    // Execute real Claude command without sandbox profile
    let result = execute_claude_task(
        &test_fs.project_path,
        &tasks::multi_operation(),
        Some("You are a test agent without sandbox restrictions."),
        Some("sonnet"),
        None, // No sandbox profile
        20,   // 20 second timeout
    )
    .expect("Failed to execute Claude command");

    // Debug output
    eprintln!("=== Claude Output (No Sandbox) ===");
    eprintln!("Exit code: {}", result.exit_code);
    eprintln!("STDOUT:\n{}", result.stdout);
    eprintln!("STDERR:\n{}", result.stderr);
    eprintln!("===================");

    // Basic verification
    assert!(
        result.exit_code == 0 || result.exit_code == 124,
        "Claude should execute without sandbox (exit code: {})",
        result.exit_code
    );
}

/// Test agent run violation logging
#[test]
#[serial]
fn test_agent_run_violation_logging() {
    skip_if_unsupported!();

    // Create test environment
    let test_db = TEST_DB.lock();
    test_db.reset().expect("Failed to reset database");

    // Create a test profile first
    let profile_id = test_db
        .create_test_profile("violation_test", vec![])
        .expect("Failed to create test profile");

    // Create a test agent
    test_db.conn.execute(
        "INSERT INTO agents (name, icon, system_prompt, model, sandbox_profile_id) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            "Violation Test Agent",
            "⚠️",
            "Test agent for violation logging.",
            "sonnet",
            profile_id
        ],
    ).expect("Failed to create agent");

    let agent_id = test_db.conn.last_insert_rowid();

    // Create a test agent run
    test_db.conn.execute(
        "INSERT INTO agent_runs (agent_id, agent_name, agent_icon, task, model, project_path) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            agent_id,
            "Violation Test Agent",
            "⚠️",
            "Test task",
            "sonnet",
            "/test/path"
        ],
    ).expect("Failed to create agent run");

    let agent_run_id = test_db.conn.last_insert_rowid();

    // Insert test violations
    test_db.conn.execute(
        "INSERT INTO sandbox_violations (profile_id, agent_id, agent_run_id, operation_type, pattern_value) 
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![profile_id, agent_id, agent_run_id, "file_read_all", "/etc/passwd"],
    ).expect("Failed to insert violation");

    // Query violations
    let count: i64 = test_db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM sandbox_violations WHERE agent_id = ?1",
            rusqlite::params![agent_id],
            |row| row.get(0),
        )
        .expect("Failed to query violations");

    assert_eq!(count, 1, "Should have recorded one violation");
}

/// Test profile switching between agent runs
#[test]
#[serial]
fn test_profile_switching() {
    skip_if_unsupported!();

    // Create test environment
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");
    let test_db = TEST_DB.lock();
    test_db.reset().expect("Failed to reset database");

    // Create two different profiles
    let minimal_rules = profiles::minimal(&test_fs.project_path.to_string_lossy());
    let minimal_id = test_db
        .create_test_profile("minimal_switch", minimal_rules)
        .expect("Failed to create minimal profile");

    let standard_rules = profiles::standard(&test_fs.project_path.to_string_lossy());
    let standard_id = test_db
        .create_test_profile("standard_switch", standard_rules)
        .expect("Failed to create standard profile");

    // Create agent initially with minimal profile
    test_db.conn.execute(
        "INSERT INTO agents (name, icon, system_prompt, model, sandbox_profile_id) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            "Switchable Agent",
            "🔄",
            "Test agent for profile switching.",
            "sonnet",
            minimal_id
        ],
    ).expect("Failed to create agent");

    let agent_id = test_db.conn.last_insert_rowid();

    // Update agent to use standard profile
    test_db
        .conn
        .execute(
            "UPDATE agents SET sandbox_profile_id = ?1 WHERE id = ?2",
            rusqlite::params![standard_id, agent_id],
        )
        .expect("Failed to update agent profile");

    // Verify profile was updated
    let current_profile: i64 = test_db
        .conn
        .query_row(
            "SELECT sandbox_profile_id FROM agents WHERE id = ?1",
            rusqlite::params![agent_id],
            |row| row.get(0),
        )
        .expect("Failed to query agent profile");

    assert_eq!(current_profile, standard_id, "Profile should be updated");
}
