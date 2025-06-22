//! Database initialization and management for the agent system

use rusqlite::{Connection, Result as SqliteResult};
use tauri::{AppHandle, Manager};

/// Initialize the agents database
pub fn init_database(app: &AppHandle) -> SqliteResult<Connection> {
    let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
    
    let db_path = app_dir.join("agents.db");
    let conn = Connection::open(db_path)?;
    
    // Create agents table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT NOT NULL,
            system_prompt TEXT NOT NULL,
            default_task TEXT,
            model TEXT NOT NULL DEFAULT 'sonnet',
            sandbox_enabled BOOLEAN NOT NULL DEFAULT 1,
            enable_file_read BOOLEAN NOT NULL DEFAULT 1,
            enable_file_write BOOLEAN NOT NULL DEFAULT 1,
            enable_network BOOLEAN NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    
    // Add columns to existing table if they don't exist
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN default_task TEXT", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN model TEXT DEFAULT 'sonnet'", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN sandbox_profile_id INTEGER REFERENCES sandbox_profiles(id)", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN sandbox_enabled BOOLEAN DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN enable_file_read BOOLEAN DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN enable_file_write BOOLEAN DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE agents ADD COLUMN enable_network BOOLEAN DEFAULT 0", []);
    
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
            session_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            pid INTEGER,
            process_started_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT,
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Migrate existing agent_runs table if needed
    let _ = conn.execute("ALTER TABLE agent_runs ADD COLUMN session_id TEXT", []);
    let _ = conn.execute("ALTER TABLE agent_runs ADD COLUMN status TEXT DEFAULT 'pending'", []);
    let _ = conn.execute("ALTER TABLE agent_runs ADD COLUMN pid INTEGER", []);
    let _ = conn.execute("ALTER TABLE agent_runs ADD COLUMN process_started_at TEXT", []);
    
    // Drop old columns that are no longer needed (data is now read from JSONL files)
    // Note: SQLite doesn't support DROP COLUMN, so we'll ignore errors for existing columns
    let _ = conn.execute("UPDATE agent_runs SET session_id = '' WHERE session_id IS NULL", []);
    let _ = conn.execute("UPDATE agent_runs SET status = 'completed' WHERE status IS NULL AND completed_at IS NOT NULL", []);
    let _ = conn.execute("UPDATE agent_runs SET status = 'failed' WHERE status IS NULL AND completed_at IS NOT NULL AND session_id = ''", []);
    let _ = conn.execute("UPDATE agent_runs SET status = 'pending' WHERE status IS NULL", []);
    
    // Create trigger to update the updated_at timestamp
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS update_agent_timestamp 
         AFTER UPDATE ON agents 
         FOR EACH ROW
         BEGIN
             UPDATE agents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END",
        [],
    )?;
    
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
    
    // Create index for efficient querying
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sandbox_violations_denied_at 
         ON sandbox_violations(denied_at DESC)",
        [],
    )?;
    
    // Create default sandbox profiles if they don't exist
    crate::sandbox::defaults::create_default_profiles(&conn)?;
    
    // Create settings table for app-wide settings
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    
    // Create trigger to update the updated_at timestamp
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS update_app_settings_timestamp 
         AFTER UPDATE ON app_settings 
         FOR EACH ROW
         BEGIN
             UPDATE app_settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
         END",
        [],
    )?;
    
    Ok(conn)
}
