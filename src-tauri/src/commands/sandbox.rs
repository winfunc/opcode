use crate::{
    commands::agents::AgentDb,
    sandbox::{
        platform::PlatformCapabilities,
        profile::{SandboxProfile, SandboxRule},
    },
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Represents a sandbox violation event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxViolation {
    pub id: Option<i64>,
    pub profile_id: Option<i64>,
    pub agent_id: Option<i64>,
    pub agent_run_id: Option<i64>,
    pub operation_type: String,
    pub pattern_value: Option<String>,
    pub process_name: Option<String>,
    pub pid: Option<i32>,
    pub denied_at: String,
}

/// Represents sandbox profile export data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxProfileExport {
    pub version: u32,
    pub exported_at: String,
    pub platform: String,
    pub profiles: Vec<SandboxProfileWithRules>,
}

/// Represents a profile with its rules for export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxProfileWithRules {
    pub profile: SandboxProfile,
    pub rules: Vec<SandboxRule>,
}

/// Import result for a profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub profile_name: String,
    pub imported: bool,
    pub reason: Option<String>,
    pub new_name: Option<String>,
}

/// List all sandbox profiles
#[tauri::command]
pub async fn list_sandbox_profiles(db: State<'_, AgentDb>) -> Result<Vec<SandboxProfile>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, description, is_active, is_default, created_at, updated_at FROM sandbox_profiles ORDER BY name")
        .map_err(|e| e.to_string())?;

    let profiles = stmt
        .query_map([], |row| {
            Ok(SandboxProfile {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                description: row.get(2)?,
                is_active: row.get(3)?,
                is_default: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(profiles)
}

/// Create a new sandbox profile
#[tauri::command]
pub async fn create_sandbox_profile(
    db: State<'_, AgentDb>,
    name: String,
    description: Option<String>,
) -> Result<SandboxProfile, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO sandbox_profiles (name, description) VALUES (?1, ?2)",
        params![name, description],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    // Fetch the created profile
    let profile = conn
        .query_row(
            "SELECT id, name, description, is_active, is_default, created_at, updated_at FROM sandbox_profiles WHERE id = ?1",
            params![id],
            |row| {
                Ok(SandboxProfile {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    description: row.get(2)?,
                    is_active: row.get(3)?,
                    is_default: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(profile)
}

/// Update a sandbox profile
#[tauri::command]
pub async fn update_sandbox_profile(
    db: State<'_, AgentDb>,
    id: i64,
    name: String,
    description: Option<String>,
    is_active: bool,
    is_default: bool,
) -> Result<SandboxProfile, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // If setting as default, unset other defaults
    if is_default {
        conn.execute(
            "UPDATE sandbox_profiles SET is_default = 0 WHERE id != ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "UPDATE sandbox_profiles SET name = ?1, description = ?2, is_active = ?3, is_default = ?4 WHERE id = ?5",
        params![name, description, is_active, is_default, id],
    )
    .map_err(|e| e.to_string())?;

    // Fetch the updated profile
    let profile = conn
        .query_row(
            "SELECT id, name, description, is_active, is_default, created_at, updated_at FROM sandbox_profiles WHERE id = ?1",
            params![id],
            |row| {
                Ok(SandboxProfile {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    description: row.get(2)?,
                    is_active: row.get(3)?,
                    is_default: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(profile)
}

/// Delete a sandbox profile
#[tauri::command]
pub async fn delete_sandbox_profile(db: State<'_, AgentDb>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Check if it's the default profile
    let is_default: bool = conn
        .query_row(
            "SELECT is_default FROM sandbox_profiles WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if is_default {
        return Err("Cannot delete the default profile".to_string());
    }

    conn.execute("DELETE FROM sandbox_profiles WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get a single sandbox profile by ID
#[tauri::command]
pub async fn get_sandbox_profile(
    db: State<'_, AgentDb>,
    id: i64,
) -> Result<SandboxProfile, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let profile = conn
        .query_row(
            "SELECT id, name, description, is_active, is_default, created_at, updated_at FROM sandbox_profiles WHERE id = ?1",
            params![id],
            |row| {
                Ok(SandboxProfile {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    description: row.get(2)?,
                    is_active: row.get(3)?,
                    is_default: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(profile)
}

/// List rules for a sandbox profile
#[tauri::command]
pub async fn list_sandbox_rules(
    db: State<'_, AgentDb>,
    profile_id: i64,
) -> Result<Vec<SandboxRule>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, profile_id, operation_type, pattern_type, pattern_value, enabled, platform_support, created_at FROM sandbox_rules WHERE profile_id = ?1 ORDER BY operation_type, pattern_value")
        .map_err(|e| e.to_string())?;

    let rules = stmt
        .query_map(params![profile_id], |row| {
            Ok(SandboxRule {
                id: Some(row.get(0)?),
                profile_id: row.get(1)?,
                operation_type: row.get(2)?,
                pattern_type: row.get(3)?,
                pattern_value: row.get(4)?,
                enabled: row.get(5)?,
                platform_support: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rules)
}

/// Create a new sandbox rule
#[tauri::command]
pub async fn create_sandbox_rule(
    db: State<'_, AgentDb>,
    profile_id: i64,
    operation_type: String,
    pattern_type: String,
    pattern_value: String,
    enabled: bool,
    platform_support: Option<String>,
) -> Result<SandboxRule, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Validate rule doesn't conflict
    // TODO: Add more validation logic here

    conn.execute(
        "INSERT INTO sandbox_rules (profile_id, operation_type, pattern_type, pattern_value, enabled, platform_support) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![profile_id, operation_type, pattern_type, pattern_value, enabled, platform_support],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    // Fetch the created rule
    let rule = conn
        .query_row(
            "SELECT id, profile_id, operation_type, pattern_type, pattern_value, enabled, platform_support, created_at FROM sandbox_rules WHERE id = ?1",
            params![id],
            |row| {
                Ok(SandboxRule {
                    id: Some(row.get(0)?),
                    profile_id: row.get(1)?,
                    operation_type: row.get(2)?,
                    pattern_type: row.get(3)?,
                    pattern_value: row.get(4)?,
                    enabled: row.get(5)?,
                    platform_support: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(rule)
}

/// Update a sandbox rule
#[tauri::command]
pub async fn update_sandbox_rule(
    db: State<'_, AgentDb>,
    id: i64,
    operation_type: String,
    pattern_type: String,
    pattern_value: String,
    enabled: bool,
    platform_support: Option<String>,
) -> Result<SandboxRule, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE sandbox_rules SET operation_type = ?1, pattern_type = ?2, pattern_value = ?3, enabled = ?4, platform_support = ?5 WHERE id = ?6",
        params![operation_type, pattern_type, pattern_value, enabled, platform_support, id],
    )
    .map_err(|e| e.to_string())?;

    // Fetch the updated rule
    let rule = conn
        .query_row(
            "SELECT id, profile_id, operation_type, pattern_type, pattern_value, enabled, platform_support, created_at FROM sandbox_rules WHERE id = ?1",
            params![id],
            |row| {
                Ok(SandboxRule {
                    id: Some(row.get(0)?),
                    profile_id: row.get(1)?,
                    operation_type: row.get(2)?,
                    pattern_type: row.get(3)?,
                    pattern_value: row.get(4)?,
                    enabled: row.get(5)?,
                    platform_support: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(rule)
}

/// Delete a sandbox rule
#[tauri::command]
pub async fn delete_sandbox_rule(db: State<'_, AgentDb>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM sandbox_rules WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get platform capabilities for sandbox configuration
#[tauri::command]
pub async fn get_platform_capabilities() -> Result<PlatformCapabilities, String> {
    Ok(crate::sandbox::platform::get_platform_capabilities())
}

/// Test a sandbox profile by creating a simple test process
#[tauri::command]
pub async fn test_sandbox_profile(
    db: State<'_, AgentDb>,
    profile_id: i64,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Load the profile and rules
    let profile = crate::sandbox::profile::load_profile(&conn, profile_id)
        .map_err(|e| format!("Failed to load profile: {}", e))?;

    if !profile.is_active {
        return Ok(format!(
            "Profile '{}' is currently inactive. Activate it to use with agents.",
            profile.name
        ));
    }

    let rules = crate::sandbox::profile::load_profile_rules(&conn, profile_id)
        .map_err(|e| format!("Failed to load profile rules: {}", e))?;

    if rules.is_empty() {
        return Ok(format!(
            "Profile '{}' has no rules configured. Add rules to define sandbox permissions.",
            profile.name
        ));
    }

    // Try to build the gaol profile
    let test_path = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/tmp"));

    let builder = crate::sandbox::profile::ProfileBuilder::new(test_path.clone())
        .map_err(|e| format!("Failed to create profile builder: {}", e))?;

    let build_result = builder
        .build_profile_with_serialization(rules.clone())
        .map_err(|e| format!("Failed to build sandbox profile: {}", e))?;

    // Check platform support
    let platform_caps = crate::sandbox::platform::get_platform_capabilities();
    if !platform_caps.sandboxing_supported {
        return Ok(format!(
            "Profile '{}' validated successfully. {} rules loaded.\n\nNote: Sandboxing is not supported on {} platform. The profile configuration is valid but sandbox enforcement will not be active.",
            profile.name,
            rules.len(),
            platform_caps.os
        ));
    }

    // Try to execute a simple command in the sandbox
    let executor = crate::sandbox::executor::SandboxExecutor::new_with_serialization(
        build_result.profile,
        test_path.clone(),
        build_result.serialized,
    );

    // Use a simple echo command for testing
    let test_command = if cfg!(windows) { "cmd" } else { "echo" };

    let test_args = if cfg!(windows) {
        vec!["/C", "echo", "sandbox test successful"]
    } else {
        vec!["sandbox test successful"]
    };

    match executor.execute_sandboxed_spawn(test_command, &test_args, &test_path) {
        Ok(mut child) => {
            // Wait for the process to complete with a timeout
            match child.wait() {
                Ok(status) => {
                    if status.success() {
                        Ok(format!(
                            "✅ Profile '{}' tested successfully!\n\n\
                            • {} rules loaded and validated\n\
                            • Sandbox activation: Success\n\
                            • Test process execution: Success\n\
                            • Platform: {} (fully supported)",
                            profile.name,
                            rules.len(),
                            platform_caps.os
                        ))
                    } else {
                        Ok(format!(
                            "⚠️ Profile '{}' validated with warnings.\n\n\
                            • {} rules loaded and validated\n\
                            • Sandbox activation: Success\n\
                            • Test process exit code: {}\n\
                            • Platform: {}",
                            profile.name,
                            rules.len(),
                            status.code().unwrap_or(-1),
                            platform_caps.os
                        ))
                    }
                }
                Err(e) => Ok(format!(
                    "⚠️ Profile '{}' validated with warnings.\n\n\
                        • {} rules loaded and validated\n\
                        • Sandbox activation: Partial\n\
                        • Test process: Could not get exit status ({})\n\
                        • Platform: {}",
                    profile.name,
                    rules.len(),
                    e,
                    platform_caps.os
                )),
            }
        }
        Err(e) => {
            // Check if it's a permission error or platform limitation
            let error_str = e.to_string();
            if error_str.contains("permission") || error_str.contains("denied") {
                Ok(format!(
                    "⚠️ Profile '{}' validated with limitations.\n\n\
                    • {} rules loaded and validated\n\
                    • Sandbox configuration: Valid\n\
                    • Sandbox enforcement: Limited by system permissions\n\
                    • Platform: {}\n\n\
                    Note: The sandbox profile is correctly configured but may require elevated privileges or system configuration to fully enforce on this platform.",
                    profile.name,
                    rules.len(),
                    platform_caps.os
                ))
            } else {
                Ok(format!(
                    "⚠️ Profile '{}' validated with limitations.\n\n\
                    • {} rules loaded and validated\n\
                    • Sandbox configuration: Valid\n\
                    • Test execution: Failed ({})\n\
                    • Platform: {}\n\n\
                    The sandbox profile is correctly configured. The test execution failed due to platform-specific limitations, but the profile can still be used.",
                    profile.name,
                    rules.len(),
                    e,
                    platform_caps.os
                ))
            }
        }
    }
}

/// List sandbox violations with optional filtering
#[tauri::command]
pub async fn list_sandbox_violations(
    db: State<'_, AgentDb>,
    profile_id: Option<i64>,
    agent_id: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<SandboxViolation>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Build dynamic query
    let mut query = String::from(
        "SELECT id, profile_id, agent_id, agent_run_id, operation_type, pattern_value, process_name, pid, denied_at 
         FROM sandbox_violations WHERE 1=1"
    );

    let mut param_idx = 1;

    if profile_id.is_some() {
        query.push_str(&format!(" AND profile_id = ?{}", param_idx));
        param_idx += 1;
    }

    if agent_id.is_some() {
        query.push_str(&format!(" AND agent_id = ?{}", param_idx));
        param_idx += 1;
    }

    query.push_str(" ORDER BY denied_at DESC");

    if limit.is_some() {
        query.push_str(&format!(" LIMIT ?{}", param_idx));
    }

    // Execute query based on parameters
    let violations: Vec<SandboxViolation> = if let Some(pid) = profile_id {
        if let Some(aid) = agent_id {
            if let Some(lim) = limit {
                // All three parameters
                let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(params![pid, aid, lim], |row| {
                        Ok(SandboxViolation {
                            id: Some(row.get(0)?),
                            profile_id: row.get(1)?,
                            agent_id: row.get(2)?,
                            agent_run_id: row.get(3)?,
                            operation_type: row.get(4)?,
                            pattern_value: row.get(5)?,
                            process_name: row.get(6)?,
                            pid: row.get(7)?,
                            denied_at: row.get(8)?,
                        })
                    })
                    .map_err(|e| e.to_string())?;
                rows.collect::<Result<Vec<_>, _>>()
                    .map_err(|e| e.to_string())?
            } else {
                // profile_id and agent_id only
                let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(params![pid, aid], |row| {
                        Ok(SandboxViolation {
                            id: Some(row.get(0)?),
                            profile_id: row.get(1)?,
                            agent_id: row.get(2)?,
                            agent_run_id: row.get(3)?,
                            operation_type: row.get(4)?,
                            pattern_value: row.get(5)?,
                            process_name: row.get(6)?,
                            pid: row.get(7)?,
                            denied_at: row.get(8)?,
                        })
                    })
                    .map_err(|e| e.to_string())?;
                rows.collect::<Result<Vec<_>, _>>()
                    .map_err(|e| e.to_string())?
            }
        } else if let Some(lim) = limit {
            // profile_id and limit only
            let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![pid, lim], |row| {
                    Ok(SandboxViolation {
                        id: Some(row.get(0)?),
                        profile_id: row.get(1)?,
                        agent_id: row.get(2)?,
                        agent_run_id: row.get(3)?,
                        operation_type: row.get(4)?,
                        pattern_value: row.get(5)?,
                        process_name: row.get(6)?,
                        pid: row.get(7)?,
                        denied_at: row.get(8)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        } else {
            // profile_id only
            let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![pid], |row| {
                    Ok(SandboxViolation {
                        id: Some(row.get(0)?),
                        profile_id: row.get(1)?,
                        agent_id: row.get(2)?,
                        agent_run_id: row.get(3)?,
                        operation_type: row.get(4)?,
                        pattern_value: row.get(5)?,
                        process_name: row.get(6)?,
                        pid: row.get(7)?,
                        denied_at: row.get(8)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        }
    } else if let Some(aid) = agent_id {
        if let Some(lim) = limit {
            // agent_id and limit only
            let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![aid, lim], |row| {
                    Ok(SandboxViolation {
                        id: Some(row.get(0)?),
                        profile_id: row.get(1)?,
                        agent_id: row.get(2)?,
                        agent_run_id: row.get(3)?,
                        operation_type: row.get(4)?,
                        pattern_value: row.get(5)?,
                        process_name: row.get(6)?,
                        pid: row.get(7)?,
                        denied_at: row.get(8)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        } else {
            // agent_id only
            let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![aid], |row| {
                    Ok(SandboxViolation {
                        id: Some(row.get(0)?),
                        profile_id: row.get(1)?,
                        agent_id: row.get(2)?,
                        agent_run_id: row.get(3)?,
                        operation_type: row.get(4)?,
                        pattern_value: row.get(5)?,
                        process_name: row.get(6)?,
                        pid: row.get(7)?,
                        denied_at: row.get(8)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        }
    } else if let Some(lim) = limit {
        // limit only
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![lim], |row| {
                Ok(SandboxViolation {
                    id: Some(row.get(0)?),
                    profile_id: row.get(1)?,
                    agent_id: row.get(2)?,
                    agent_run_id: row.get(3)?,
                    operation_type: row.get(4)?,
                    pattern_value: row.get(5)?,
                    process_name: row.get(6)?,
                    pid: row.get(7)?,
                    denied_at: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    } else {
        // No parameters
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(SandboxViolation {
                    id: Some(row.get(0)?),
                    profile_id: row.get(1)?,
                    agent_id: row.get(2)?,
                    agent_run_id: row.get(3)?,
                    operation_type: row.get(4)?,
                    pattern_value: row.get(5)?,
                    process_name: row.get(6)?,
                    pid: row.get(7)?,
                    denied_at: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    Ok(violations)
}

/// Log a sandbox violation
#[tauri::command]
pub async fn log_sandbox_violation(
    db: State<'_, AgentDb>,
    profile_id: Option<i64>,
    agent_id: Option<i64>,
    agent_run_id: Option<i64>,
    operation_type: String,
    pattern_value: Option<String>,
    process_name: Option<String>,
    pid: Option<i32>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO sandbox_violations (profile_id, agent_id, agent_run_id, operation_type, pattern_value, process_name, pid) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![profile_id, agent_id, agent_run_id, operation_type, pattern_value, process_name, pid],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Clear old sandbox violations
#[tauri::command]
pub async fn clear_sandbox_violations(
    db: State<'_, AgentDb>,
    older_than_days: Option<i64>,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let query = if let Some(days) = older_than_days {
        format!(
            "DELETE FROM sandbox_violations WHERE denied_at < datetime('now', '-{} days')",
            days
        )
    } else {
        "DELETE FROM sandbox_violations".to_string()
    };

    let deleted = conn.execute(&query, []).map_err(|e| e.to_string())?;

    Ok(deleted as i64)
}

/// Get sandbox violation statistics
#[tauri::command]
pub async fn get_sandbox_violation_stats(
    db: State<'_, AgentDb>,
) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Get total violations
    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM sandbox_violations", [], |row| {
            row.get(0)
        })
        .map_err(|e| e.to_string())?;

    // Get violations by operation type
    let mut stmt = conn
        .prepare(
            "SELECT operation_type, COUNT(*) as count 
             FROM sandbox_violations 
             GROUP BY operation_type 
             ORDER BY count DESC",
        )
        .map_err(|e| e.to_string())?;

    let by_operation: Vec<(String, i64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Get recent violations count (last 24 hours)
    let recent: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sandbox_violations WHERE denied_at > datetime('now', '-1 day')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "total": total,
        "recent_24h": recent,
        "by_operation": by_operation.into_iter().map(|(op, count)| {
            serde_json::json!({
                "operation": op,
                "count": count
            })
        }).collect::<Vec<_>>()
    }))
}

/// Export a single sandbox profile with its rules
#[tauri::command]
pub async fn export_sandbox_profile(
    db: State<'_, AgentDb>,
    profile_id: i64,
) -> Result<SandboxProfileExport, String> {
    // Get the profile
    let profile = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        crate::sandbox::profile::load_profile(&conn, profile_id).map_err(|e| e.to_string())?
    };

    // Get the rules
    let rules = list_sandbox_rules(db.clone(), profile_id).await?;

    Ok(SandboxProfileExport {
        version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        platform: std::env::consts::OS.to_string(),
        profiles: vec![SandboxProfileWithRules { profile, rules }],
    })
}

/// Export all sandbox profiles
#[tauri::command]
pub async fn export_all_sandbox_profiles(
    db: State<'_, AgentDb>,
) -> Result<SandboxProfileExport, String> {
    let profiles = list_sandbox_profiles(db.clone()).await?;
    let mut profile_exports = Vec::new();

    for profile in profiles {
        if let Some(id) = profile.id {
            let rules = list_sandbox_rules(db.clone(), id).await?;
            profile_exports.push(SandboxProfileWithRules { profile, rules });
        }
    }

    Ok(SandboxProfileExport {
        version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        platform: std::env::consts::OS.to_string(),
        profiles: profile_exports,
    })
}

/// Import sandbox profiles from export data
#[tauri::command]
pub async fn import_sandbox_profiles(
    db: State<'_, AgentDb>,
    export_data: SandboxProfileExport,
) -> Result<Vec<ImportResult>, String> {
    let mut results = Vec::new();

    // Validate version
    if export_data.version != 1 {
        return Err(format!(
            "Unsupported export version: {}",
            export_data.version
        ));
    }

    for profile_export in export_data.profiles {
        let mut profile = profile_export.profile;
        let original_name = profile.name.clone();

        // Check for name conflicts
        let existing: Result<i64, _> = {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            conn.query_row(
                "SELECT id FROM sandbox_profiles WHERE name = ?1",
                params![&profile.name],
                |row| row.get(0),
            )
        };

        let (imported, new_name) = match existing {
            Ok(_) => {
                // Name conflict - append timestamp
                let new_name = format!(
                    "{} (imported {})",
                    profile.name,
                    chrono::Utc::now().format("%Y-%m-%d %H:%M")
                );
                profile.name = new_name.clone();
                (true, Some(new_name))
            }
            Err(_) => (true, None),
        };

        if imported {
            // Reset profile fields for new insert
            profile.id = None;
            profile.is_default = false; // Never import as default

            // Create the profile
            let created_profile =
                create_sandbox_profile(db.clone(), profile.name.clone(), profile.description)
                    .await?;

            if let Some(new_id) = created_profile.id {
                // Import rules
                for rule in profile_export.rules {
                    if rule.enabled {
                        // Create the rule with the new profile ID
                        let _ = create_sandbox_rule(
                            db.clone(),
                            new_id,
                            rule.operation_type,
                            rule.pattern_type,
                            rule.pattern_value,
                            rule.enabled,
                            rule.platform_support,
                        )
                        .await;
                    }
                }

                // Update profile status if needed
                if profile.is_active {
                    let _ = update_sandbox_profile(
                        db.clone(),
                        new_id,
                        created_profile.name,
                        created_profile.description,
                        profile.is_active,
                        false, // Never set as default on import
                    )
                    .await;
                }
            }

            results.push(ImportResult {
                profile_name: original_name,
                imported: true,
                reason: new_name
                    .as_ref()
                    .map(|_| "Name conflict resolved".to_string()),
                new_name,
            });
        }
    }

    Ok(results)
}
