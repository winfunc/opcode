use std::path::{Path, PathBuf};
use std::fs;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use anyhow::{Result, Context};
use std::collections::HashMap;

/// Simple command storage system that directly reads/writes to ~/.claude/commands/
/// No CQRS, no event sourcing, just clean file operations following Claudia's patterns

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCommand {
    pub name: String,
    pub content: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
    pub file_size: u64,
    pub is_executable: bool,
    pub scope: CommandScope,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CommandScope {
    User,
    Project,
}

/// Simple in-memory cache to avoid repeated file reads
struct CommandCache {
    commands: HashMap<String, ClaudeCommand>,
    search_cache: HashMap<String, Vec<String>>, // query -> command names
    last_refresh: DateTime<Utc>,
    cache_duration: chrono::Duration,
}

/// Main commands manager - simple and direct
#[derive(Clone)]
pub struct CommandsManager {
    commands_dir: PathBuf,
    cache: Arc<RwLock<CommandCache>>,
}

impl CommandsManager {
    /// Create a new commands manager
    pub fn new() -> Result<Self> {
        let commands_dir = dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not find home directory"))?
            .join(".claude")
            .join("commands");
        
        // Ensure directory exists
        fs::create_dir_all(&commands_dir)?;
        
        Ok(Self {
            commands_dir,
            cache: Arc::new(RwLock::new(CommandCache {
                commands: HashMap::new(),
                search_cache: HashMap::new(),
                last_refresh: Utc::now(),
                cache_duration: chrono::Duration::minutes(5),
            })),
        })
    }
    
    /// Get the commands directory for a specific project (if provided)
    fn get_commands_dir(&self, project_path: Option<&str>) -> PathBuf {
        if let Some(path) = project_path {
            PathBuf::from(path).join(".claude").join("commands")
        } else {
            self.commands_dir.clone()
        }
    }
    
    /// List all commands (with optional project-specific commands)
    pub async fn list_commands(&self, project_path: Option<&str>) -> Result<Vec<ClaudeCommand>> {
        let mut all_commands = Vec::new();
        let mut seen_names = std::collections::HashSet::new();
        
        // Load project commands first (they take precedence)
        if let Some(project) = project_path {
            let project_dir = self.get_commands_dir(Some(project));
            if project_dir.exists() {
                for mut cmd in self.read_commands_from_dir(&project_dir).await? {
                    cmd.scope = CommandScope::Project;
                    seen_names.insert(cmd.name.clone());
                    all_commands.push(cmd);
                }
            }
        }
        
        // Load user commands (skip if already in project)
        for mut cmd in self.read_commands_from_dir(&self.commands_dir).await? {
            if !seen_names.contains(&cmd.name) {
                cmd.scope = CommandScope::User;
                all_commands.push(cmd);
            }
        }
        
        Ok(all_commands)
    }
    
    /// Read all commands from a directory
    async fn read_commands_from_dir(&self, dir: &Path) -> Result<Vec<ClaudeCommand>> {
        let mut commands = Vec::new();
        
        if !dir.exists() {
            return Ok(commands);
        }
        
        let entries = fs::read_dir(dir)?;
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            
            // Skip non-files and non-command files
            if !path.is_file() {
                continue;
            }
            
            // Read command name from filename
            let filename = path.file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| anyhow::anyhow!("Invalid filename"))?
                .to_string();
            
            // Skip hidden files and backup files
            if filename.starts_with('.') || filename.ends_with('~') {
                continue;
            }
            
            // Only process .md files
            if !filename.ends_with(".md") {
                continue;
            }
            
            // Extract command name by removing .md extension
            let name = filename.strip_suffix(".md").unwrap().to_string();
            
            // Read the command
            if let Ok(cmd) = self.read_command(&name, Some(dir)).await {
                commands.push(cmd);
            }
        }
        
        Ok(commands)
    }
    
    /// Get a specific command
    pub async fn get_command(&self, name: &str, project_path: Option<&str>) -> Result<ClaudeCommand> {
        // Check project directory first
        if let Some(project) = project_path {
            let project_dir = self.get_commands_dir(Some(project));
            if let Ok(mut cmd) = self.read_command(name, Some(&project_dir)).await {
                cmd.scope = CommandScope::Project;
                return Ok(cmd);
            }
        }
        
        // Fall back to user directory
        let mut cmd = self.read_command(name, None).await?;
        cmd.scope = CommandScope::User;
        Ok(cmd)
    }
    
    /// Read a single command from disk
    async fn read_command(&self, name: &str, dir: Option<&Path>) -> Result<ClaudeCommand> {
        let base_dir = dir.unwrap_or(&self.commands_dir);
        let file_path = base_dir.join(format!("{}.md", name));
        
        if !file_path.exists() {
            anyhow::bail!("Command '{}' not found", name);
        }
        
        let content = fs::read_to_string(&file_path)
            .context("Failed to read command file")?;
        
        let metadata = fs::metadata(&file_path)?;
        let file_size = metadata.len();
        
        // Extract description from first line if it's a comment
        let description = content.lines()
            .next()
            .filter(|line| line.starts_with('#') || line.starts_with("//"))
            .map(|line| line.trim_start_matches('#').trim_start_matches("//").trim().to_string());
        
        #[cfg(unix)]
        let is_executable = {
            use std::os::unix::fs::PermissionsExt;
            metadata.permissions().mode() & 0o111 != 0
        };
        
        #[cfg(not(unix))]
        let is_executable = false;
        
        // Determine scope based on directory
        let scope = if dir.is_some() && dir != Some(&self.commands_dir) {
            CommandScope::Project
        } else {
            CommandScope::User
        };
        
        Ok(ClaudeCommand {
            name: name.to_string(),
            content,
            description,
            created_at: metadata.created()?.into(),
            modified_at: metadata.modified()?.into(),
            file_size,
            is_executable,
            scope,
        })
    }
    
    /// Create a new command
    pub async fn create_command(&self, name: &str, content: &str) -> Result<()> {
        self.validate_command_name(name)?;
        
        let file_path = self.commands_dir.join(format!("{}.md", name));
        if file_path.exists() {
            anyhow::bail!("Command '{}' already exists", name);
        }
        
        // Write atomically using temp file + rename
        self.write_command_atomic(&file_path, content)?;
        
        // Invalidate cache
        self.invalidate_cache().await;
        
        Ok(())
    }
    
    /// Update an existing command
    pub async fn update_command(&self, name: &str, content: &str) -> Result<()> {
        self.validate_command_name(name)?;
        
        let file_path = self.commands_dir.join(format!("{}.md", name));
        if !file_path.exists() {
            anyhow::bail!("Command '{}' not found", name);
        }
        
        // Write atomically
        self.write_command_atomic(&file_path, content)?;
        
        // Invalidate cache
        self.invalidate_cache().await;
        
        Ok(())
    }
    
    /// Delete a command
    pub async fn delete_command(&self, name: &str) -> Result<()> {
        let file_path = self.commands_dir.join(format!("{}.md", name));
        if !file_path.exists() {
            anyhow::bail!("Command '{}' not found", name);
        }
        
        fs::remove_file(&file_path)
            .context("Failed to delete command")?;
        
        // Invalidate cache
        self.invalidate_cache().await;
        
        Ok(())
    }
    
    /// Rename a command
    pub async fn rename_command(&self, old_name: &str, new_name: &str) -> Result<()> {
        self.validate_command_name(new_name)?;
        
        let old_path = self.commands_dir.join(format!("{}.md", old_name));
        let new_path = self.commands_dir.join(format!("{}.md", new_name));
        
        if !old_path.exists() {
            anyhow::bail!("Command '{}' not found", old_name);
        }
        
        if new_path.exists() {
            anyhow::bail!("Command '{}' already exists", new_name);
        }
        
        fs::rename(&old_path, &new_path)
            .context("Failed to rename command")?;
        
        // Invalidate cache
        self.invalidate_cache().await;
        
        Ok(())
    }
    
    /// Search commands by content or name with caching
    pub async fn search_commands(&self, query: &str, project_path: Option<&str>) -> Result<Vec<ClaudeCommand>> {
        let query_lower = query.to_lowercase();
        
        // Check cache first
        {
            let cache = self.cache.read().await;
            
            // Check if cache is still valid
            if Utc::now().signed_duration_since(cache.last_refresh) < cache.cache_duration {
                // Look for exact cache hit
                let cache_key = format!("{}:{}", query_lower, project_path.unwrap_or(""));
                if let Some(cached_names) = cache.search_cache.get(&cache_key) {
                    // Retrieve commands by cached names
                    let mut results = Vec::new();
                    for name in cached_names {
                        if let Some(cmd) = cache.commands.get(name) {
                            results.push(cmd.clone());
                        }
                    }
                    if !results.is_empty() {
                        return Ok(results);
                    }
                }
            }
        }
        
        // Cache miss or expired - perform search
        let all_commands = self.list_commands(project_path).await?;
        
        let mut results: Vec<(ClaudeCommand, f64)> = all_commands
            .into_iter()
            .filter_map(|cmd| {
                let mut score = 0.0;
                
                // Name match (highest priority)
                let name_lower = cmd.name.to_lowercase();
                if name_lower.contains(&query_lower) {
                    score += 10.0;
                    if name_lower == query_lower {
                        score += 5.0; // Exact match bonus
                    }
                    if name_lower.starts_with(&query_lower) {
                        score += 3.0; // Prefix match bonus
                    }
                }
                
                // Description match
                if let Some(desc) = &cmd.description {
                    if desc.to_lowercase().contains(&query_lower) {
                        score += 5.0;
                    }
                }
                
                // Content match (lower priority, only check first 500 chars for performance)
                let content_preview = if cmd.content.len() > 500 {
                    &cmd.content[..500]
                } else {
                    &cmd.content
                };
                if content_preview.to_lowercase().contains(&query_lower) {
                    score += 2.0;
                }
                
                if score > 0.0 {
                    Some((cmd, score))
                } else {
                    None
                }
            })
            .collect();
        
        // Sort by score descending
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        let final_results: Vec<ClaudeCommand> = results.into_iter().map(|(cmd, _)| cmd).collect();
        
        // Cache the results
        {
            let mut cache = self.cache.write().await;
            let cache_key = format!("{}:{}", query_lower, project_path.unwrap_or(""));
            let cached_names: Vec<String> = final_results.iter().map(|cmd| cmd.name.clone()).collect();
            cache.search_cache.insert(cache_key, cached_names);
            
            // Also ensure commands are in the cache
            for cmd in &final_results {
                cache.commands.insert(cmd.name.clone(), cmd.clone());
            }
        }
        
        Ok(final_results)
    }
    
    /// Set executable permission on a command
    #[cfg(unix)]
    pub async fn set_executable(&self, name: &str, executable: bool) -> Result<()> {
        use std::os::unix::fs::PermissionsExt;
        
        let file_path = self.commands_dir.join(format!("{}.md", name));
        if !file_path.exists() {
            anyhow::bail!("Command '{}' not found", name);
        }
        
        let metadata = fs::metadata(&file_path)?;
        let mut perms = metadata.permissions();
        
        if executable {
            perms.set_mode(perms.mode() | 0o111);
        } else {
            perms.set_mode(perms.mode() & !0o111);
        }
        
        fs::set_permissions(&file_path, perms)?;
        
        // Invalidate cache
        self.invalidate_cache().await;
        
        Ok(())
    }
    
    #[cfg(not(unix))]
    pub async fn set_executable(&self, _name: &str, _executable: bool) -> Result<()> {
        // No-op on non-Unix systems
        Ok(())
    }
    
    /// Validate command name for proper file naming
    fn validate_command_name(&self, name: &str) -> Result<()> {
        if name.is_empty() {
            anyhow::bail!("Command name cannot be empty");
        }
        
        if name.len() > 255 {
            anyhow::bail!("Command name too long (max 255 characters)");
        }
        
        // Don't allow path separators
        if name.contains('/') || name.contains('\\') {
            anyhow::bail!("Command name cannot contain path separators");
        }
        
        // Don't allow hidden files
        if name.starts_with('.') {
            anyhow::bail!("Command name cannot start with '.'");
        }
        
        // Don't allow spaces in command names
        if name.contains(' ') {
            anyhow::bail!("Command name cannot contain spaces. Use hyphens (-) or underscores (_) instead");
        }
        
        // Don't allow special characters that are problematic for filenames
        let forbidden_chars = ['<', '>', ':', '"', '|', '?', '*', '\0'];
        if name.chars().any(|c| forbidden_chars.contains(&c)) {
            anyhow::bail!("Command name contains invalid characters: < > : \" | ? * \\0");
        }
        
        // Don't allow control characters
        if name.chars().any(|c| c.is_control()) {
            anyhow::bail!("Command name cannot contain control characters");
        }
        
        // Don't allow names that end with dots or spaces (Windows compatibility)
        if name.ends_with('.') || name.ends_with(' ') {
            anyhow::bail!("Command name cannot end with a dot or space");
        }
        
        // Don't allow reserved Windows filenames
        let reserved_names = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4",
                             "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", 
                             "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"];
        let name_upper = name.to_uppercase();
        if reserved_names.contains(&name_upper.as_str()) {
            anyhow::bail!("Command name '{}' is a reserved system name", name);
        }
        
        // Recommend using kebab-case or snake_case
        if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            eprintln!("Note: Command names work best with only letters, numbers, hyphens (-), and underscores (_)");
        }
        
        Ok(())
    }
    
    /// Write command atomically to prevent corruption
    fn write_command_atomic(&self, path: &Path, content: &str) -> Result<()> {
        use std::io::Write;
        use std::time::{SystemTime, UNIX_EPOCH};
        
        // Create unique temp filename to avoid collisions
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_path = path.with_extension(format!("tmp.{}", timestamp));
        
        // Clean up any stale temp files first
        if let Some(parent) = path.parent() {
            if let Ok(entries) = fs::read_dir(parent) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                        if name.starts_with(path.file_name().and_then(|n| n.to_str()).unwrap_or(""))
                            && name.contains(".tmp.") {
                            // Remove stale temp file (best effort)
                            let _ = fs::remove_file(&entry_path);
                        }
                    }
                }
            }
        }
        
        // Write to temp file with explicit sync
        {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true) // Fail if temp file somehow exists
                .open(&temp_path)
                .context("Failed to create temporary file")?;
            
            file.write_all(content.as_bytes())
                .context("Failed to write content")?;
            
            // Ensure data is written to disk
            file.sync_all()
                .context("Failed to sync data to disk")?;
        } // File is closed here
        
        // Atomic rename (on most filesystems)
        fs::rename(&temp_path, path)
            .context("Failed to rename file")?;
        
        Ok(())
    }
    
    /// Invalidate the cache
    async fn invalidate_cache(&self) {
        let mut cache = self.cache.write().await;
        cache.commands.clear();
        cache.search_cache.clear();
        cache.last_refresh = Utc::now();
    }
    
    /// Clear cache for project context changes
    pub async fn clear_cache_for_project_change(&self) {
        // This ensures that when switching projects, we don't serve stale
        // command lists that might include project-specific commands from
        // the previous project
        self.invalidate_cache().await;
    }
}

/// Export format for commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandsExport {
    pub version: u32,
    pub exported_at: DateTime<Utc>,
    pub commands: Vec<ExportedCommand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedCommand {
    pub name: String,
    pub content: String,
    pub description: Option<String>,
    pub is_executable: bool,
}

/// Import result with detailed information
#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported: Vec<String>,
    pub skipped: Vec<String>,
    pub conflicts: Vec<String>,
    pub failed: Vec<ImportFailure>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportFailure {
    pub name: String,
    pub reason: String,
}

impl CommandsManager {
    /// Export all commands
    pub async fn export_commands(&self) -> Result<CommandsExport> {
        let commands = self.list_commands(None).await?;
        
        let exported_commands = commands
            .into_iter()
            .map(|cmd| ExportedCommand {
                name: cmd.name,
                content: cmd.content,
                description: cmd.description,
                is_executable: cmd.is_executable,
            })
            .collect();
        
        Ok(CommandsExport {
            version: 1,
            exported_at: Utc::now(),
            commands: exported_commands,
        })
    }
    
    /// Import commands with conflict detection
    pub async fn import_commands(&self, data: CommandsExport) -> Result<ImportResult> {
        let mut result = ImportResult {
            imported: Vec::new(),
            skipped: Vec::new(),
            conflicts: Vec::new(),
            failed: Vec::new(),
        };
        
        // First, detect conflicts
        let existing_commands = self.list_commands(None).await?;
        let existing_names: std::collections::HashSet<_> = existing_commands
            .iter()
            .map(|cmd| cmd.name.clone())
            .collect();
        
        for cmd in data.commands {
            // Check if command already exists
            if existing_names.contains(&cmd.name) {
                // Compare content to see if it's actually different
                if let Ok(existing) = self.get_command(&cmd.name, None).await {
                    if existing.content != cmd.content {
                        result.conflicts.push(cmd.name.clone());
                    } else {
                        result.skipped.push(cmd.name.clone());
                    }
                }
                continue;
            }
            
            // Try to create the command
            match self.create_command(&cmd.name, &cmd.content).await {
                Ok(_) => {
                    result.imported.push(cmd.name.clone());
                    
                    // Set executable if needed
                    if cmd.is_executable {
                        let _ = self.set_executable(&cmd.name, true).await;
                    }
                }
                Err(e) => {
                    result.failed.push(ImportFailure {
                        name: cmd.name.clone(),
                        reason: e.to_string(),
                    });
                }
            }
        }
        
        Ok(result)
    }
    
    /// Import commands with overwrite option
    pub async fn import_commands_with_overwrite(&self, data: CommandsExport, overwrite_conflicts: Vec<String>) -> Result<ImportResult> {
        let mut result = self.import_commands(data.clone()).await?;
        
        // Handle conflicts that user wants to overwrite
        for cmd in data.commands {
            if overwrite_conflicts.contains(&cmd.name) {
                match self.update_command(&cmd.name, &cmd.content).await {
                    Ok(_) => {
                        // Move from conflicts to imported
                        if let Some(pos) = result.conflicts.iter().position(|x| x == &cmd.name) {
                            result.conflicts.remove(pos);
                            result.imported.push(cmd.name.clone());
                        }
                        
                        // Set executable if needed
                        if cmd.is_executable {
                            let _ = self.set_executable(&cmd.name, true).await;
                        }
                    }
                    Err(e) => {
                        // Move from conflicts to failed
                        if let Some(pos) = result.conflicts.iter().position(|x| x == &cmd.name) {
                            result.conflicts.remove(pos);
                            result.failed.push(ImportFailure {
                                name: cmd.name.clone(),
                                reason: e.to_string(),
                            });
                        }
                    }
                }
            }
        }
        
        Ok(result)
    }
}

// Global instance following the pattern from the codebase
lazy_static::lazy_static! {
    static ref COMMANDS_MANAGER: Arc<RwLock<Option<CommandsManager>>> = Arc::new(RwLock::new(None));
}

async fn get_commands_manager() -> Result<Arc<CommandsManager>, String> {
    let mut manager_opt = COMMANDS_MANAGER.write().await;
    if manager_opt.is_none() {
        *manager_opt = Some(CommandsManager::new().map_err(|e| e.to_string())?);
    }
    
    Ok(Arc::new(
        manager_opt
            .as_ref()
            .ok_or("Failed to initialize commands manager")?
            .clone()
    ))
}

// Tauri command handlers - Simple and direct

#[tauri::command]
pub async fn list_claude_commands(project_path: Option<String>) -> Result<Vec<ClaudeCommand>, String> {
    let manager = get_commands_manager().await?;
    manager.list_commands(project_path.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_claude_command(name: String, project_path: Option<String>) -> Result<ClaudeCommand, String> {
    let manager = get_commands_manager().await?;
    manager.get_command(&name, project_path.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_claude_command(name: String, content: String) -> Result<(), String> {
    let manager = get_commands_manager().await?;
    manager.create_command(&name, &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_claude_command(name: String, content: String) -> Result<(), String> {
    let manager = get_commands_manager().await?;
    manager.update_command(&name, &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_claude_command(name: String) -> Result<(), String> {
    let manager = get_commands_manager().await?;
    manager.delete_command(&name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_claude_command(old_name: String, new_name: String) -> Result<(), String> {
    let manager = get_commands_manager().await?;
    manager.rename_command(&old_name, &new_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_claude_commands(query: String, project_path: Option<String>) -> Result<Vec<ClaudeCommand>, String> {
    let manager = get_commands_manager().await?;
    manager.search_commands(&query, project_path.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_command_executable(name: String, executable: bool) -> Result<(), String> {
    let manager = get_commands_manager().await?;
    manager.set_executable(&name, executable)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_commands() -> Result<CommandsExport, String> {
    let manager = get_commands_manager().await?;
    manager.export_commands()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_commands(data: CommandsExport) -> Result<ImportResult, String> {
    let manager = get_commands_manager().await?;
    manager.import_commands(data)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_commands_with_overwrite(
    data: CommandsExport,
    overwrite_conflicts: Vec<String>
) -> Result<ImportResult, String> {
    let manager = get_commands_manager().await?;
    manager.import_commands_with_overwrite(data, overwrite_conflicts)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_commands_cache() -> Result<(), String> {
    let manager = get_commands_manager().await?;
    manager.clear_cache_for_project_change().await;
    Ok(())
}

// Execute a command by reading its content and sending to Claude
#[tauri::command]
pub async fn execute_claude_command(
    app: tauri::AppHandle,
    session_id: String,
    command_name: String,
    project_path: String,
    model: String,
    args: Option<String>,
    _prefix: Option<String>, // Ignored, we determine based on availability
) -> Result<(), String> {
    use crate::commands::claude::resume_claude_code;
    
    // Get the command content
    let manager = get_commands_manager().await?;
    let command = manager
        .get_command(&command_name, Some(&project_path))
        .await
        .map_err(|e| format!("Command '{}' not found: {}", command_name, e))?;
    
    // Prepare the full prompt with the command content
    let full_prompt = if let Some(args) = args.filter(|a| !a.is_empty()) {
        // Replace any placeholders or append args as needed
        format!("{}\n\nArguments: {}", command.content, args)
    } else {
        command.content.clone()
    };
    
    // Resume in existing session with the actual command content
    resume_claude_code(
        app,
        project_path,
        session_id,
        full_prompt,
        model,
    ).await
}

// Export the file dialog function (unchanged)
#[tauri::command]
pub async fn export_commands_to_file(app: tauri::AppHandle, data: String) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let default_filename = format!("claude-commands-{}.json", chrono::Local::now().format("%Y-%m-%d"));
    
    let file_path = app.dialog()
        .file()
        .set_title("Save Commands Export")
        .set_file_name(&default_filename)
        .add_filter("JSON Files", &["json"])
        .blocking_save_file();

    match file_path {
        Some(path) => {
            let path_str = path.to_string();
            std::fs::write(&path_str, data)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(path_str)
        }
        None => Err("Save cancelled".to_string())
    }
}

// Stub implementations for backwards compatibility
// These were part of the CQRS over-engineering and aren't needed

#[tauri::command]
pub async fn get_command_history(_name: String) -> Result<Vec<serde_json::Value>, String> {
    // History tracking was part of the event sourcing complexity
    // Return empty array for backwards compatibility
    Ok(vec![])
}

#[tauri::command]
pub async fn get_command_stats() -> Result<serde_json::Value, String> {
    // Stats were derived from event store
    // Return basic stats from file system
    let manager = get_commands_manager().await?;
    let commands = manager.list_commands(None).await.map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "total_commands": commands.len(),
        "total_size": commands.iter().map(|c| c.file_size).sum::<u64>(),
        "average_size": if commands.is_empty() { 0 } else { 
            commands.iter().map(|c| c.file_size).sum::<u64>() / commands.len() as u64 
        }
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_simple_command_operations() {
        let temp_dir = TempDir::new().unwrap();
        let manager = CommandsManager {
            commands_dir: temp_dir.path().to_path_buf(),
            cache: Arc::new(RwLock::new(CommandCache {
                commands: HashMap::new(),
                search_cache: HashMap::new(),
                last_refresh: Utc::now(),
                cache_duration: chrono::Duration::minutes(5),
            })),
        };
        
        // Create
        manager.create_command("test", "echo hello").await.unwrap();
        
        // Get
        let cmd = manager.get_command("test", None).await.unwrap();
        assert_eq!(cmd.name, "test");
        assert_eq!(cmd.content, "echo hello");
        
        // Update
        manager.update_command("test", "echo world").await.unwrap();
        let cmd = manager.get_command("test", None).await.unwrap();
        assert_eq!(cmd.content, "echo world");
        
        // List
        let commands = manager.list_commands(None).await.unwrap();
        assert_eq!(commands.len(), 1);
        
        // Search
        let results = manager.search_commands("world", None).await.unwrap();
        assert_eq!(results.len(), 1);
        
        // Rename
        manager.rename_command("test", "test2").await.unwrap();
        assert!(manager.get_command("test", None).await.is_err());
        assert!(manager.get_command("test2", None).await.is_ok());
        
        // Delete
        manager.delete_command("test2").await.unwrap();
        assert!(manager.get_command("test2", None).await.is_err());
    }
}