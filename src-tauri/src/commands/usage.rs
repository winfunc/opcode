use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use tauri::command;
use crate::usage::watcher::get_usage_watcher;
use crate::usage::database::{UsageStats, UsageEntry, ProjectUsage};

#[derive(Debug, Serialize, Deserialize)]
pub struct UsageProgress {
    current_file: String,
    files_processed: usize,
    total_files: usize,
    percentage: f32,
    stage: String,
}

#[command]
pub fn get_usage_stats(days: Option<u32>) -> Result<UsageStats, String> {
    let watcher = get_usage_watcher()?;
    watcher.get_usage_stats(days)
}

#[command]
pub fn get_usage_by_date_range(start_date: String, _end_date: String) -> Result<UsageStats, String> {
    // For now, delegate to get_usage_stats with calculated days
    let start = NaiveDate::parse_from_str(&start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start date: {}", e))?;
    
    let days_diff = (chrono::Utc::now().naive_utc().date() - start).num_days();
    if days_diff < 0 {
        return Err("Start date cannot be in the future".to_string());
    }
    
    get_usage_stats(Some(days_diff as u32))
}

#[command]
pub fn get_usage_details(_project_path: Option<String>, _date: Option<String>) -> Result<Vec<UsageEntry>, String> {
    // For now, return empty list - this would need database query implementation
    // in the background service if detailed filtering is needed
    Ok(vec![])
}

#[command]
pub fn get_session_stats(
    _since: Option<String>,
    _until: Option<String>,
    _order: Option<String>,
) -> Result<Vec<ProjectUsage>, String> {
    // For now, return empty list - this would need database query implementation
    // in the background service if detailed filtering is needed
    Ok(vec![])
}

#[command]
pub fn get_usage_stats_progressive() -> Result<UsageProgress, String> {
    Ok(UsageProgress {
        current_file: "Background indexing active".to_string(),
        files_processed: 0,
        total_files: 0,
        percentage: 100.0,
        stage: "complete".to_string(),
    })
}

#[command]
pub fn process_usage_batch(_batch_size: Option<usize>) -> Result<UsageProgress, String> {
    let watcher = get_usage_watcher()?;
    let files_processed = watcher.force_reindex()?;
    
    Ok(UsageProgress {
        current_file: "Reindexing complete".to_string(),
        files_processed,
        total_files: files_processed,
        percentage: 100.0,
        stage: "complete".to_string(),
    })
}

#[command]
pub fn get_cached_usage_stats(_cache_key: Option<String>) -> Result<UsageStats, String> {
    get_usage_stats(None)
}

#[command]
pub fn clear_usage_cache() -> Result<String, String> {
    let watcher = get_usage_watcher()?;
    watcher.clear_cache()?;
    Ok("Usage cache cleared successfully".to_string())
}
