use crate::sandbox::profile::{SandboxProfile, SandboxRule};
use rusqlite::{params, Connection, Result};

/// Create default sandbox profiles for initial setup
pub fn create_default_profiles(conn: &Connection) -> Result<()> {
    // Check if we already have profiles
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM sandbox_profiles", [], |row| {
        row.get(0)
    })?;

    if count > 0 {
        // Already have profiles, don't create defaults
        return Ok(());
    }

    // Create Standard Profile
    create_standard_profile(conn)?;

    // Create Minimal Profile
    create_minimal_profile(conn)?;

    // Create Development Profile
    create_development_profile(conn)?;

    Ok(())
}

fn create_standard_profile(conn: &Connection) -> Result<()> {
    // Insert profile
    conn.execute(
        "INSERT INTO sandbox_profiles (name, description, is_active, is_default) VALUES (?1, ?2, ?3, ?4)",
        params![
            "Standard",
            "Standard sandbox profile with balanced permissions for most use cases",
            true,
            true  // Set as default
        ],
    )?;

    let profile_id = conn.last_insert_rowid();

    // Add rules
    let rules = vec![
        // File access
        (
            "file_read_all",
            "subpath",
            "{{PROJECT_PATH}}",
            true,
            Some(r#"["linux", "macos"]"#),
        ),
        (
            "file_read_all",
            "subpath",
            "/usr/lib",
            true,
            Some(r#"["linux", "macos"]"#),
        ),
        (
            "file_read_all",
            "subpath",
            "/usr/local/lib",
            true,
            Some(r#"["linux", "macos"]"#),
        ),
        (
            "file_read_all",
            "subpath",
            "/System/Library",
            true,
            Some(r#"["macos"]"#),
        ),
        (
            "file_read_metadata",
            "subpath",
            "/",
            true,
            Some(r#"["macos"]"#),
        ),
        // Network access
        (
            "network_outbound",
            "all",
            "",
            true,
            Some(r#"["linux", "macos"]"#),
        ),
    ];

    for (op_type, pattern_type, pattern_value, enabled, platforms) in rules {
        conn.execute(
            "INSERT INTO sandbox_rules (profile_id, operation_type, pattern_type, pattern_value, enabled, platform_support) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![profile_id, op_type, pattern_type, pattern_value, enabled, platforms],
        )?;
    }

    Ok(())
}

fn create_minimal_profile(conn: &Connection) -> Result<()> {
    // Insert profile
    conn.execute(
        "INSERT INTO sandbox_profiles (name, description, is_active, is_default) VALUES (?1, ?2, ?3, ?4)",
        params![
            "Minimal",
            "Minimal sandbox profile with only project directory access",
            true,
            false
        ],
    )?;

    let profile_id = conn.last_insert_rowid();

    // Add minimal rules - only project access
    conn.execute(
        "INSERT INTO sandbox_rules (profile_id, operation_type, pattern_type, pattern_value, enabled, platform_support) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            profile_id, 
            "file_read_all", 
            "subpath", 
            "{{PROJECT_PATH}}", 
            true, 
            Some(r#"["linux", "macos", "windows"]"#)
        ],
    )?;

    Ok(())
}

fn create_development_profile(conn: &Connection) -> Result<()> {
    // Insert profile
    conn.execute(
        "INSERT INTO sandbox_profiles (name, description, is_active, is_default) VALUES (?1, ?2, ?3, ?4)",
        params![
            "Development",
            "Development profile with broader permissions for development tasks",
            true,
            false
        ],
    )?;

    let profile_id = conn.last_insert_rowid();

    // Add development rules
    let rules = vec![
        // Broad file access
        (
            "file_read_all",
            "subpath",
            "{{PROJECT_PATH}}",
            true,
            Some(r#"["linux", "macos"]"#),
        ),
        (
            "file_read_all",
            "subpath",
            "{{HOME}}",
            true,
            Some(r#"["linux", "macos"]"#),
        ),
        (
            "file_read_all",
            "subpath",
            "/usr",
            true,
            Some(r#"["linux", "macos"]"#),
        ),
        (
            "file_read_all",
            "subpath",
            "/opt",
            true,
            Some(r#"["linux", "macos"]"#),
        ),
        (
            "file_read_all",
            "subpath",
            "/Applications",
            true,
            Some(r#"["macos"]"#),
        ),
        (
            "file_read_metadata",
            "subpath",
            "/",
            true,
            Some(r#"["macos"]"#),
        ),
        // Network access
        (
            "network_outbound",
            "all",
            "",
            true,
            Some(r#"["linux", "macos"]"#),
        ),
        // System info (macOS only)
        ("system_info_read", "all", "", true, Some(r#"["macos"]"#)),
    ];

    for (op_type, pattern_type, pattern_value, enabled, platforms) in rules {
        conn.execute(
            "INSERT INTO sandbox_rules (profile_id, operation_type, pattern_type, pattern_value, enabled, platform_support) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![profile_id, op_type, pattern_type, pattern_value, enabled, platforms],
        )?;
    }

    Ok(())
}
