use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use notify::{Watcher, RecursiveMode, Event, EventKind};
use crate::usage::indexer::UsageIndexer;

pub struct UsageWatcher {
    indexer: Arc<UsageIndexer>,
    _watcher: notify::RecommendedWatcher,
    _handle: thread::JoinHandle<()>,
}

impl UsageWatcher {
    pub fn new() -> Result<Self, String> {
        let indexer = Arc::new(UsageIndexer::new()?);
        
        // Perform initial indexing
        log::info!("Starting background usage indexing...");
        let initial_files = indexer.initial_index()?;
        log::info!("Initial indexing complete: {} files processed", initial_files);

        let (tx, rx) = mpsc::channel();
        
        // Create file watcher
        let mut watcher = notify::recommended_watcher(tx)
            .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        // Watch the ~/.claude/projects directory
        let claude_path = dirs::home_dir()
            .ok_or("Failed to get home directory")?
            .join(".claude")
            .join("projects");

        if claude_path.exists() {
            watcher.watch(&claude_path, RecursiveMode::Recursive)
                .map_err(|e| format!("Failed to watch directory: {}", e))?;
            log::info!("Started watching directory: {:?}", claude_path);
        } else {
            log::warn!("Projects directory does not exist: {:?}", claude_path);
        }

        // Spawn background thread to handle file events
        let indexer_clone = Arc::clone(&indexer);
        let handle = thread::spawn(move || {
            Self::handle_file_events(rx, indexer_clone);
        });

        Ok(UsageWatcher {
            indexer,
            _watcher: watcher,
            _handle: handle,
        })
    }

    fn handle_file_events(rx: mpsc::Receiver<Result<Event, notify::Error>>, indexer: Arc<UsageIndexer>) {
        let mut pending_files: std::collections::HashMap<PathBuf, std::time::Instant> = std::collections::HashMap::new();
        let debounce_duration = Duration::from_millis(500); // 500ms debounce

        loop {
            // Check for new events with a timeout
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(Ok(event)) => {
                    Self::process_event(event, &mut pending_files);
                }
                Ok(Err(e)) => {
                    log::error!("File watcher error: {}", e);
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    // Check for files that are ready to be processed (debounced)
                    let now = std::time::Instant::now();
                    let ready_files: Vec<PathBuf> = pending_files
                        .iter()
                        .filter(|(_, &timestamp)| now.duration_since(timestamp) >= debounce_duration)
                        .map(|(path, _)| path.clone())
                        .collect();

                    for file_path in ready_files {
                        pending_files.remove(&file_path);
                        
                        if Self::is_jsonl_file(&file_path) {
                            log::debug!("Processing debounced file: {:?}", file_path);
                            match indexer.process_modified_file(&file_path) {
                                Ok(entries_added) => {
                                    if entries_added > 0 {
                                        log::info!("Processed modified file: {:?}, {} entries added", file_path, entries_added);
                                    }
                                }
                                Err(e) => {
                                    log::error!("Failed to process modified file {:?}: {}", file_path, e);
                                }
                            }
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    log::info!("File watcher channel disconnected, stopping");
                    break;
                }
            }
        }
    }

    fn process_event(event: Event, pending_files: &mut std::collections::HashMap<PathBuf, std::time::Instant>) {
        match event.kind {
            EventKind::Create(_) | EventKind::Modify(_) => {
                for path in event.paths {
                    if Self::is_jsonl_file(&path) {
                        log::debug!("File event detected: {:?}", path);
                        pending_files.insert(path, std::time::Instant::now());
                    }
                }
            }
            _ => {
                // Ignore other event types (delete, etc.)
            }
        }
    }

    fn is_jsonl_file(path: &PathBuf) -> bool {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("jsonl"))
            .unwrap_or(false)
    }

    pub fn get_usage_stats(&self, days: Option<u32>) -> Result<crate::usage::database::UsageStats, String> {
        self.indexer.get_usage_stats(days)
    }

    pub fn clear_cache(&self) -> Result<(), String> {
        self.indexer.clear_cache()
    }

    pub fn force_reindex(&self) -> Result<usize, String> {
        log::info!("Force reindexing requested");
        self.indexer.clear_cache()?;
        self.indexer.initial_index()
    }
}

// Global usage watcher instance
static USAGE_WATCHER: std::sync::OnceLock<UsageWatcher> = std::sync::OnceLock::new();

pub fn get_usage_watcher() -> Result<&'static UsageWatcher, String> {
    USAGE_WATCHER.get_or_init(|| {
        match UsageWatcher::new() {
            Ok(watcher) => watcher,
            Err(e) => {
                log::error!("Failed to initialize usage watcher: {}", e);
                panic!("Failed to initialize usage watcher: {}", e);
            }
        }
    });
    
    USAGE_WATCHER.get().ok_or_else(|| "Usage watcher not initialized".to_string())
}

pub fn init_usage_watcher() -> Result<(), String> {
    get_usage_watcher()?;
    Ok(())
}
