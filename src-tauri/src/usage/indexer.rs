use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use serde::Deserialize;
use serde_json;
use tempfile::TempDir;
use crate::usage::database::{UsageDatabase, UsageEntry};

// Pricing constants
const OPUS_4_INPUT_PRICE: f64 = 15.0;
const OPUS_4_OUTPUT_PRICE: f64 = 75.0;
const OPUS_4_CACHE_WRITE_PRICE: f64 = 18.75;
const OPUS_4_CACHE_READ_PRICE: f64 = 1.50;

const SONNET_4_INPUT_PRICE: f64 = 3.0;
const SONNET_4_OUTPUT_PRICE: f64 = 15.0;
const SONNET_4_CACHE_WRITE_PRICE: f64 = 3.75;
const SONNET_4_CACHE_READ_PRICE: f64 = 0.30;

#[derive(Debug, Deserialize)]
struct JsonlEntry {
    timestamp: String,
    message: Option<MessageData>,
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
    #[serde(rename = "requestId")]
    request_id: Option<String>,
    #[serde(rename = "costUSD")]
    cost_usd: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct MessageData {
    id: Option<String>,
    model: Option<String>,
    usage: Option<UsageData>,
}

#[derive(Debug, Deserialize)]
struct UsageData {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    cache_creation_input_tokens: Option<u64>,
    cache_read_input_tokens: Option<u64>,
}

pub struct UsageIndexer {
    database: UsageDatabase,
}

impl UsageIndexer {
    pub fn new() -> Result<Self, String> {
        let database = UsageDatabase::new()?;
        Ok(UsageIndexer { database })
    }

    /// Performs initial indexing of all usage files
    pub fn initial_index(&self) -> Result<usize, String> {
        log::info!("Starting initial usage indexing...");
        
        let claude_path = dirs::home_dir()
            .ok_or("Failed to get home directory")?
            .join(".claude");
        
        let projects_dir = claude_path.join("projects");
        if !projects_dir.exists() {
            log::info!("No projects directory found, skipping indexing");
            return Ok(0);
        }

        let mut total_files_processed = 0;
        let mut total_entries_added = 0;

        // Scan all project directories
        if let Ok(projects) = fs::read_dir(&projects_dir) {
            for project in projects.flatten() {
                if project.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    let project_name = project.file_name().to_string_lossy().to_string();
                    let project_path = project.path();

                    // Find all JSONL files in this project
                    for entry in walkdir::WalkDir::new(&project_path)
                        .into_iter()
                        .filter_map(Result::ok)
                        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
                    {
                        let file_path = entry.path().to_path_buf();
                        
                        match self.process_file(&file_path, &project_name) {
                            Ok(entries_added) => {
                                total_files_processed += 1;
                                total_entries_added += entries_added;
                                
                                if total_files_processed % 10 == 0 {
                                    log::info!("Processed {} files, {} entries added", total_files_processed, total_entries_added);
                                }
                            }
                            Err(e) => {
                                log::warn!("Failed to process file {:?}: {}", file_path, e);
                            }
                        }
                    }
                }
            }
        }

        // Clear cache after indexing
        self.database.clear_cache()?;

        log::info!("Initial indexing complete: {} files processed, {} entries added", 
                  total_files_processed, total_entries_added);
        
        Ok(total_files_processed)
    }

    /// Processes a single file that has been modified
    pub fn process_modified_file(&self, file_path: &PathBuf) -> Result<usize, String> {
        log::debug!("Processing modified file: {:?}", file_path);
        
        // Extract project name from path
        let project_name = file_path
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Copy file to temp directory for safe processing
        let temp_dir = TempDir::new().map_err(|e| format!("Failed to create temp dir: {}", e))?;
        let temp_file_path = temp_dir.path().join(file_path.file_name().unwrap_or_default());
        
        fs::copy(file_path, &temp_file_path)
            .map_err(|e| format!("Failed to copy file to temp: {}", e))?;

        // Process the temp file
        let entries_added = self.process_file(&temp_file_path, &project_name)?;
        
        // Temp directory and file are automatically cleaned up when temp_dir is dropped
        
        // Clear cache after processing
        self.database.clear_cache()?;
        
        log::debug!("Processed modified file: {} entries added", entries_added);
        Ok(entries_added)
    }

    /// Processes a single JSONL file and extracts usage entries
    fn process_file(&self, file_path: &PathBuf, encoded_project_name: &str) -> Result<usize, String> {
        let file_path_str = file_path.to_string_lossy().to_string();
        
        // Check if file needs processing
        let metadata = fs::metadata(file_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;
        
        let last_modified = metadata.modified()
            .unwrap_or(SystemTime::UNIX_EPOCH)
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        // Check if file was already processed
        if let Ok(Some(stored_modified)) = self.database.get_file_last_modified(&file_path_str) {
            if last_modified <= stored_modified {
                log::debug!("File {:?} already processed, skipping", file_path);
                return Ok(0);
            }
        }

        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        let session_id = file_path.parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let mut entries_inserted = 0;
        let mut actual_project_path: Option<String> = None;

        for line in content.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
                // Extract project path from cwd if available
                if actual_project_path.is_none() {
                    if let Some(cwd) = json_value.get("cwd").and_then(|v| v.as_str()) {
                        actual_project_path = Some(cwd.to_string());
                    }
                }
                
                if let Ok(entry) = serde_json::from_value::<JsonlEntry>(json_value) {
                    if let Some(message) = &entry.message {
                        if let Some(usage) = &message.usage {
                            // Skip entries with no token usage
                            if usage.input_tokens.unwrap_or(0) == 0 && 
                               usage.output_tokens.unwrap_or(0) == 0 &&
                               usage.cache_creation_input_tokens.unwrap_or(0) == 0 &&
                               usage.cache_read_input_tokens.unwrap_or(0) == 0 {
                                continue;
                            }

                            let cost = entry.cost_usd.unwrap_or_else(|| {
                                if let Some(model_str) = &message.model {
                                    self.calculate_cost(model_str, usage)
                                } else {
                                    0.0
                                }
                            });
                            
                            let project_path = actual_project_path.clone()
                                .unwrap_or_else(|| encoded_project_name.to_string());
                            
                            let usage_entry = UsageEntry {
                                timestamp: entry.timestamp,
                                model: message.model.clone().unwrap_or_else(|| "unknown".to_string()),
                                input_tokens: usage.input_tokens.unwrap_or(0),
                                output_tokens: usage.output_tokens.unwrap_or(0),
                                cache_creation_tokens: usage.cache_creation_input_tokens.unwrap_or(0),
                                cache_read_tokens: usage.cache_read_input_tokens.unwrap_or(0),
                                cost,
                                session_id: entry.session_id.unwrap_or_else(|| session_id.clone()),
                                project_path,
                            };
                            
                            if self.database.insert_usage_entry(&usage_entry, message.id.as_deref(), entry.request_id.as_deref())? {
                                entries_inserted += 1;
                            }
                        }
                    }
                }
            }
        }

        // Update scan log
        self.database.update_file_scan_log(&file_path_str, last_modified, entries_inserted)?;

        Ok(entries_inserted)
    }

    fn calculate_cost(&self, model: &str, usage: &UsageData) -> f64 {
        let input_tokens = usage.input_tokens.unwrap_or(0) as f64;
        let output_tokens = usage.output_tokens.unwrap_or(0) as f64;
        let cache_creation_tokens = usage.cache_creation_input_tokens.unwrap_or(0) as f64;
        let cache_read_tokens = usage.cache_read_input_tokens.unwrap_or(0) as f64;

        let (input_price, output_price, cache_write_price, cache_read_price) = 
            if model.contains("opus-4") || model.contains("claude-opus-4") {
                (OPUS_4_INPUT_PRICE, OPUS_4_OUTPUT_PRICE, OPUS_4_CACHE_WRITE_PRICE, OPUS_4_CACHE_READ_PRICE)
            } else if model.contains("sonnet-4") || model.contains("claude-sonnet-4") {
                (SONNET_4_INPUT_PRICE, SONNET_4_OUTPUT_PRICE, SONNET_4_CACHE_WRITE_PRICE, SONNET_4_CACHE_READ_PRICE)
            } else {
                (0.0, 0.0, 0.0, 0.0)
            };

        (input_tokens * input_price / 1_000_000.0)
            + (output_tokens * output_price / 1_000_000.0)
            + (cache_creation_tokens * cache_write_price / 1_000_000.0)
            + (cache_read_tokens * cache_read_price / 1_000_000.0)
    }

    pub fn get_usage_stats(&self, days: Option<u32>) -> Result<crate::usage::database::UsageStats, String> {
        self.database.get_usage_stats(days)
    }

    pub fn clear_cache(&self) -> Result<(), String> {
        self.database.clear_cache()
    }
}
