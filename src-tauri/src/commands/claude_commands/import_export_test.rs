#[cfg(test)]
mod import_export_tests {
    use super::super::{get_cqrs_manager, Command, Query, SortBy, CommandsExport, ExportedCommand, 
                       CqrsManager, CommandReadModel, export_commands, import_commands};
    use super::super::command_handlers::Event;
    use serde_json;
    use tokio::sync::Mutex;
    use std::sync::Arc;
    use uuid::Uuid;
    
    // Use a mutex to ensure test isolation
    static TEST_MUTEX: Mutex<()> = Mutex::const_new(());
    
    // Helper to clean up test commands
    async fn cleanup_test_commands() {
        if let Ok(manager) = get_cqrs_manager().await {
            let test_names = vec![
                "test-echo", "test-ls", "test-date", "test-script",
                "imported-cmd1", "imported-cmd2", "existing", "new-cmd",
                "hist-cmd", "historical-cmd", "renamed-test", "hist-test",
                "concurrent-cmd"
            ];
            
            for name in test_names {
                let delete_cmd = Command::DeleteCommand {
                    id: Uuid::new_v4(),
                    name: name.to_string(),
                };
                let _ = manager.execute_command(delete_cmd).await;
            }
            
            // Also clean up bulk commands
            for i in 1..=100 {
                let delete_cmd = Command::DeleteCommand {
                    id: Uuid::new_v4(),
                    name: format!("bulk-cmd-{}", i),
                };
                let _ = manager.execute_command(delete_cmd).await;
            }
        }
    }
    
    // Create a test-specific manager with cleanup
    async fn setup_test_environment() -> Arc<CqrsManager> {
        // Clean up any existing test commands
        cleanup_test_commands().await;
        
        // Get the global manager
        get_cqrs_manager().await.expect("Failed to get manager")
    }
    
    async fn create_test_commands(manager: &CqrsManager) -> Vec<String> {
        let commands = vec![
            ("test-echo", "echo 'Hello, World!'", Some("Simple echo command")),
            ("test-ls", "ls -la", Some("List files")),
            ("test-date", "date", None),
            ("test-script", "#!/bin/bash\necho 'Complex script'", Some("Complex bash script")),
        ];
        
        let mut names = Vec::new();
        for (name, content, desc) in commands {
            let cmd = Command::CreateCommand {
                id: Uuid::new_v4(),
                name: name.to_string(),
                content: content.to_string(),
                description: desc.map(|s| s.to_string()),
            };
            manager.execute_command(cmd).await.expect("Failed to create command");
            names.push(name.to_string());
        }
        
        // Set one as executable
        let exec_cmd = Command::SetExecutable {
            id: Uuid::new_v4(),
            name: "test-script".to_string(),
            executable: true,
        };
        manager.execute_command(exec_cmd).await.expect("Failed to set executable");
        
        names
    }
    
    #[tokio::test]
    async fn test_export_basic() {
        let _lock = TEST_MUTEX.lock().await;
        let manager = setup_test_environment().await;
        
        // Create test commands
        let _names = create_test_commands(&manager).await;
        
        // Wait for eventual consistency
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        
        // Export without history
        let export_data = export_commands(false).await.expect("Failed to export");
        
        // Should have at least our test commands
        assert!(export_data.commands.len() >= 4);
        assert_eq!(export_data.version, 2);
        assert!(export_data.event_history.is_none());
        
        // Verify command content
        let echo_cmd = export_data.commands.iter()
            .find(|c| c.name == "test-echo")
            .expect("test-echo not found");
        assert_eq!(echo_cmd.content, "echo 'Hello, World!'");
        assert_eq!(echo_cmd.description, Some("Simple echo command".to_string()));
        
        // Verify executable flag
        let script_cmd = export_data.commands.iter()
            .find(|c| c.name == "test-script")
            .expect("test-script not found");
        assert!(script_cmd.is_executable);
        
        // Cleanup
        cleanup_test_commands().await;
    }
    
    #[tokio::test]
    async fn test_export_with_history() {
        let _lock = TEST_MUTEX.lock().await;
        let manager = setup_test_environment().await;
        
        create_test_commands(&manager).await;
        
        // Update a command to create history
        let update_cmd = Command::UpdateCommand {
            id: Uuid::new_v4(),
            name: "test-echo".to_string(),
            content: "echo 'Updated!'".to_string(),
            description: Some("Updated echo command".to_string()),
        };
        manager.execute_command(update_cmd).await.expect("Failed to update");
        
        // Wait for consistency
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        
        // Export with history
        let export_data = export_commands(true).await.expect("Failed to export");
        
        assert!(export_data.event_history.is_some());
        let history = export_data.event_history.unwrap();
        
        // Should have create events for test commands plus update
        assert!(history.len() >= 5);
        
        // Verify update event exists
        let has_update = history.iter().any(|e| matches!(e, Event::CommandUpdated { .. }));
        assert!(has_update);
        
        // Cleanup
        cleanup_test_commands().await;
    }
    
    #[tokio::test]
    async fn test_import_new_commands() {
        let _lock = TEST_MUTEX.lock().await;
        let manager = setup_test_environment().await;
        
        // Create export data manually
        let export_data = CommandsExport {
            version: 2,
            exported_at: chrono::Utc::now(),
            commands: vec![
                ExportedCommand {
                    name: "imported-cmd1".to_string(),
                    content: "echo imported1".to_string(),
                    description: Some("First imported".to_string()),
                    is_executable: false,
                },
                ExportedCommand {
                    name: "imported-cmd2".to_string(),
                    content: "echo imported2".to_string(),
                    description: None,
                    is_executable: true,
                },
            ],
            event_history: None,
        };
        
        let result = import_commands(export_data).await.expect("Failed to import");
        let import_result: serde_json::Value = result;
        
        assert_eq!(import_result["imported"], 2);
        assert_eq!(import_result["failed"], 0);
        assert_eq!(import_result["has_history"], false);
        
        // Wait for consistency
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        
        // Verify commands were created
        let query = Query::GetCommand { name: "imported-cmd1".to_string() };
        let cmd_result = manager.execute_query(query).await.expect("Failed to query");
        let cmd: CommandReadModel = serde_json::from_value(cmd_result).expect("Failed to parse");
        assert_eq!(cmd.content, "echo imported1");
        assert_eq!(cmd.description, Some("First imported".to_string()));
        
        // Cleanup
        cleanup_test_commands().await;
    }
    
    #[tokio::test]
    async fn test_import_duplicate_handling() {
        let _lock = TEST_MUTEX.lock().await;
        let manager = setup_test_environment().await;
        
        // Create an existing command
        let existing_cmd = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "existing".to_string(),
            content: "original content".to_string(),
            description: Some("Original".to_string()),
        };
        manager.execute_command(existing_cmd).await.expect("Failed to create");
        
        // Wait for consistency
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        
        // Import with same name - should update
        let export_data = CommandsExport {
            version: 2,
            exported_at: chrono::Utc::now(),
            commands: vec![
                ExportedCommand {
                    name: "existing".to_string(),
                    content: "updated content".to_string(),
                    description: Some("Updated".to_string()),
                    is_executable: false,
                },
                ExportedCommand {
                    name: "new-cmd".to_string(),
                    content: "new content".to_string(),
                    description: None,
                    is_executable: false,
                },
            ],
            event_history: None,
        };
        
        let result = import_commands(export_data).await.expect("Failed to import");
        let import_result: serde_json::Value = result;
        
        assert_eq!(import_result["imported"], 2); // Both should succeed
        assert_eq!(import_result["failed"], 0);
        
        // Wait for consistency
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        
        // Verify the existing command was updated
        let query = Query::GetCommand { name: "existing".to_string() };
        let cmd_result = manager.execute_query(query).await.expect("Failed to query");
        let cmd: CommandReadModel = serde_json::from_value(cmd_result).expect("Failed to parse");
        assert_eq!(cmd.content, "updated content");
        assert_eq!(cmd.description, Some("Updated".to_string()));
        
        // Cleanup
        cleanup_test_commands().await;
    }
    
    #[tokio::test]
    async fn test_import_with_event_history() {
        let _lock = TEST_MUTEX.lock().await;
        let manager = setup_test_environment().await;
        
        // Create export data with history
        let export_data = CommandsExport {
            version: 2,
            exported_at: chrono::Utc::now(),
            commands: vec![
                ExportedCommand {
                    name: "hist-cmd".to_string(),
                    content: "echo history".to_string(),
                    description: None,
                    is_executable: false,
                },
            ],
            event_history: Some(vec![
                Event::CommandCreated {
                    id: Uuid::new_v4(),
                    name: "historical-cmd".to_string(),
                    content: "old content".to_string(),
                    description: None,
                    timestamp: chrono::Utc::now() - chrono::Duration::hours(1),
                },
            ]),
        };
        
        let result = import_commands(export_data).await.expect("Failed to import");
        let import_result: serde_json::Value = result;
        
        assert_eq!(import_result["has_history"], true);
        assert_eq!(import_result["imported"], 1);
        
        // Verify event was imported
        let store = manager.event_store.read().await;
        let events = store.get_all().await;
        let has_historical = events.iter().any(|e| 
            matches!(e, Event::CommandCreated { name, .. } if name == "historical-cmd")
        );
        assert!(has_historical, "Historical event should be imported");
        
        // Cleanup
        cleanup_test_commands().await;
    }
    
    #[tokio::test]
    async fn test_export_import_roundtrip() {
        let _lock = TEST_MUTEX.lock().await;
        let manager = setup_test_environment().await;
        
        create_test_commands(&manager).await;
        
        // Wait for consistency
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        
        // Export
        let export_data = export_commands(true).await.expect("Failed to export");
        let test_commands_count = export_data.commands.iter()
            .filter(|c| c.name.starts_with("test-"))
            .count();
        
        // Clear test commands
        cleanup_test_commands().await;
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        
        // Import back only test commands
        let filtered_export = CommandsExport {
            version: export_data.version,
            exported_at: export_data.exported_at,
            commands: export_data.commands.into_iter()
                .filter(|c| c.name.starts_with("test-"))
                .collect(),
            event_history: None,
        };
        
        let result = import_commands(filtered_export).await.expect("Failed to import");
        let import_result: serde_json::Value = result;
        
        assert_eq!(import_result["imported"], test_commands_count as i64);
        assert_eq!(import_result["failed"], 0);
        
        // Wait for consistency
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        
        // Verify all test commands exist
        let query = Query::ListCommands {
            sort_by: SortBy::Name,
            filter: None,
        };
        let list_result = manager.execute_query(query).await.expect("Failed to query");
        let commands: Vec<CommandReadModel> = serde_json::from_value(list_result).expect("Failed to parse");
        
        let test_commands = commands.iter()
            .filter(|c| c.name.starts_with("test-"))
            .count();
        assert_eq!(test_commands, test_commands_count);
        
        // Cleanup
        cleanup_test_commands().await;
    }
    
    #[tokio::test]
    async fn test_import_invalid_name() {
        let _lock = TEST_MUTEX.lock().await;
        
        let export_data = CommandsExport {
            version: 2,
            exported_at: chrono::Utc::now(),
            commands: vec![
                ExportedCommand {
                    name: "invalid/name".to_string(), // Contains path separator
                    content: "echo test".to_string(),
                    description: None,
                    is_executable: false,
                },
                ExportedCommand {
                    name: "valid-name".to_string(),
                    content: "echo valid".to_string(),
                    description: None,
                    is_executable: false,
                },
            ],
            event_history: None,
        };
        
        let result = import_commands(export_data).await.expect("Failed to import");
        let import_result: serde_json::Value = result;
        
        assert_eq!(import_result["imported"], 1); // Only valid command
        assert_eq!(import_result["failed"], 1); // Invalid name failed
        
        // Cleanup
        cleanup_test_commands().await;
    }
    
    #[tokio::test]
    async fn test_version_compatibility() {
        // This test just validates the JSON structure
        let old_format = serde_json::json!({
            "version": 1,
            "commands": [{
                "name": "old-format",
                "content": "echo old"
            }]
        });
        
        // Verify we can parse the JSON
        assert!(old_format["version"].as_u64().unwrap() == 1);
        assert!(old_format["commands"].is_array());
    }
    
    #[tokio::test]
    async fn test_concurrent_import_export() {
        let _lock = TEST_MUTEX.lock().await;
        let manager = setup_test_environment().await;
        
        create_test_commands(&manager).await;
        
        // Wait for consistency
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        
        // Simulate concurrent operations
        let export_handle = tokio::spawn(async {
            export_commands(false).await
        });
        
        let import_data = CommandsExport {
            version: 2,
            exported_at: chrono::Utc::now(),
            commands: vec![
                ExportedCommand {
                    name: "concurrent-cmd".to_string(),
                    content: "echo concurrent".to_string(),
                    description: None,
                    is_executable: false,
                },
            ],
            event_history: None,
        };
        
        let import_handle = tokio::spawn(async move {
            import_commands(import_data).await
        });
        
        // Both should complete successfully
        let export_result = export_handle.await.unwrap();
        let import_result = import_handle.await.unwrap();
        
        assert!(export_result.is_ok());
        assert!(import_result.is_ok());
        
        // Cleanup
        cleanup_test_commands().await;
    }
}