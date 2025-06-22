use rusqlite::{Connection, params};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsageEntry {
    pub timestamp: String,
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_creation_tokens: u64,
    pub cache_read_tokens: u64,
    pub cost: f64,
    pub session_id: String,
    pub project_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsageStats {
    pub total_cost: f64,
    pub total_tokens: u64,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cache_creation_tokens: u64,
    pub total_cache_read_tokens: u64,
    pub total_sessions: u64,
    pub by_model: Vec<ModelUsage>,
    pub by_date: Vec<DailyUsage>,
    pub by_project: Vec<ProjectUsage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelUsage {
    pub model: String,
    pub total_cost: f64,
    pub total_tokens: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_creation_tokens: u64,
    pub cache_read_tokens: u64,
    pub request_count: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyUsage {
    pub date: String,
    pub total_cost: f64,
    pub total_tokens: u64,
    pub models_used: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectUsage {
    pub project_path: String,
    pub project_name: String,
    pub total_cost: f64,
    pub total_tokens: u64,
    pub request_count: u64,
    pub last_used: String,
}

pub struct UsageDatabase {
    conn: Arc<Mutex<Connection>>,
}

impl UsageDatabase {
    pub fn new() -> Result<Self, String> {
        let app_dir = dirs::home_dir()
            .ok_or("Failed to get home directory")?
            .join(".claude");
        
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        let db_path = app_dir.join("usage.db");
        
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let db = UsageDatabase {
            conn: Arc::new(Mutex::new(conn)),
        };
        
        db.init_database()?;
        Ok(db)
    }

    fn init_database(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        
        // Create usage_entries table with proper indexing
        conn.execute(
            "CREATE TABLE IF NOT EXISTS usage_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                model TEXT NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
                cache_read_tokens INTEGER NOT NULL DEFAULT 0,
                cost REAL NOT NULL DEFAULT 0.0,
                session_id TEXT NOT NULL,
                project_path TEXT NOT NULL,
                message_id TEXT,
                request_id TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(message_id, request_id) ON CONFLICT IGNORE
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Create indexes for fast querying
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_entries(timestamp DESC)",
            [],
        ).map_err(|e| e.to_string())?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_usage_model ON usage_entries(model)",
            [],
        ).map_err(|e| e.to_string())?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_entries(project_path)",
            [],
        ).map_err(|e| e.to_string())?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_entries(session_id)",
            [],
        ).map_err(|e| e.to_string())?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_entries(date(timestamp))",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Create file_scan_log table to track which files have been processed
        conn.execute(
            "CREATE TABLE IF NOT EXISTS file_scan_log (
                file_path TEXT PRIMARY KEY,
                last_modified INTEGER NOT NULL,
                last_scanned TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                entry_count INTEGER NOT NULL DEFAULT 0
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Create aggregated stats cache table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS usage_stats_cache (
                cache_key TEXT PRIMARY KEY,
                stats_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at TEXT NOT NULL
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        Ok(())
    }

    pub fn insert_usage_entry(&self, entry: &UsageEntry, message_id: Option<&str>, request_id: Option<&str>) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        
        let result = conn.execute(
            "INSERT OR IGNORE INTO usage_entries 
             (timestamp, model, input_tokens, output_tokens, cache_creation_tokens, 
              cache_read_tokens, cost, session_id, project_path, message_id, request_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                entry.timestamp,
                entry.model,
                entry.input_tokens,
                entry.output_tokens,
                entry.cache_creation_tokens,
                entry.cache_read_tokens,
                entry.cost,
                entry.session_id,
                entry.project_path,
                message_id,
                request_id
            ],
        ).map_err(|e| e.to_string())?;
        
        Ok(result > 0)
    }

    pub fn update_file_scan_log(&self, file_path: &str, last_modified: i64, entry_count: usize) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        
        conn.execute(
            "INSERT OR REPLACE INTO file_scan_log (file_path, last_modified, entry_count) VALUES (?, ?, ?)",
            params![file_path, last_modified, entry_count],
        ).map_err(|e| e.to_string())?;
        
        Ok(())
    }

    pub fn get_file_last_modified(&self, file_path: &str) -> Result<Option<i64>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        
        let mut stmt = conn.prepare("SELECT last_modified FROM file_scan_log WHERE file_path = ?")
            .map_err(|e| e.to_string())?;
        
        let mut rows = stmt.query(params![file_path]).map_err(|e| e.to_string())?;
        
        if let Ok(Some(row)) = rows.next() {
            let last_modified: i64 = row.get(0).map_err(|e| e.to_string())?;
            Ok(Some(last_modified))
        } else {
            Ok(None)
        }
    }

    pub fn get_usage_stats(&self, days: Option<u32>) -> Result<UsageStats, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        
        // Check cache first
        let cache_key = format!("stats_{}", days.unwrap_or(0));
        let cache_expiry = chrono::Utc::now() - chrono::Duration::minutes(5); // 5 minute cache
        
        if let Ok(mut stmt) = conn.prepare("SELECT stats_json FROM usage_stats_cache WHERE cache_key = ? AND created_at > ?") {
            if let Ok(mut rows) = stmt.query(params![cache_key, cache_expiry.to_rfc3339()]) {
                if let Ok(Some(row)) = rows.next() {
                    let stats_json: String = row.get(0).map_err(|e| e.to_string())?;
                    if let Ok(stats) = serde_json::from_str::<UsageStats>(&stats_json) {
                        return Ok(stats);
                    }
                }
            }
        }
        
        // Build query with date filter
        let mut query = "SELECT * FROM usage_entries".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        
        if let Some(days) = days {
            let cutoff = (chrono::Utc::now() - chrono::Duration::days(days as i64)).to_rfc3339();
            query.push_str(" WHERE timestamp >= ?");
            params.push(Box::new(cutoff));
        }
        
        query.push_str(" ORDER BY timestamp");
        
        // Execute query and build stats
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok(UsageEntry {
                timestamp: row.get(1)?,
                model: row.get(2)?,
                input_tokens: row.get(3)?,
                output_tokens: row.get(4)?,
                cache_creation_tokens: row.get(5)?,
                cache_read_tokens: row.get(6)?,
                cost: row.get(7)?,
                session_id: row.get(8)?,
                project_path: row.get(9)?,
            })
        }).map_err(|e| e.to_string())?;
        
        let entries: Vec<UsageEntry> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        let stats = self.compute_usage_stats(&entries);
        
        // Cache the result
        let stats_json = serde_json::to_string(&stats).map_err(|e| e.to_string())?;
        let expires_at = (chrono::Utc::now() + chrono::Duration::minutes(5)).to_rfc3339();
        
        let _ = conn.execute(
            "INSERT OR REPLACE INTO usage_stats_cache (cache_key, stats_json, expires_at) VALUES (?, ?, ?)",
            params![cache_key, stats_json, expires_at],
        );
        
        Ok(stats)
    }

    pub fn clear_cache(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        
        conn.execute("DELETE FROM usage_stats_cache", []).map_err(|e| e.to_string())?;
        
        Ok(())
    }

    fn compute_usage_stats(&self, entries: &[UsageEntry]) -> UsageStats {
        let mut total_cost = 0.0;
        let mut total_input_tokens = 0u64;
        let mut total_output_tokens = 0u64;
        let mut total_cache_creation_tokens = 0u64;
        let mut total_cache_read_tokens = 0u64;
        
        let mut model_stats: HashMap<String, ModelUsage> = HashMap::new();
        let mut daily_stats: HashMap<String, DailyUsage> = HashMap::new();
        let mut project_stats: HashMap<String, ProjectUsage> = HashMap::new();
        
        for entry in entries {
            total_cost += entry.cost;
            total_input_tokens += entry.input_tokens;
            total_output_tokens += entry.output_tokens;
            total_cache_creation_tokens += entry.cache_creation_tokens;
            total_cache_read_tokens += entry.cache_read_tokens;
            
            // Model stats
            let model_stat = model_stats.entry(entry.model.clone()).or_insert(ModelUsage {
                model: entry.model.clone(),
                total_cost: 0.0,
                total_tokens: 0,
                input_tokens: 0,
                output_tokens: 0,
                cache_creation_tokens: 0,
                cache_read_tokens: 0,
                request_count: 0,
            });
            model_stat.total_cost += entry.cost;
            model_stat.input_tokens += entry.input_tokens;
            model_stat.output_tokens += entry.output_tokens;
            model_stat.cache_creation_tokens += entry.cache_creation_tokens;
            model_stat.cache_read_tokens += entry.cache_read_tokens;
            model_stat.total_tokens = model_stat.input_tokens + model_stat.output_tokens;
            model_stat.request_count += 1;
            
            // Daily stats
            let date = entry.timestamp.split('T').next().unwrap_or(&entry.timestamp).to_string();
            let daily_stat = daily_stats.entry(date.clone()).or_insert(DailyUsage {
                date,
                total_cost: 0.0,
                total_tokens: 0,
                models_used: vec![],
            });
            daily_stat.total_cost += entry.cost;
            daily_stat.total_tokens += entry.input_tokens + entry.output_tokens + entry.cache_creation_tokens + entry.cache_read_tokens;
            if !daily_stat.models_used.contains(&entry.model) {
                daily_stat.models_used.push(entry.model.clone());
            }
            
            // Project stats
            let project_stat = project_stats.entry(entry.project_path.clone()).or_insert(ProjectUsage {
                project_path: entry.project_path.clone(),
                project_name: entry.project_path.split('/').next_back()
                    .unwrap_or(&entry.project_path)
                    .to_string(),
                total_cost: 0.0,
                total_tokens: 0,
                request_count: 0,
                last_used: entry.timestamp.clone(),
            });
            project_stat.total_cost += entry.cost;
            project_stat.total_tokens += entry.input_tokens + entry.output_tokens + entry.cache_creation_tokens + entry.cache_read_tokens;
            project_stat.request_count += 1;
            if entry.timestamp > project_stat.last_used {
                project_stat.last_used = entry.timestamp.clone();
            }
        }
        
        let total_tokens = total_input_tokens + total_output_tokens + total_cache_creation_tokens + total_cache_read_tokens;
        let total_sessions = entries.len() as u64;
        
        let mut by_model: Vec<ModelUsage> = model_stats.into_values().collect();
        by_model.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());
        
        let mut by_date: Vec<DailyUsage> = daily_stats.into_values().collect();
        by_date.sort_by(|a, b| b.date.cmp(&a.date));
        
        let mut by_project: Vec<ProjectUsage> = project_stats.into_values().collect();
        by_project.sort_by(|a, b| b.total_cost.partial_cmp(&a.total_cost).unwrap());
        
        UsageStats {
            total_cost,
            total_tokens,
            total_input_tokens,
            total_output_tokens,
            total_cache_creation_tokens,
            total_cache_read_tokens,
            total_sessions,
            by_model,
            by_date,
            by_project,
        }
    }
}
