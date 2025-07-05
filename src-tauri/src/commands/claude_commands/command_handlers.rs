use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use uuid::Uuid;

// Command definitions for write operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Command {
    CreateCommand {
        id: Uuid,
        name: String,
        content: String,
        description: Option<String>,
    },
    UpdateCommand {
        id: Uuid,
        name: String,
        content: String,
        description: Option<String>,
    },
    DeleteCommand {
        id: Uuid,
        name: String,
    },
    RenameCommand {
        id: Uuid,
        old_name: String,
        new_name: String,
    },
    SetExecutable {
        id: Uuid,
        name: String,
        executable: bool,
    },
}

// Events that result from commands
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Event {
    CommandCreated {
        id: Uuid,
        name: String,
        content: String,
        description: Option<String>,
        timestamp: DateTime<Utc>,
    },
    CommandUpdated {
        id: Uuid,
        name: String,
        content: String,
        description: Option<String>,
        timestamp: DateTime<Utc>,
    },
    CommandDeleted {
        id: Uuid,
        name: String,
        timestamp: DateTime<Utc>,
    },
    CommandRenamed {
        id: Uuid,
        old_name: String,
        new_name: String,
        timestamp: DateTime<Utc>,
    },
    ExecutableSet {
        id: Uuid,
        name: String,
        executable: bool,
        timestamp: DateTime<Utc>,
    },
}

// Command validation pipeline
pub struct CommandValidator;

impl CommandValidator {
    pub fn validate(command: &Command) -> Result<()> {
        match command {
            Command::CreateCommand { name, content, .. } |
            Command::UpdateCommand { name, content, .. } => {
                Self::validate_name(name)?;
                Self::validate_content(content)?;
            }
            Command::DeleteCommand { name, .. } |
            Command::SetExecutable { name, .. } => {
                Self::validate_name(name)?;
            }
            Command::RenameCommand { old_name, new_name, .. } => {
                Self::validate_name(old_name)?;
                Self::validate_name(new_name)?;
                if old_name == new_name {
                    anyhow::bail!("Old and new names are the same");
                }
            }
        }
        Ok(())
    }

    fn validate_name(name: &str) -> Result<()> {
        if name.is_empty() {
            anyhow::bail!("Command name cannot be empty");
        }
        if name.len() > 255 {
            anyhow::bail!("Command name too long (max 255 characters)");
        }
        if name.contains('/') || name.contains('\\') {
            anyhow::bail!("Command name cannot contain path separators");
        }
        Ok(())
    }

    fn validate_content(content: &str) -> Result<()> {
        if content.len() > 1_048_576 { // 1MB limit
            anyhow::bail!("Command content too large (max 1MB)");
        }
        Ok(())
    }
}

// Command handler that processes commands and produces events
#[derive(Clone)]
pub struct CommandHandler {
    event_store: Arc<RwLock<EventStore>>,
    write_model: Arc<RwLock<WriteModel>>,
}

impl CommandHandler {
    pub fn new(event_store: Arc<RwLock<EventStore>>, write_model: Arc<RwLock<WriteModel>>) -> Self {
        Self { event_store, write_model }
    }

    pub async fn handle(&self, command: Command) -> Result<Vec<Event>> {
        // Validate command
        CommandValidator::validate(&command)?;

        // Process command and generate events
        let events = match command {
            Command::CreateCommand { id, name, content, description } => {
                self.handle_create_command(id, name, content, description).await?
            }
            Command::UpdateCommand { id, name, content, description } => {
                self.handle_update_command(id, name, content, description).await?
            }
            Command::DeleteCommand { id, name } => {
                self.handle_delete_command(id, name).await?
            }
            Command::RenameCommand { id, old_name, new_name } => {
                self.handle_rename_command(id, old_name, new_name).await?
            }
            Command::SetExecutable { id, name, executable } => {
                self.handle_set_executable(id, name, executable).await?
            }
        };

        // Store events
        let mut event_store = self.event_store.write().await;
        for event in &events {
            event_store.append(event.clone()).await?;
        }

        // Apply events to write model
        let mut write_model = self.write_model.write().await;
        for event in &events {
            write_model.apply(event).await?;
        }

        Ok(events)
    }

    async fn handle_create_command(
        &self,
        id: Uuid,
        name: String,
        content: String,
        description: Option<String>,
    ) -> Result<Vec<Event>> {
        let write_model = self.write_model.read().await;
        
        // Check if command already exists
        if write_model.exists(&name).await? {
            anyhow::bail!("Command '{}' already exists", name);
        }

        Ok(vec![Event::CommandCreated {
            id,
            name,
            content,
            description,
            timestamp: Utc::now(),
        }])
    }

    async fn handle_update_command(
        &self,
        id: Uuid,
        name: String,
        content: String,
        description: Option<String>,
    ) -> Result<Vec<Event>> {
        let write_model = self.write_model.read().await;
        
        // Check if command exists
        if !write_model.exists(&name).await? {
            anyhow::bail!("Command '{}' not found", name);
        }

        Ok(vec![Event::CommandUpdated {
            id,
            name,
            content,
            description,
            timestamp: Utc::now(),
        }])
    }

    async fn handle_delete_command(&self, id: Uuid, name: String) -> Result<Vec<Event>> {
        let write_model = self.write_model.read().await;
        
        // Check if command exists
        if !write_model.exists(&name).await? {
            anyhow::bail!("Command '{}' not found", name);
        }

        Ok(vec![Event::CommandDeleted {
            id,
            name,
            timestamp: Utc::now(),
        }])
    }

    async fn handle_rename_command(
        &self,
        id: Uuid,
        old_name: String,
        new_name: String,
    ) -> Result<Vec<Event>> {
        let write_model = self.write_model.read().await;
        
        // Check if old command exists
        if !write_model.exists(&old_name).await? {
            anyhow::bail!("Command '{}' not found", old_name);
        }

        // Check if new name is available
        if write_model.exists(&new_name).await? {
            anyhow::bail!("Command '{}' already exists", new_name);
        }

        Ok(vec![Event::CommandRenamed {
            id,
            old_name,
            new_name,
            timestamp: Utc::now(),
        }])
    }

    async fn handle_set_executable(
        &self,
        id: Uuid,
        name: String,
        executable: bool,
    ) -> Result<Vec<Event>> {
        let write_model = self.write_model.read().await;
        
        // Check if command exists
        if !write_model.exists(&name).await? {
            anyhow::bail!("Command '{}' not found", name);
        }

        Ok(vec![Event::ExecutableSet {
            id,
            name,
            executable,
            timestamp: Utc::now(),
        }])
    }
}

// Event store for maintaining audit trail
pub struct EventStore {
    events: Vec<Event>,
}

impl EventStore {
    pub fn new() -> Self {
        Self { events: Vec::new() }
    }

    pub async fn append(&mut self, event: Event) -> Result<()> {
        self.events.push(event);
        Ok(())
    }

    pub async fn get_all(&self) -> Vec<Event> {
        self.events.clone()
    }

    // Used in tests to get events filtered by command name
    #[allow(dead_code)]
    pub async fn get_by_command(&self, name: &str) -> Vec<Event> {
        self.events.iter()
            .filter(|event| match event {
                Event::CommandCreated { name: n, .. } |
                Event::CommandUpdated { name: n, .. } |
                Event::CommandDeleted { name: n, .. } |
                Event::ExecutableSet { name: n, .. } => n == name,
                Event::CommandRenamed { old_name, new_name, .. } => {
                    old_name == name || new_name == name
                }
            })
            .cloned()
            .collect()
    }
}

// Write model that maintains current state
pub struct WriteModel {
    commands: std::collections::HashMap<String, WriteCommand>,
    commands_dir: std::path::PathBuf,
}

#[derive(Debug, Clone)]
struct WriteCommand {
    // ID and created_at are stored for future event sourcing features
    // where we might need to replay events or track command history
    #[allow(dead_code)]
    id: Uuid,
    name: String,
    content: String,
    description: Option<String>,
    #[allow(dead_code)]
    created_at: DateTime<Utc>,
    modified_at: DateTime<Utc>,
    is_executable: bool,
    version: u32,
}

impl WriteModel {
    pub fn new() -> Self {
        let commands_dir = dirs::home_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join(".claude")
            .join("commands");
        
        // Ensure the commands directory exists
        let _ = std::fs::create_dir_all(&commands_dir);
        
        Self {
            commands: std::collections::HashMap::new(),
            commands_dir,
        }
    }

    pub async fn exists(&self, name: &str) -> Result<bool> {
        // Check both in-memory and on disk
        if self.commands.contains_key(name) {
            return Ok(true);
        }
        
        // Check for .md file
        let file_path = self.commands_dir.join(format!("{}.md", name));
        Ok(file_path.exists())
    }

    pub async fn apply(&mut self, event: &Event) -> Result<()> {
        match event {
            Event::CommandCreated { id, name, content, description, timestamp } => {
                let cmd = WriteCommand {
                    id: *id,
                    name: name.clone(),
                    content: content.clone(),
                    description: description.clone(),
                    created_at: *timestamp,
                    modified_at: *timestamp,
                    is_executable: false,
                    version: 1,
                };
                
                self.commands.insert(name.clone(), cmd);
                
                // Write to file system
                self.write_command_to_disk(name, content)?;
            }
            Event::CommandUpdated { name, content, description, timestamp, .. } => {
                if let Some(cmd) = self.commands.get_mut(name) {
                    cmd.content = content.clone();
                    cmd.description = description.clone();
                    cmd.modified_at = *timestamp;
                    cmd.version += 1;
                }
                
                // Update file on disk
                self.write_command_to_disk(name, content)?;
            }
            Event::CommandDeleted { name, .. } => {
                self.commands.remove(name);
                
                // Delete .md file from disk
                let file_path = self.commands_dir.join(format!("{}.md", name));
                if file_path.exists() {
                    std::fs::remove_file(file_path)?;
                }
            }
            Event::CommandRenamed { old_name, new_name, timestamp, .. } => {
                if let Some(mut cmd) = self.commands.remove(old_name) {
                    cmd.name = new_name.clone();
                    cmd.modified_at = *timestamp;
                    
                    // Rename .md file on disk
                    let old_path = self.commands_dir.join(format!("{}.md", old_name));
                    let new_path = self.commands_dir.join(format!("{}.md", new_name));
                    if old_path.exists() {
                        std::fs::rename(old_path, new_path)?;
                    }
                    
                    self.commands.insert(new_name.clone(), cmd);
                }
            }
            Event::ExecutableSet { name, executable, timestamp, .. } => {
                if let Some(cmd) = self.commands.get_mut(name) {
                    cmd.is_executable = *executable;
                    cmd.modified_at = *timestamp;
                }
                
                // Update file permissions on disk for .md file
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let file_path = self.commands_dir.join(format!("{}.md", name));
                    if file_path.exists() {
                        let mut perms = std::fs::metadata(&file_path)?.permissions();
                        if *executable {
                            perms.set_mode(perms.mode() | 0o111);
                        } else {
                            perms.set_mode(perms.mode() & !0o111);
                        }
                        std::fs::set_permissions(file_path, perms)?;
                    }
                }
            }
        }
        Ok(())
    }
    
    fn write_command_to_disk(&self, name: &str, content: &str) -> Result<()> {
        // Write as markdown file with .md extension
        let file_path = self.commands_dir.join(format!("{}.md", name));
        
        // Parse description from content (first line starting with # or //)
        let description = content.lines()
            .next()
            .filter(|line| line.starts_with('#') || line.starts_with("//"))
            .map(|line| line.trim_start_matches('#').trim_start_matches("//").trim())
            .unwrap_or("");
        
        // Get command metadata from in-memory store if available
        let (created_at, version) = if let Some(cmd) = self.commands.get(name) {
            (cmd.created_at, cmd.version)
        } else {
            (Utc::now(), 1)
        };
        
        // Create markdown content with YAML frontmatter
        let markdown_content = format!(
            r#"---
name: "{}"
description: "{}"
created_at: "{}"
modified_at: "{}"
version: {}
---

{}"#,
            name,
            description,
            created_at.to_rfc3339(),
            Utc::now().to_rfc3339(),
            version,
            content
        );
        
        std::fs::write(file_path, markdown_content)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_command_validation() {
        // Valid command
        let cmd = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "test".to_string(),
            content: "echo test".to_string(),
            description: None,
        };
        assert!(CommandValidator::validate(&cmd).is_ok());

        // Empty name
        let cmd = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "".to_string(),
            content: "echo test".to_string(),
            description: None,
        };
        assert!(CommandValidator::validate(&cmd).is_err());

        // Name with path separator
        let cmd = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "test/cmd".to_string(),
            content: "echo test".to_string(),
            description: None,
        };
        assert!(CommandValidator::validate(&cmd).is_err());
    }

    #[tokio::test]
    async fn test_create_command_handler() {
        let event_store = Arc::new(RwLock::new(EventStore::new()));
        let write_model = Arc::new(RwLock::new(WriteModel::new()));
        let handler = CommandHandler::new(event_store.clone(), write_model.clone());

        let cmd = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "test".to_string(),
            content: "echo test".to_string(),
            description: Some("Test command".to_string()),
        };

        let events = handler.handle(cmd).await.unwrap();
        assert_eq!(events.len(), 1);

        // Verify event was stored
        let store = event_store.read().await;
        let stored_events = store.get_all().await;
        assert_eq!(stored_events.len(), 1);

        // Verify write model was updated
        let model = write_model.read().await;
        assert!(model.exists("test").await.unwrap());
    }

    #[tokio::test]
    async fn test_rename_command_handler() {
        let event_store = Arc::new(RwLock::new(EventStore::new()));
        let write_model = Arc::new(RwLock::new(WriteModel::new()));
        let handler = CommandHandler::new(event_store.clone(), write_model.clone());

        // Create command first
        let create_cmd = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "old".to_string(),
            content: "echo test".to_string(),
            description: None,
        };
        handler.handle(create_cmd).await.unwrap();

        // Rename command
        let rename_cmd = Command::RenameCommand {
            id: Uuid::new_v4(),
            old_name: "old".to_string(),
            new_name: "new".to_string(),
        };
        let events = handler.handle(rename_cmd).await.unwrap();
        assert_eq!(events.len(), 1);

        // Verify write model was updated
        let model = write_model.read().await;
        assert!(!model.exists("old").await.unwrap());
        assert!(model.exists("new").await.unwrap());
    }
}
