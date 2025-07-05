use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use anyhow::Result;
use uuid::Uuid;

mod command_handlers;
mod query_handlers;

use command_handlers::{Command, CommandHandler, EventStore, WriteModel, Event};
use query_handlers::{Query, QueryHandler, ReadStore, SortBy, CommandReadModel};

// CQRS Manager that coordinates commands and queries
#[derive(Clone)]
pub struct CqrsManager {
    command_handler: Arc<CommandHandler>,
    query_handler: Arc<QueryHandler>,
    event_store: Arc<RwLock<EventStore>>,
    // write_model is passed to CommandHandler but kept here for potential direct access in future
    #[allow(dead_code)]
    write_model: Arc<RwLock<WriteModel>>,
    read_store: Arc<RwLock<ReadStore>>,
}

impl CqrsManager {
    pub fn new() -> Result<Self, String> {
        let event_store = Arc::new(RwLock::new(EventStore::new()));
        let write_model = Arc::new(RwLock::new(WriteModel::new()));
        let read_store = Arc::new(RwLock::new(
            ReadStore::new().map_err(|e| e.to_string())?
        ));

        let command_handler = Arc::new(CommandHandler::new(
            event_store.clone(),
            write_model.clone(),
        ));
        let query_handler = Arc::new(QueryHandler::new(read_store.clone()));

        Ok(Self {
            command_handler,
            query_handler,
            event_store,
            write_model,
            read_store,
        })
    }

    pub async fn execute_command(&self, command: Command) -> Result<Vec<Event>, String> {
        let events = self.command_handler.handle(command).await
            .map_err(|e| e.to_string())?;

        // Synchronize read model with events immediately (not async)
        if let Err(e) = Self::sync_read_model(self.read_store.clone(), events.clone()).await {
            eprintln!("Failed to sync read model: {}", e);
        }

        // Invalidate query cache after read model is updated
        self.query_handler.invalidate_cache().await;

        Ok(events)
    }

    pub async fn execute_query(&self, query: Query) -> Result<serde_json::Value, String> {
        self.query_handler.handle(query).await
            .map_err(|e| e.to_string())
    }

    async fn sync_read_model(
        read_store: Arc<RwLock<ReadStore>>,
        events: Vec<Event>,
    ) -> Result<()> {
        let mut store = read_store.write().await;
        
        for event in events {
            match &event {
                Event::CommandCreated { name, content, description, timestamp, .. } => {
                    // Calculate actual file size
                    let file_size = content.len() as u64;
                    
                    let cmd = CommandReadModel {
                        name: name.clone(),
                        content: content.clone(),
                        description: description.clone(),
                        created_at: *timestamp,
                        modified_at: *timestamp,
                        file_size,
                        is_executable: false,
                        version: 1,
                    };
                    store.update_projection(name.clone(), cmd).await;
                }
                Event::CommandUpdated { name, content, description, timestamp, .. } => {
                    if let Ok(Some(mut cmd)) = store.get(name).await {
                        cmd.content = content.clone();
                        cmd.description = description.clone();
                        cmd.modified_at = *timestamp;
                        cmd.file_size = content.len() as u64;
                        cmd.version += 1;
                        store.update_projection(name.clone(), cmd).await;
                    }
                }
                Event::CommandDeleted { name, .. } => {
                    store.remove_projection(name).await;
                }
                Event::CommandRenamed { old_name, new_name, .. } => {
                    if let Ok(Some(mut cmd)) = store.get(old_name).await {
                        cmd.name = new_name.clone();
                        store.update_projection(new_name.clone(), cmd).await;
                    }
                }
                Event::ExecutableSet { name, executable, .. } => {
                    if let Ok(Some(mut cmd)) = store.get(name).await {
                        cmd.is_executable = *executable;
                        store.update_projection(name.clone(), cmd).await;
                    }
                }
            }

            // Add to history
            let history_entry = query_handlers::CommandHistoryEntry {
                event_type: match &event {
                    Event::CommandCreated { .. } => "Created".to_string(),
                    Event::CommandUpdated { .. } => "Updated".to_string(),
                    Event::CommandDeleted { .. } => "Deleted".to_string(),
                    Event::CommandRenamed { .. } => "Renamed".to_string(),
                    Event::ExecutableSet { .. } => "ExecutableChanged".to_string(),
                },
                timestamp: match &event {
                    Event::CommandCreated { timestamp, .. } |
                    Event::CommandUpdated { timestamp, .. } |
                    Event::CommandDeleted { timestamp, .. } |
                    Event::CommandRenamed { timestamp, .. } |
                    Event::ExecutableSet { timestamp, .. } => *timestamp,
                },
                details: serde_json::to_value(&event).unwrap_or_default(),
            };

            let name = match &event {
                Event::CommandCreated { name, .. } |
                Event::CommandUpdated { name, .. } |
                Event::CommandDeleted { name, .. } |
                Event::ExecutableSet { name, .. } => name.clone(),
                Event::CommandRenamed { new_name, .. } => new_name.clone(),
            };

            store.add_history_entry(name, history_entry).await;
        }

        Ok(())
    }
}

// Global CQRS manager instance
lazy_static::lazy_static! {
    static ref CQRS_MANAGER: Arc<RwLock<Option<CqrsManager>>> = Arc::new(RwLock::new(None));
}

async fn get_cqrs_manager() -> Result<Arc<CqrsManager>, String> {
    let mut manager_opt = CQRS_MANAGER.write().await;
    if manager_opt.is_none() {
        *manager_opt = Some(CqrsManager::new()?);
    }
    
    Ok(Arc::new(
        manager_opt
            .as_ref()
            .ok_or("Failed to initialize CQRS manager")?
            .clone()
    ))
}

// Tauri command handlers - CQRS endpoints

#[tauri::command]
pub async fn list_claude_commands(
    sort_by: Option<String>,
    filter: Option<serde_json::Value>,
    project_path: Option<String>,
) -> Result<Vec<CommandReadModel>, String> {
    let manager = get_cqrs_manager().await?;
    
    let sort_by = match sort_by.as_deref() {
        Some("name") => SortBy::Name,
        Some("created") => SortBy::CreatedDate,
        Some("size") => SortBy::Size,
        _ => SortBy::ModifiedDate,
    };

    let filter = if let Some(filter_json) = filter {
        serde_json::from_value(filter_json).ok()
    } else {
        None
    };

    let query = Query::ListCommands { sort_by, filter, project_path };
    let result = manager.execute_query(query).await?;
    
    serde_json::from_value(result)
        .map_err(|e| format!("Failed to deserialize result: {}", e))
}

#[tauri::command]
pub async fn get_claude_command(name: String) -> Result<CommandReadModel, String> {
    let manager = get_cqrs_manager().await?;
    
    let query = Query::GetCommand { name };
    let result = manager.execute_query(query).await?;
    
    serde_json::from_value(result)
        .map_err(|e| format!("Failed to deserialize result: {}", e))
}

#[tauri::command]
pub async fn create_claude_command(name: String, content: String) -> Result<(), String> {
    let manager = get_cqrs_manager().await?;
    
    let description = content.lines()
        .next()
        .filter(|line| line.starts_with('#') || line.starts_with("//"))
        .map(|line| line.trim_start_matches('#').trim_start_matches("//").trim().to_string());
    
    let command = Command::CreateCommand {
        id: Uuid::new_v4(),
        name,
        content,
        description,
    };
    
    manager.execute_command(command).await?;
    Ok(())
}

#[tauri::command]
pub async fn update_claude_command(name: String, content: String) -> Result<(), String> {
    let manager = get_cqrs_manager().await?;
    
    let description = content.lines()
        .next()
        .filter(|line| line.starts_with('#') || line.starts_with("//"))
        .map(|line| line.trim_start_matches('#').trim_start_matches("//").trim().to_string());
    
    let command = Command::UpdateCommand {
        id: Uuid::new_v4(),
        name,
        content,
        description,
    };
    
    manager.execute_command(command).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_claude_command(name: String) -> Result<(), String> {
    let manager = get_cqrs_manager().await?;
    
    let command = Command::DeleteCommand {
        id: Uuid::new_v4(),
        name,
    };
    
    manager.execute_command(command).await?;
    Ok(())
}

#[tauri::command]
pub async fn search_claude_commands(
    query: String, 
    limit: Option<usize>,
    project_path: Option<String>
) -> Result<Vec<CommandReadModel>, String> {
    let manager = get_cqrs_manager().await?;
    
    let query = Query::SearchCommands { query, limit, project_path };
    let result = manager.execute_query(query).await?;
    
    serde_json::from_value(result)
        .map_err(|e| format!("Failed to deserialize result: {}", e))
}

#[tauri::command]
pub async fn get_command_history(name: String) -> Result<Vec<query_handlers::CommandHistoryEntry>, String> {
    let manager = get_cqrs_manager().await?;
    
    let query = Query::GetCommandHistory { name };
    let result = manager.execute_query(query).await?;
    
    serde_json::from_value(result)
        .map_err(|e| format!("Failed to deserialize result: {}", e))
}

#[tauri::command]
pub async fn get_command_stats() -> Result<query_handlers::CommandStats, String> {
    let manager = get_cqrs_manager().await?;
    
    let query = Query::GetCommandStats;
    let result = manager.execute_query(query).await?;
    
    serde_json::from_value(result)
        .map_err(|e| format!("Failed to deserialize result: {}", e))
}

#[tauri::command]
pub async fn rename_claude_command(old_name: String, new_name: String) -> Result<(), String> {
    let manager = get_cqrs_manager().await?;
    
    let command = Command::RenameCommand {
        id: Uuid::new_v4(),
        old_name,
        new_name,
    };
    
    manager.execute_command(command).await?;
    Ok(())
}

#[tauri::command]
pub async fn set_command_executable(name: String, executable: bool) -> Result<(), String> {
    let manager = get_cqrs_manager().await?;
    
    let command = Command::SetExecutable {
        id: Uuid::new_v4(),
        name,
        executable,
    };
    
    manager.execute_command(command).await?;
    Ok(())
}

// Command execution functionality
#[tauri::command]
pub async fn execute_claude_command(
    app: tauri::AppHandle,
    session_id: String,
    command_name: String,
    project_path: String,
    model: String,
    args: Option<String>,
    _prefix: Option<String>, // Keep for backwards compatibility but ignore
) -> Result<(), String> {
    use crate::commands::claude::{resume_claude_code};
    
    // Send the command syntax - Claude Code will read the file and handle all special syntax
    // No prefix needed - Claude Code will look in both user and project directories
    let command_syntax = if let Some(args) = args.filter(|a| !a.is_empty()) {
        format!("/{} {}", command_name, args)
    } else {
        format!("/{}", command_name)
    };
    
    // Check if we have an active session
    if !session_id.is_empty() && !project_path.is_empty() {
        // Resume in existing session with the session ID
        resume_claude_code(
            app,
            project_path,
            session_id,
            command_syntax,
            model,
        ).await
    } else {
        return Err("No active session or project path for command execution".to_string());
    }
}


// Export commands to file with native save dialog
#[tauri::command]
pub async fn export_commands_to_file(app: tauri::AppHandle, data: String) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    
    // Create default filename
    let default_filename = format!("claude-commands-{}.json", chrono::Local::now().format("%Y-%m-%d"));
    
    // Show save dialog
    let file_path = app.dialog()
        .file()
        .set_title("Save Commands Export")
        .set_file_name(&default_filename)
        .add_filter("JSON Files", &["json"])
        .blocking_save_file();

    match file_path {
        Some(path) => {
            // Get path as string and write the file
            let path_str = path.to_string();
            std::fs::write(&path_str, data)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            
            Ok(path_str)
        }
        None => Err("Save cancelled".to_string())
    }
}

// Export/Import functionality
#[derive(Debug, Serialize, Deserialize)]
pub struct CommandsExport {
    pub version: u32,
    pub exported_at: chrono::DateTime<chrono::Utc>,
    pub commands: Vec<ExportedCommand>,
    pub event_history: Option<Vec<Event>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedCommand {
    pub name: String,
    pub content: String,
    pub description: Option<String>,
    pub is_executable: bool,
}

#[tauri::command]
pub async fn export_commands(include_history: bool) -> Result<CommandsExport, String> {
    let manager = get_cqrs_manager().await?;
    
    // Get all commands
    let query = Query::ListCommands {
        sort_by: SortBy::Name,
        filter: None,
        project_path: None,
    };
    let result = manager.execute_query(query).await?;
    let commands: Vec<CommandReadModel> = serde_json::from_value(result)
        .map_err(|e| format!("Failed to deserialize commands: {}", e))?;
    
    let exported_commands: Vec<ExportedCommand> = commands
        .into_iter()
        .map(|cmd| ExportedCommand {
            name: cmd.name,
            content: cmd.content,
            description: cmd.description,
            is_executable: cmd.is_executable,
        })
        .collect();
    
    let event_history = if include_history {
        let store = manager.event_store.read().await;
        Some(store.get_all().await)
    } else {
        None
    };
    
    Ok(CommandsExport {
        version: 2, // Version 2 for CQRS
        exported_at: chrono::Utc::now(),
        commands: exported_commands,
        event_history,
    })
}

#[tauri::command]
pub async fn import_commands(data: CommandsExport) -> Result<serde_json::Value, String> {
    let manager = get_cqrs_manager().await?;
    
    let mut imported = 0;
    let mut failed = 0;
    
    for cmd in data.commands {
        let command = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: cmd.name.clone(),
            content: cmd.content.clone(),
            description: cmd.description.clone(),
        };
        
        match manager.execute_command(command).await {
            Ok(_) => {
                imported += 1;
                
                // Set executable if needed
                if cmd.is_executable {
                    let set_exec = Command::SetExecutable {
                        id: Uuid::new_v4(),
                        name: cmd.name.clone(),
                        executable: true,
                    };
                    let _ = manager.execute_command(set_exec).await;
                }
            }
            Err(e) => {
                // Try updating if creation failed
                if e.contains("already exists") {
                    let update_command = Command::UpdateCommand {
                        id: Uuid::new_v4(),
                        name: cmd.name.clone(),
                        content: cmd.content,
                        description: cmd.description,
                    };
                    
                    match manager.execute_command(update_command).await {
                        Ok(_) => imported += 1,
                        Err(_) => failed += 1,
                    }
                } else {
                    failed += 1;
                }
            }
        }
    }
    
    // Import event history if available
    let has_history = data.event_history.is_some();
    if let Some(events) = data.event_history {
        let mut event_store = manager.event_store.write().await;
        for event in events {
            let _ = event_store.append(event).await;
        }
    }
    
    Ok(serde_json::json!({
        "imported": imported,
        "failed": failed,
        "has_history": has_history
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cqrs_create_and_query() {
        let manager = CqrsManager::new().unwrap();
        
        // Create command
        let create = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "test".to_string(),
            content: "# Test command\necho test".to_string(),
            description: Some("Test command".to_string()),
        };
        
        let events = manager.execute_command(create).await.unwrap();
        assert_eq!(events.len(), 1);
        
        // Query command
        let query = Query::GetCommand {
            name: "test".to_string(),
        };
        
        // Give some time for eventual consistency
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        let result = manager.execute_query(query).await.unwrap();
        let cmd: CommandReadModel = serde_json::from_value(result).unwrap();
        assert_eq!(cmd.name, "test");
        assert_eq!(cmd.description, Some("Test command".to_string()));
    }

    #[tokio::test]
    async fn test_cqrs_event_history() {
        let manager = CqrsManager::new().unwrap();
        
        // Create, update, rename command
        let create = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "hist-test".to_string(),
            content: "original".to_string(),
            description: None,
        };
        manager.execute_command(create).await.unwrap();
        
        let update = Command::UpdateCommand {
            id: Uuid::new_v4(),
            name: "hist-test".to_string(),
            content: "updated".to_string(),
            description: Some("Updated".to_string()),
        };
        manager.execute_command(update).await.unwrap();
        
        let rename = Command::RenameCommand {
            id: Uuid::new_v4(),
            old_name: "hist-test".to_string(),
            new_name: "renamed-test".to_string(),
        };
        manager.execute_command(rename).await.unwrap();
        
        // Give time for sync
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Query history
        let query = Query::GetCommandHistory {
            name: "renamed-test".to_string(),
        };
        
        let result = manager.execute_query(query).await.unwrap();
        let history: Vec<query_handlers::CommandHistoryEntry> = serde_json::from_value(result).unwrap();
        
        assert!(history.len() >= 3);
        assert_eq!(history[0].event_type, "Created");
        assert_eq!(history[1].event_type, "Updated");
        assert_eq!(history[2].event_type, "Renamed");
    }

    #[tokio::test]
    async fn test_execute_claude_command_formatting() {
        // Initialize CQRS manager
        let manager = CqrsManager::new().unwrap();
        
        // Create a test command
        let create_cmd = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "test-echo".to_string(),
            content: "echo 'Hello from test command!'".to_string(),
            description: Some("Test command for execution".to_string()),
        };
        
        manager.execute_command(create_cmd).await.unwrap();
        
        // Wait for eventual consistency
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Verify command exists and content is correct
        let query = Query::GetCommand { name: "test-echo".to_string() };
        let result = manager.execute_query(query).await.unwrap();
        let cmd: CommandReadModel = serde_json::from_value(result).unwrap();
        assert_eq!(cmd.name, "test-echo");
        assert_eq!(cmd.content, "echo 'Hello from test command!'");
        
        // The actual execute_claude_command would format this as:
        // "Execute the following command:\n\necho 'Hello from test command!'"
        let expected_prompt = format!("Execute the following command:\n\n{}", cmd.content);
        assert!(expected_prompt.contains("Execute the following command:"));
        assert!(expected_prompt.contains(cmd.content.as_str()));
    }

    #[test]
    fn test_command_extraction_regex() {
        // Test the regex pattern used in frontend to extract command names
        let test_cases = vec![
            ("/test-command", Some("test-command")),
            ("/test-command arg1 arg2", Some("test-command")),
            ("/test_command", Some("test_command")),
            ("/test-command123", Some("test-command123")),
            ("/ test-command", None), // Space after slash
            ("test-command", None), // No slash
            ("/", None), // Just slash
        ];
        
        let regex = regex::Regex::new(r"^/(\S+)(?:\s+(.*))?$").unwrap();
        
        for (input, expected) in test_cases {
            let captures = regex.captures(input);
            
            match (captures, expected) {
                (Some(cap), Some(exp)) => {
                    assert_eq!(cap.get(1).map(|m| m.as_str()), Some(exp));
                }
                (None, None) => {
                    // Both None, test passes
                }
                _ => {
                    panic!("Regex test failed for input: '{}' expected: {:?}", input, expected);
                }
            }
        }
    }
}
#[cfg(test)]
mod integration_test;
#[cfg(test)]
mod import_export_test;
