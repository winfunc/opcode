use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::collections::HashMap;
use std::path::PathBuf;
use std::fs;
use std::time::SystemTime;
use yaml_rust2::{YamlLoader, Yaml};

// Query definitions for read operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Query {
    ListCommands {
        sort_by: SortBy,
        filter: Option<CommandFilter>,
        project_path: Option<String>,
    },
    GetCommand {
        name: String,
    },
    SearchCommands {
        query: String,
        limit: Option<usize>,
        project_path: Option<String>,
    },
    GetCommandHistory {
        name: String,
    },
    GetCommandStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortBy {
    Name,
    ModifiedDate,
    CreatedDate,
    Size,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandFilter {
    pub is_executable: Option<bool>,
    pub has_description: Option<bool>,
    pub modified_after: Option<DateTime<Utc>>,
    pub size_range: Option<(u64, u64)>,
}

// Read model optimized for queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandReadModel {
    pub name: String,
    pub content: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
    pub file_size: u64,
    pub is_executable: bool,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandStats {
    pub total_commands: usize,
    pub total_size: u64,
    pub executable_count: usize,
    pub with_description_count: usize,
    pub average_size: u64,
    pub last_modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandHistoryEntry {
    pub event_type: String,
    pub timestamp: DateTime<Utc>,
    pub details: serde_json::Value,
}

// Query handler with caching
#[derive(Clone)]
pub struct QueryHandler {
    read_store: Arc<RwLock<ReadStore>>,
    cache: Arc<RwLock<QueryCache>>,
}

impl QueryHandler {
    pub fn new(read_store: Arc<RwLock<ReadStore>>) -> Self {
        Self {
            read_store,
            cache: Arc::new(RwLock::new(QueryCache::new())),
        }
    }

    pub async fn handle(&self, query: Query) -> Result<serde_json::Value> {
        // Check cache first
        let cache_key = format!("{:?}", query);
        if let Some(cached) = self.cache.read().await.get(&cache_key).await {
            return Ok(cached);
        }

        // Execute query
        let result = match query {
            Query::ListCommands { sort_by, filter, project_path } => {
                self.handle_list_commands(sort_by, filter, project_path).await?
            }
            Query::GetCommand { name } => {
                self.handle_get_command(name).await?
            }
            Query::SearchCommands { query, limit, project_path } => {
                self.handle_search_commands(query, limit, project_path).await?
            }
            Query::GetCommandHistory { name } => {
                self.handle_get_command_history(name).await?
            }
            Query::GetCommandStats => {
                self.handle_get_command_stats().await?
            }
        };

        // Cache result
        self.cache.write().await.set(cache_key, result.clone()).await;

        Ok(result)
    }

    async fn handle_list_commands(
        &self,
        sort_by: SortBy,
        filter: Option<CommandFilter>,
        project_path: Option<String>,
    ) -> Result<serde_json::Value> {
        let read_store = self.read_store.read().await;
        let mut commands = if let Some(ref path) = project_path {
            read_store.get_all_with_project(Some(path)).await?
        } else {
            read_store.get_all().await?
        };

        // Apply filters
        if let Some(filter) = filter {
            commands = self.apply_filter(commands, filter);
        }

        // Sort
        self.sort_commands(&mut commands, sort_by);

        Ok(serde_json::to_value(commands)?)
    }

    async fn handle_get_command(&self, name: String) -> Result<serde_json::Value> {
        let read_store = self.read_store.read().await;
        let command = read_store.get(&name).await?
            .ok_or_else(|| anyhow::anyhow!("Command '{}' not found", name))?;
        
        Ok(serde_json::to_value(command)?)
    }

    async fn handle_search_commands(
        &self,
        query: String,
        limit: Option<usize>,
        project_path: Option<String>,
    ) -> Result<serde_json::Value> {
        let read_store = self.read_store.read().await;
        let all_commands = if let Some(ref path) = project_path {
            read_store.get_all_with_project(Some(path)).await?
        } else {
            read_store.get_all().await?
        };
        
        let query_lower = query.to_lowercase();
        let mut results: Vec<(CommandReadModel, f64)> = all_commands
            .into_iter()
            .filter_map(|cmd| {
                let score = self.calculate_search_score(&cmd, &query_lower);
                if score > 0.0 {
                    Some((cmd, score))
                } else {
                    None
                }
            })
            .collect();

        // Sort by relevance score
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Apply limit
        if let Some(limit) = limit {
            results.truncate(limit);
        }

        let commands: Vec<CommandReadModel> = results.into_iter().map(|(cmd, _)| cmd).collect();
        Ok(serde_json::to_value(commands)?)
    }

    async fn handle_get_command_history(&self, name: String) -> Result<serde_json::Value> {
        let read_store = self.read_store.read().await;
        let history = read_store.get_history(&name).await?;
        Ok(serde_json::to_value(history)?)
    }

    async fn handle_get_command_stats(&self) -> Result<serde_json::Value> {
        let read_store = self.read_store.read().await;
        let commands = read_store.get_all().await?;

        let total_commands = commands.len();
        let total_size: u64 = commands.iter().map(|c| c.file_size).sum();
        let executable_count = commands.iter().filter(|c| c.is_executable).count();
        let with_description_count = commands.iter().filter(|c| c.description.is_some()).count();
        let average_size = if total_commands > 0 { total_size / total_commands as u64 } else { 0 };
        let last_modified = commands.iter().map(|c| c.modified_at).max();

        let stats = CommandStats {
            total_commands,
            total_size,
            executable_count,
            with_description_count,
            average_size,
            last_modified,
        };

        Ok(serde_json::to_value(stats)?)
    }

    fn apply_filter(&self, commands: Vec<CommandReadModel>, filter: CommandFilter) -> Vec<CommandReadModel> {
        commands.into_iter().filter(|cmd| {
            if let Some(is_exec) = filter.is_executable {
                if cmd.is_executable != is_exec {
                    return false;
                }
            }
            if let Some(has_desc) = filter.has_description {
                if cmd.description.is_some() != has_desc {
                    return false;
                }
            }
            if let Some(modified_after) = filter.modified_after {
                if cmd.modified_at <= modified_after {
                    return false;
                }
            }
            if let Some((min_size, max_size)) = filter.size_range {
                if cmd.file_size < min_size || cmd.file_size > max_size {
                    return false;
                }
            }
            true
        }).collect()
    }

    fn sort_commands(&self, commands: &mut Vec<CommandReadModel>, sort_by: SortBy) {
        match sort_by {
            SortBy::Name => commands.sort_by(|a, b| a.name.cmp(&b.name)),
            SortBy::ModifiedDate => commands.sort_by(|a, b| b.modified_at.cmp(&a.modified_at)),
            SortBy::CreatedDate => commands.sort_by(|a, b| b.created_at.cmp(&a.created_at)),
            SortBy::Size => commands.sort_by(|a, b| b.file_size.cmp(&a.file_size)),
        }
    }

    fn calculate_search_score(&self, cmd: &CommandReadModel, query: &str) -> f64 {
        let mut score = 0.0;

        // Name match (highest weight)
        if cmd.name.to_lowercase().contains(query) {
            score += 10.0;
            if cmd.name.to_lowercase() == query {
                score += 5.0; // Exact match bonus
            }
        }

        // Description match
        if let Some(desc) = &cmd.description {
            if desc.to_lowercase().contains(query) {
                score += 5.0;
            }
        }

        // Content match (lower weight)
        if cmd.content.to_lowercase().contains(query) {
            score += 2.0;
        }

        score
    }

    // Invalidate the cache to force fresh queries
    pub async fn invalidate_cache(&self) {
        self.cache.write().await.invalidate().await;
    }
}

// Read store that maintains denormalized data for fast queries
pub struct ReadStore {
    commands_dir: PathBuf,
    projections: HashMap<String, CommandReadModel>,
    history: HashMap<String, Vec<CommandHistoryEntry>>,
}

impl ReadStore {
    pub fn new() -> Result<Self> {
        let commands_dir = dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not find home directory"))?
            .join(".claude")
            .join("commands");
        
        fs::create_dir_all(&commands_dir)?;
        
        let mut store = Self {
            commands_dir,
            projections: HashMap::new(),
            history: HashMap::new(),
        };
        
        // Initialize projections from disk on startup
        let _ = store.initialize_projections();
        
        Ok(store)
    }
    
    fn initialize_projections(&mut self) -> Result<()> {
        let entries = fs::read_dir(&self.commands_dir)?;
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            
            // Only process .md files
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                if let Ok(cmd) = futures::executor::block_on(self.read_command_from_path(&path)) {
                    self.projections.insert(cmd.name.clone(), cmd);
                }
            }
        }
        Ok(())
    }

    pub async fn get_all(&self) -> Result<Vec<CommandReadModel>> {
        // Always return from projections (initialized on startup)
        Ok(self.projections.values().cloned().collect())
    }
    
    pub async fn get_all_with_project(&self, project_path: Option<&str>) -> Result<Vec<CommandReadModel>> {
        let mut all_commands = Vec::new();
        let mut seen_names = std::collections::HashSet::new();
        
        // Add project commands first (they take precedence) if project path is provided
        if let Some(project_path) = project_path {
            let project_commands_dir = std::path::Path::new(project_path)
                .join(".claude")
                .join("commands");
            
            if project_commands_dir.exists() {
                if let Ok(entries) = fs::read_dir(&project_commands_dir) {
                    for entry in entries {
                        if let Ok(entry) = entry {
                            let path = entry.path();
                            
                            // Only process .md files
                            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                                if let Ok(mut cmd) = self.read_command_from_path(&path).await {
                                    let original_name = cmd.name.clone();
                                    // Mark as project command by prefixing with "project:"
                                    cmd.name = format!("project:{}", cmd.name);
                                    all_commands.push(cmd);
                                    // Track that we've seen this command name
                                    seen_names.insert(original_name);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Add user commands (skip if already exists as project command)
        for cmd in self.projections.values() {
            // Only add if we haven't seen this command name in project commands
            if !seen_names.contains(&cmd.name) {
                all_commands.push(cmd.clone());
            }
        }
        
        Ok(all_commands)
    }

    pub async fn get(&self, name: &str) -> Result<Option<CommandReadModel>> {
        // Check projection first
        if let Some(cmd) = self.projections.get(name) {
            return Ok(Some(cmd.clone()));
        }

        // Fall back to file system with .md extension
        let path = self.commands_dir.join(format!("{}.md", name));
        if path.exists() {
            Ok(Some(self.read_command_from_path(&path).await?))
        } else {
            Ok(None)
        }
    }

    pub async fn get_history(&self, name: &str) -> Result<Vec<CommandHistoryEntry>> {
        Ok(self.history.get(name).cloned().unwrap_or_default())
    }

    pub async fn update_projection(&mut self, name: String, command: CommandReadModel) {
        self.projections.insert(name, command);
    }

    pub async fn remove_projection(&mut self, name: &str) {
        self.projections.remove(name);
        self.history.remove(name);
    }

    pub async fn add_history_entry(&mut self, name: String, entry: CommandHistoryEntry) {
        self.history.entry(name).or_insert_with(Vec::new).push(entry);
    }

    async fn read_command_from_path(&self, path: &std::path::Path) -> Result<CommandReadModel> {
        // Extract name from filename without .md extension
        let name = path.file_stem()
            .and_then(|n| n.to_str())
            .ok_or_else(|| anyhow::anyhow!("Invalid file name"))?
            .to_string();
        
        let file_content = fs::read_to_string(&path)?;
        let metadata = fs::metadata(&path)?;
        
        // Parse YAML frontmatter and content
        let (frontmatter, content) = self.parse_markdown_with_frontmatter(&file_content)?;
        
        // Extract metadata from frontmatter with defaults
        let description = frontmatter.get("description")
            .and_then(|d| d.as_str())
            .map(|s| s.to_string());
        
        let created_at = frontmatter.get("created_at")
            .and_then(|d| d.as_str())
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|| metadata.created()
                .unwrap_or(SystemTime::UNIX_EPOCH)
                .into());
        
        let modified_at = frontmatter.get("modified_at")
            .and_then(|d| d.as_str())
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|| metadata.modified()
                .unwrap_or(SystemTime::UNIX_EPOCH)
                .into());
        
        let version = frontmatter.get("version")
            .and_then(|v| v.as_i64())
            .map(|v| v as u32)
            .unwrap_or(1);
        
        let file_size = metadata.len();
        
        #[cfg(unix)]
        let is_executable = {
            use std::os::unix::fs::PermissionsExt;
            metadata.permissions().mode() & 0o111 != 0
        };
        
        #[cfg(not(unix))]
        let is_executable = false;
        
        Ok(CommandReadModel {
            name,
            content,
            description,
            created_at,
            modified_at,
            file_size,
            is_executable,
            version,
        })
    }
    
    fn parse_markdown_with_frontmatter(&self, content: &str) -> Result<(HashMap<String, Yaml>, String)> {
        let mut lines = content.lines();
        let mut frontmatter_lines = Vec::new();
        let mut content_lines = Vec::new();
        let mut in_frontmatter = false;
        let mut frontmatter_found = false;
        
        // Check if file starts with ---
        if let Some(first_line) = lines.next() {
            if first_line.trim() == "---" {
                in_frontmatter = true;
                frontmatter_found = true;
            } else {
                // No frontmatter, entire content is command
                content_lines.push(first_line);
            }
        }
        
        // Parse the rest
        for line in lines {
            if in_frontmatter {
                if line.trim() == "---" {
                    in_frontmatter = false;
                } else {
                    frontmatter_lines.push(line);
                }
            } else {
                content_lines.push(line);
            }
        }
        
        let mut frontmatter = HashMap::new();
        
        if frontmatter_found && !frontmatter_lines.is_empty() {
            let yaml_content = frontmatter_lines.join("\n");
            if let Ok(docs) = YamlLoader::load_from_str(&yaml_content) {
                if let Some(doc) = docs.first() {
                    if let Yaml::Hash(hash) = doc {
                        for (key, value) in hash {
                            if let Yaml::String(key_str) = key {
                                frontmatter.insert(key_str.clone(), value.clone());
                            }
                        }
                    }
                }
            }
        }
        
        let content = content_lines.join("\n").trim().to_string();
        Ok((frontmatter, content))
    }
}

// Query result cache
struct QueryCache {
    cache: HashMap<String, (serde_json::Value, std::time::Instant)>,
    ttl: std::time::Duration,
}

impl QueryCache {
    fn new() -> Self {
        Self {
            cache: HashMap::new(),
            ttl: std::time::Duration::from_secs(60), // 1 minute TTL
        }
    }

    async fn get(&self, key: &str) -> Option<serde_json::Value> {
        if let Some((value, timestamp)) = self.cache.get(key) {
            if timestamp.elapsed() < self.ttl {
                return Some(value.clone());
            }
        }
        None
    }

    async fn set(&mut self, key: String, value: serde_json::Value) {
        self.cache.insert(key, (value, std::time::Instant::now()));
    }

    async fn invalidate(&mut self) {
        self.cache.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_search_scoring() {
        let read_store = Arc::new(RwLock::new(ReadStore::new().unwrap()));
        let handler = QueryHandler::new(read_store);

        let cmd = CommandReadModel {
            name: "test-command".to_string(),
            content: "echo hello world".to_string(),
            description: Some("A test command for demonstration".to_string()),
            created_at: Utc::now(),
            modified_at: Utc::now(),
            file_size: 100,
            is_executable: false,
            version: 1,
        };

        // Exact name match should have highest score
        assert!(handler.calculate_search_score(&cmd, "test-command") > 10.0);
        
        // Partial name match
        assert!(handler.calculate_search_score(&cmd, "test") > 5.0);
        
        // Description match
        assert!(handler.calculate_search_score(&cmd, "demonstration") > 0.0);
        
        // Content match (lowest score)
        assert!(handler.calculate_search_score(&cmd, "echo") > 0.0);
        
        // No match
        assert_eq!(handler.calculate_search_score(&cmd, "xyz"), 0.0);
    }

    #[tokio::test]
    async fn test_filter_application() {
        let read_store = Arc::new(RwLock::new(ReadStore::new().unwrap()));
        let handler = QueryHandler::new(read_store);

        let commands = vec![
            CommandReadModel {
                name: "cmd1".to_string(),
                content: "content".to_string(),
                description: Some("desc".to_string()),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                file_size: 100,
                is_executable: true,
                version: 1,
            },
            CommandReadModel {
                name: "cmd2".to_string(),
                content: "content".to_string(),
                description: None,
                created_at: Utc::now(),
                modified_at: Utc::now(),
                file_size: 200,
                is_executable: false,
                version: 1,
            },
        ];

        // Filter by executable
        let filter = CommandFilter {
            is_executable: Some(true),
            has_description: None,
            modified_after: None,
            size_range: None,
        };
        let filtered = handler.apply_filter(commands.clone(), filter);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].name, "cmd1");

        // Filter by size range
        let filter = CommandFilter {
            is_executable: None,
            has_description: None,
            modified_after: None,
            size_range: Some((150, 250)),
        };
        let filtered = handler.apply_filter(commands.clone(), filter);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].name, "cmd2");
    }
}
