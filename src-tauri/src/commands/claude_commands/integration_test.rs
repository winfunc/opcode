#[cfg(test)]
mod integration_tests {
    use super::super::{CqrsManager, Command, Query, SortBy, CommandReadModel, CommandsExport, ExportedCommand};
    use super::super::query_handlers::{CommandFilter, CommandStats, CommandHistoryEntry};
    use uuid::Uuid;
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_full_cqrs_workflow() {
        // Create CQRS manager
        let manager = CqrsManager::new().unwrap();
        
        // 1. Create a command
        let create_cmd = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "workflow-test".to_string(),
            content: "# Test Workflow\necho 'Hello CQRS'".to_string(),
            description: Some("Test Workflow".to_string()),
        };
        
        let create_events = manager.execute_command(create_cmd).await.unwrap();
        assert_eq!(create_events.len(), 1);
        
        // Wait for eventual consistency
        sleep(Duration::from_millis(100)).await;
        
        // 2. Query the command
        let get_query = Query::GetCommand {
            name: "workflow-test".to_string(),
        };
        let result = manager.execute_query(get_query).await.unwrap();
        let cmd: CommandReadModel = serde_json::from_value(result).unwrap();
        
        assert_eq!(cmd.name, "workflow-test");
        assert_eq!(cmd.description, Some("Test Workflow".to_string()));
        assert_eq!(cmd.version, 1);
        
        // 3. Update the command
        let update_cmd = Command::UpdateCommand {
            id: Uuid::new_v4(),
            name: "workflow-test".to_string(),
            content: "# Updated Workflow\necho 'Hello Updated CQRS'".to_string(),
            description: Some("Updated Workflow".to_string()),
        };
        
        let update_events = manager.execute_command(update_cmd).await.unwrap();
        assert_eq!(update_events.len(), 1);
        
        sleep(Duration::from_millis(100)).await;
        
        // 4. Verify update
        let get_query = Query::GetCommand {
            name: "workflow-test".to_string(),
        };
        let result = manager.execute_query(get_query).await.unwrap();
        let cmd: CommandReadModel = serde_json::from_value(result).unwrap();
        
        assert_eq!(cmd.content, "# Updated Workflow\necho 'Hello Updated CQRS'");
        assert_eq!(cmd.version, 2);
        
        // 5. Check history
        let history_query = Query::GetCommandHistory {
            name: "workflow-test".to_string(),
        };
        let result = manager.execute_query(history_query).await.unwrap();
        let history: Vec<CommandHistoryEntry> = serde_json::from_value(result).unwrap();
        
        assert!(history.len() >= 2);
        assert_eq!(history[0].event_type, "Created");
        assert_eq!(history[1].event_type, "Updated");
        
        // 6. Search for the command
        let search_query = Query::SearchCommands {
            query: "workflow".to_string(),
            limit: None,
        };
        let result = manager.execute_query(search_query).await.unwrap();
        let commands: Vec<CommandReadModel> = serde_json::from_value(result).unwrap();
        
        assert!(commands.iter().any(|c| c.name == "workflow-test"));
        
        // 7. Get statistics
        let stats_query = Query::GetCommandStats;
        let result = manager.execute_query(stats_query).await.unwrap();
        let stats: CommandStats = serde_json::from_value(result).unwrap();
        
        assert!(stats.total_commands >= 1);
        assert!(stats.with_description_count >= 1);
    }

    #[tokio::test]
    async fn test_concurrent_operations() {
        let manager = CqrsManager::new().unwrap();
        
        // Create multiple commands concurrently
        let mut handles = vec![];
        
        for i in 0..5 {
            let manager_clone = manager.clone();
            let handle = tokio::spawn(async move {
                let cmd = Command::CreateCommand {
                    id: Uuid::new_v4(),
                    name: format!("concurrent-{}", i),
                    content: format!("echo {}", i),
                    description: None,
                };
                manager_clone.execute_command(cmd).await
            });
            handles.push(handle);
        }
        
        // Wait for all to complete
        for handle in handles {
            assert!(handle.await.unwrap().is_ok());
        }
        
        // Wait for eventual consistency
        sleep(Duration::from_millis(200)).await;
        
        // Query all commands
        let list_query = Query::ListCommands {
            sort_by: SortBy::Name,
            filter: None,
        };
        let result = manager.execute_query(list_query).await.unwrap();
        let commands: Vec<CommandReadModel> = serde_json::from_value(result).unwrap();
        
        // Verify all were created
        for i in 0..5 {
            assert!(commands.iter().any(|c| c.name == format!("concurrent-{}", i)));
        }
    }

    #[tokio::test]
    async fn test_event_sourcing_consistency() {
        let manager = CqrsManager::new().unwrap();
        
        // Create and modify a command multiple times
        let cmd_name = "event-test";
        
        // Create
        let create = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: cmd_name.to_string(),
            content: "v1".to_string(),
            description: None,
        };
        manager.execute_command(create).await.unwrap();
        
        // Multiple updates
        for i in 2..=5 {
            let update = Command::UpdateCommand {
                id: Uuid::new_v4(),
                name: cmd_name.to_string(),
                content: format!("v{}", i),
                description: None,
            };
            manager.execute_command(update).await.unwrap();
        }
        
        // Rename
        let rename = Command::RenameCommand {
            id: Uuid::new_v4(),
            old_name: cmd_name.to_string(),
            new_name: "event-test-renamed".to_string(),
        };
        manager.execute_command(rename).await.unwrap();
        
        // Wait for consistency
        sleep(Duration::from_millis(100)).await;
        
        // Verify final state
        let query = Query::GetCommand {
            name: "event-test-renamed".to_string(),
        };
        let result = manager.execute_query(query).await.unwrap();
        let cmd: CommandReadModel = serde_json::from_value(result).unwrap();
        
        assert_eq!(cmd.name, "event-test-renamed");
        assert_eq!(cmd.content, "v5");
        assert_eq!(cmd.version, 6); // 1 create + 4 updates + 1 rename
        
        // Verify old name doesn't exist
        let old_query = Query::GetCommand {
            name: cmd_name.to_string(),
        };
        assert!(manager.execute_query(old_query).await.is_err());
        
        // Check event history
        let history_query = Query::GetCommandHistory {
            name: "event-test-renamed".to_string(),
        };
        let result = manager.execute_query(history_query).await.unwrap();
        let history: Vec<CommandHistoryEntry> = serde_json::from_value(result).unwrap();
        
        assert_eq!(history.len(), 6);
        assert_eq!(history[0].event_type, "Created");
        assert_eq!(history[5].event_type, "Renamed");
    }

    #[tokio::test]
    async fn test_export_import_with_history() {
        let manager = CqrsManager::new().unwrap();
        
        // Create some commands with history
        for i in 0..3 {
            let create = Command::CreateCommand {
                id: Uuid::new_v4(),
                name: format!("export-{}", i),
                content: format!("content-{}", i),
                description: Some(format!("Export test {}", i)),
            };
            manager.execute_command(create).await.unwrap();
            
            // Update each one
            let update = Command::UpdateCommand {
                id: Uuid::new_v4(),
                name: format!("export-{}", i),
                content: format!("updated-content-{}", i),
                description: Some(format!("Updated export test {}", i)),
            };
            manager.execute_command(update).await.unwrap();
        }
        
        sleep(Duration::from_millis(100)).await;
        
        // Export with history
        let list_query = Query::ListCommands {
            sort_by: SortBy::Name,
            filter: None,
        };
        let result = manager.execute_query(list_query).await.unwrap();
        let commands: Vec<CommandReadModel> = serde_json::from_value(result).unwrap();
        
        let export_commands: Vec<ExportedCommand> = commands
            .into_iter()
            .filter(|c| c.name.starts_with("export-"))
            .map(|c| ExportedCommand {
                name: c.name,
                content: c.content,
                description: c.description,
                is_executable: c.is_executable,
            })
            .collect();
        
        let event_store = manager.event_store.read().await;
        let all_events = event_store.get_all().await;
        
        let export_data = CommandsExport {
            version: 2,
            exported_at: chrono::Utc::now(),
            commands: export_commands,
            event_history: Some(all_events),
        };
        
        // Simulate import in a new manager
        let new_manager = CqrsManager::new().unwrap();
        
        // Import should handle existing commands gracefully
        for cmd in &export_data.commands {
            let create = Command::CreateCommand {
                id: Uuid::new_v4(),
                name: cmd.name.clone(),
                content: cmd.content.clone(),
                description: cmd.description.clone(),
            };
            let _ = new_manager.execute_command(create).await; // Might fail if exists
        }
        
        // Import event history
        if let Some(events) = &export_data.event_history {
            let mut event_store = new_manager.event_store.write().await;
            for event in events {
                let _ = event_store.append(event.clone()).await;
            }
        }
        
        // Verify import
        let list_query = Query::ListCommands {
            sort_by: SortBy::Name,
            filter: None,
        };
        let result = new_manager.execute_query(list_query).await.unwrap();
        let imported_commands: Vec<CommandReadModel> = serde_json::from_value(result).unwrap();
        
        assert!(imported_commands.iter().filter(|c| c.name.starts_with("export-")).count() >= 3);
    }

    #[tokio::test]
    async fn test_query_performance_with_cache() {
        let manager = CqrsManager::new().unwrap();
        
        // Create many commands
        for i in 0..100 {
            let cmd = Command::CreateCommand {
                id: Uuid::new_v4(),
                name: format!("perf-{:03}", i),
                content: format!("Performance test {}", i),
                description: if i % 2 == 0 { Some(format!("Description {}", i)) } else { None },
            };
            manager.execute_command(cmd).await.unwrap();
        }
        
        sleep(Duration::from_millis(200)).await;
        
        // First query (cache miss)
        let start = std::time::Instant::now();
        let query = Query::ListCommands {
            sort_by: SortBy::Name,
            filter: Some(CommandFilter {
                has_description: Some(true),
                is_executable: None,
                modified_after: None,
                size_range: None,
            }),
        };
        let _result1 = manager.execute_query(query.clone()).await.unwrap();
        let first_duration = start.elapsed();
        
        // Second query (cache hit)
        let start = std::time::Instant::now();
        let _result2 = manager.execute_query(query).await.unwrap();
        let second_duration = start.elapsed();
        
        // Verify both queries return same result
        assert_eq!(_result1, _result2);
        
        // Log performance difference (cache should be faster)
        println!("First query: {:?}, Second query (cached): {:?}", first_duration, second_duration);
        
        // Verify filtered results
        let commands: Vec<CommandReadModel> = serde_json::from_value(_result1).unwrap();
        assert_eq!(commands.len(), 50); // Half have descriptions
        assert!(commands.iter().all(|c| c.description.is_some()));
    }
}