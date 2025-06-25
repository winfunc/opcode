//! Test fixtures and data for sandbox testing
use anyhow::Result;
use once_cell::sync::Lazy;
use rusqlite::{params, Connection};
use std::path::PathBuf;
// Removed std::sync::Mutex - using parking_lot::Mutex instead
use tempfile::{tempdir, TempDir};

/// Global test database for sandbox testing
/// Using parking_lot::Mutex which doesn't poison on panic
use parking_lot::Mutex;

pub static TEST_DB: Lazy<Mutex<TestDatabase>> =
    Lazy::new(|| Mutex::new(TestDatabase::new().expect("Failed to create test database")));

/// Test database manager
pub struct TestDatabase {
    pub conn: Connection,
    pub temp_dir: TempDir,
}

impl TestDatabase {
    /// Create a new test database with schema
    pub fn new() -> Result<Self> {
        let temp_dir = tempdir()?;
        let db_path = temp_dir.path().join("test_sandbox.db");
        let conn = Connection::open(&db_path)?;

        // Initialize schema
        Self::init_schema(&conn)?;

        Ok(Self { conn, temp_dir })
    }

    /// Initialize database schema
    fn init_schema(conn: &Connection) -> Result<()> {
        // Create sandbox profiles table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sandbox_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                is_active BOOLEAN NOT NULL DEFAULT 0,
                is_default BOOLEAN NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Create sandbox rules table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sandbox_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL,
                operation_type TEXT NOT NULL,
                pattern_type TEXT NOT NULL,
                pattern_value TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT 1,
                platform_support TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (profile_id) REFERENCES sandbox_profiles(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create agents table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                system_prompt TEXT NOT NULL,
                default_task TEXT,
                model TEXT NOT NULL DEFAULT 'sonnet',
                sandbox_profile_id INTEGER REFERENCES sandbox_profiles(id),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Create agent_runs table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS agent_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL,
                agent_name TEXT NOT NULL,
                agent_icon TEXT NOT NULL,
                task TEXT NOT NULL,
                model TEXT NOT NULL,
                project_path TEXT NOT NULL,
                output TEXT NOT NULL DEFAULT '',
                duration_ms INTEGER,
                total_tokens INTEGER,
                cost_usd REAL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT,
                FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create sandbox violations table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sandbox_violations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER,
                agent_id INTEGER,
                agent_run_id INTEGER,
                operation_type TEXT NOT NULL,
                pattern_value TEXT,
                process_name TEXT,
                pid INTEGER,
                denied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (profile_id) REFERENCES sandbox_profiles(id) ON DELETE CASCADE,
                FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
                FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create trigger to update the updated_at timestamp for agents
        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS update_agent_timestamp 
             AFTER UPDATE ON agents 
             FOR EACH ROW
             BEGIN
                 UPDATE agents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END",
            [],
        )?;

        // Create trigger to update sandbox profile timestamp
        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS update_sandbox_profile_timestamp 
             AFTER UPDATE ON sandbox_profiles 
             FOR EACH ROW
             BEGIN
                 UPDATE sandbox_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END",
            [],
        )?;

        Ok(())
    }

    /// Create a test profile with rules
    pub fn create_test_profile(&self, name: &str, rules: Vec<TestRule>) -> Result<i64> {
        // Insert profile
        self.conn.execute(
            "INSERT INTO sandbox_profiles (name, description, is_active, is_default) VALUES (?1, ?2, ?3, ?4)",
            params![name, format!("Test profile: {name}"), true, false],
        )?;

        let profile_id = self.conn.last_insert_rowid();

        // Insert rules
        for rule in rules {
            self.conn.execute(
                "INSERT INTO sandbox_rules (profile_id, operation_type, pattern_type, pattern_value, enabled, platform_support) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    profile_id,
                    rule.operation_type,
                    rule.pattern_type,
                    rule.pattern_value,
                    rule.enabled,
                    rule.platform_support
                ],
            )?;
        }

        Ok(profile_id)
    }

    /// Reset database to clean state
    pub fn reset(&self) -> Result<()> {
        // Delete in the correct order to respect foreign key constraints
        self.conn.execute("DELETE FROM sandbox_violations", [])?;
        self.conn.execute("DELETE FROM agent_runs", [])?;
        self.conn.execute("DELETE FROM agents", [])?;
        self.conn.execute("DELETE FROM sandbox_rules", [])?;
        self.conn.execute("DELETE FROM sandbox_profiles", [])?;
        Ok(())
    }
}

/// Test rule structure
#[derive(Clone, Debug)]
pub struct TestRule {
    pub operation_type: String,
    pub pattern_type: String,
    pub pattern_value: String,
    pub enabled: bool,
    pub platform_support: Option<String>,
}

impl TestRule {
    /// Create a file read rule
    pub fn file_read(path: &str, subpath: bool) -> Self {
        Self {
            operation_type: "file_read_all".to_string(),
            pattern_type: if subpath { "subpath" } else { "literal" }.to_string(),
            pattern_value: path.to_string(),
            enabled: true,
            platform_support: Some(r#"["linux", "macos"]"#.to_string()),
        }
    }

    /// Create a network rule
    pub fn network_all() -> Self {
        Self {
            operation_type: "network_outbound".to_string(),
            pattern_type: "all".to_string(),
            pattern_value: String::new(),
            enabled: true,
            platform_support: Some(r#"["linux", "macos"]"#.to_string()),
        }
    }

    /// Create a network TCP rule
    pub fn network_tcp(port: u16) -> Self {
        Self {
            operation_type: "network_outbound".to_string(),
            pattern_type: "tcp".to_string(),
            pattern_value: port.to_string(),
            enabled: true,
            platform_support: Some(r#"["macos"]"#.to_string()),
        }
    }

    /// Create a system info read rule
    pub fn system_info_read() -> Self {
        Self {
            operation_type: "system_info_read".to_string(),
            pattern_type: "all".to_string(),
            pattern_value: String::new(),
            enabled: true,
            platform_support: Some(r#"["macos"]"#.to_string()),
        }
    }
}

/// Test file system structure
pub struct TestFileSystem {
    pub root: TempDir,
    pub project_path: PathBuf,
    pub allowed_path: PathBuf,
    pub forbidden_path: PathBuf,
}

impl TestFileSystem {
    /// Create a new test file system with predefined structure
    pub fn new() -> Result<Self> {
        let root = tempdir()?;
        let root_path = root.path();

        // Create project directory
        let project_path = root_path.join("test_project");
        std::fs::create_dir_all(&project_path)?;

        // Create allowed directory
        let allowed_path = root_path.join("allowed");
        std::fs::create_dir_all(&allowed_path)?;
        std::fs::write(allowed_path.join("test.txt"), "allowed content")?;

        // Create forbidden directory
        let forbidden_path = root_path.join("forbidden");
        std::fs::create_dir_all(&forbidden_path)?;
        std::fs::write(forbidden_path.join("secret.txt"), "forbidden content")?;

        // Create project files
        std::fs::write(project_path.join("main.rs"), "fn main() {}")?;
        std::fs::write(
            project_path.join("Cargo.toml"),
            "[package]\nname = \"test\"",
        )?;

        Ok(Self {
            root,
            project_path,
            allowed_path,
            forbidden_path,
        })
    }
}

/// Standard test profiles
pub mod profiles {
    use super::*;

    /// Minimal profile - only project access
    pub fn minimal(project_path: &str) -> Vec<TestRule> {
        vec![TestRule::file_read(project_path, true)]
    }

    /// Standard profile - project + system libraries
    pub fn standard(project_path: &str) -> Vec<TestRule> {
        vec![
            TestRule::file_read(project_path, true),
            TestRule::file_read("/usr/lib", true),
            TestRule::file_read("/usr/local/lib", true),
            TestRule::network_all(),
        ]
    }

    /// Development profile - more permissive
    pub fn development(project_path: &str, home_dir: &str) -> Vec<TestRule> {
        vec![
            TestRule::file_read(project_path, true),
            TestRule::file_read("/usr", true),
            TestRule::file_read("/opt", true),
            TestRule::file_read(home_dir, true),
            TestRule::network_all(),
            TestRule::system_info_read(),
        ]
    }

    /// Network-only profile
    pub fn network_only() -> Vec<TestRule> {
        vec![TestRule::network_all()]
    }

    /// File-only profile
    pub fn file_only(paths: Vec<&str>) -> Vec<TestRule> {
        paths
            .into_iter()
            .map(|path| TestRule::file_read(path, true))
            .collect()
    }
}
