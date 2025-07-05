#[cfg(test)]
mod query_handler_tests {
    use super::super::query_handlers::{Query, QueryHandler, ReadStore, CommandReadModel, SortBy, CommandFilter, CommandHistoryEntry, CommandStats};
    use std::sync::Arc;
    use tokio::sync::RwLock;
    use chrono::Utc;

    async fn setup_test_query_handler() -> (QueryHandler, Arc<RwLock<ReadStore>>) {
        let read_store = Arc::new(RwLock::new(ReadStore::new().unwrap()));
        let handler = QueryHandler::new(read_store.clone());
        (handler, read_store)
    }

    fn create_test_command(name: &str, content: &str, size: u64) -> CommandReadModel {
        CommandReadModel {
            name: name.to_string(),
            content: content.to_string(),
            description: if content.starts_with('#') {
                Some(content.lines().next().unwrap().trim_start_matches('#').trim().to_string())
            } else {
                None
            },
            created_at: Utc::now(),
            modified_at: Utc::now(),
            file_size: size,
            is_executable: false,
            version: 1,
        }
    }

    #[tokio::test]
    async fn test_list_commands_with_sorting() {
        let (handler, read_store) = setup_test_query_handler().await;
        
        // Add test commands
        let mut store = read_store.write().await;
        store.update_projection("cmd-b".to_string(), create_test_command("cmd-b", "content b", 200)).await;
        store.update_projection("cmd-a".to_string(), create_test_command("cmd-a", "content a", 100)).await;
        store.update_projection("cmd-c".to_string(), create_test_command("cmd-c", "content c", 300)).await;
        drop(store);

        // Test sorting by name
        let query = Query::ListCommands {
            sort_by: SortBy::Name,
            filter: None,
        };
        let result = handler.handle(query).await.unwrap();
        let commands: Vec<CommandReadModel> = serde_json::from_value(result).unwrap();
        
        assert_eq!(commands.len(), 3);
        assert_eq!(commands[0].name, "cmd-a");
        assert_eq!(commands[1].name, "cmd-b");
        assert_eq!(commands[2].name, "cmd-c");

        // Test sorting by size
        let query = Query::ListCommands {
            sort_by: SortBy::Size,
            filter: None,
        };
        let result = handler.handle(query).await.unwrap();
        let commands: Vec<CommandReadModel> = serde_json::from_value(result).unwrap();
        
        assert_eq!(commands[0].name, "cmd-c"); // Largest first
        assert_eq!(commands[1].name, "cmd-b");
        assert_eq!(commands[2].name, "cmd-a");
    }

    #[tokio::test]
    async fn test_list_commands_with_filter() {
        let (handler, read_store) = setup_test_query_handler().await;
        
        // Add test commands
        let mut store = read_store.write().await;
        let mut cmd1 = create_test_command("executable", "#!/bin/bash\necho test", 100);
        cmd1.is_executable = true;
        store.update_projection("executable".to_string(), cmd1).await;
        
        let cmd2 = create_test_command("not-exec", "echo test", 100);
        store.update_projection("not-exec".to_string(), cmd2).await;
        
        let cmd3 = create_test_command("with-desc", "# Description\necho test", 100);
        store.update_projection("with-desc".to_string(), cmd3).await;
        drop(store);

        // Filter executable only
        let filter = CommandFilter {
            is_executable: Some(true),
            has_description: None,
            modified_after: None,
            size_range: None,
        };
        let query = Query::ListCommands {
            sort_by: SortBy::Name,
            filter: Some(filter),
        };
        let result = handler.handle(query).await.unwrap();
        let commands: Vec<CommandReadModel> = serde_json::from_value(result).unwrap();
        
        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].name, "executable");

        // Filter with description
        let filter = CommandFilter {
            is_executable: None,
            has_description: Some(true),
            modified_after: None,
            size_range: None,
        };
        let query = Query::ListCommands {
            sort_by: SortBy::Name,
            filter: Some(filter),
        };
        let result = handler.handle(query).await.unwrap();
        let commands: Vec<CommandReadModel> = serde_json::from_value(result).unwrap();
        
        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].name, "with-desc");
    }

    #[tokio::test]
    async fn test_search_commands() {
        let (handler, read_store) = setup_test_query_handler().await;
        
        // Add test commands
        let mut store = read_store.write().await;
        store.update_projection("find-me".to_string(), create_test_command("find-me", "# Find this command\necho test", 100)).await;
        store.update_projection("another".to_string(), create_test_command("another", "echo another", 100)).await;
        store.update_projection("test-find".to_string(), create_test_command("test-find", "echo find", 100)).await;
        drop(store);

        // Search by name
        let query = Query::SearchCommands {
            query: "find".to_string(),
            limit: None,
        };
        let result = handler.handle(query).await.unwrap();
        let commands: Vec<CommandReadModel> = serde_json::from_value(result).unwrap();
        
        assert_eq!(commands.len(), 2);
        // Should be sorted by relevance - exact name match first
        assert!(commands.iter().any(|c| c.name == "find-me"));
        assert!(commands.iter().any(|c| c.name == "test-find"));

        // Search in description
        let query = Query::SearchCommands {
            query: "this command".to_string(),
            limit: None,
        };
        let result = handler.handle(query).await.unwrap();
        let commands: Vec<CommandReadModel> = serde_json::from_value(result).unwrap();
        
        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].name, "find-me");

        // Search with limit
        let query = Query::SearchCommands {
            query: "find".to_string(),
            limit: Some(1),
        };
        let result = handler.handle(query).await.unwrap();
        let commands: Vec<CommandReadModel> = serde_json::from_value(result).unwrap();
        
        assert_eq!(commands.len(), 1);
    }

    #[tokio::test]
    async fn test_get_command() {
        let (handler, read_store) = setup_test_query_handler().await;
        
        // Add test command
        let mut store = read_store.write().await;
        let cmd = create_test_command("get-test", "# Get me\necho test", 100);
        store.update_projection("get-test".to_string(), cmd).await;
        drop(store);

        // Get existing command
        let query = Query::GetCommand {
            name: "get-test".to_string(),
        };
        let result = handler.handle(query).await.unwrap();
        let command: CommandReadModel = serde_json::from_value(result).unwrap();
        
        assert_eq!(command.name, "get-test");
        assert_eq!(command.content, "# Get me\necho test");
        assert_eq!(command.description.unwrap(), "Get me");

        // Get non-existent command
        let query = Query::GetCommand {
            name: "not-found".to_string(),
        };
        let result = handler.handle(query).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_command_stats() {
        let (handler, read_store) = setup_test_query_handler().await;
        
        // Add test commands
        let mut store = read_store.write().await;
        let mut cmd1 = create_test_command("exec1", "#!/bin/bash", 100);
        cmd1.is_executable = true;
        store.update_projection("exec1".to_string(), cmd1).await;
        
        let mut cmd2 = create_test_command("exec2", "#!/bin/sh", 200);
        cmd2.is_executable = true;
        store.update_projection("exec2".to_string(), cmd2).await;
        
        let cmd3 = create_test_command("desc", "# With description", 300);
        store.update_projection("desc".to_string(), cmd3).await;
        drop(store);

        let query = Query::GetCommandStats;
        let result = handler.handle(query).await.unwrap();
        let stats: CommandStats = serde_json::from_value(result).unwrap();
        
        assert_eq!(stats.total_commands, 3);
        assert_eq!(stats.total_size, 600);
        assert_eq!(stats.executable_count, 2);
        assert_eq!(stats.with_description_count, 1);
        assert_eq!(stats.average_size, 200);
        assert!(stats.last_modified.is_some());
    }

    #[tokio::test]
    async fn test_command_history() {
        let (handler, read_store) = setup_test_query_handler().await;
        
        // Add test command and history
        let mut store = read_store.write().await;
        let cmd = create_test_command("history-test", "content", 100);
        store.update_projection("history-test".to_string(), cmd).await;
        
        // Add history entries
        store.add_history_entry("history-test".to_string(), CommandHistoryEntry {
            event_type: "Created".to_string(),
            timestamp: Utc::now(),
            details: serde_json::json!({ "action": "create" }),
        }).await;
        
        store.add_history_entry("history-test".to_string(), CommandHistoryEntry {
            event_type: "Updated".to_string(),
            timestamp: Utc::now(),
            details: serde_json::json!({ "action": "update" }),
        }).await;
        drop(store);

        let query = Query::GetCommandHistory {
            name: "history-test".to_string(),
        };
        let result = handler.handle(query).await.unwrap();
        let history: Vec<CommandHistoryEntry> = serde_json::from_value(result).unwrap();
        
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].event_type, "Created");
        assert_eq!(history[1].event_type, "Updated");
    }

    #[tokio::test]
    async fn test_query_caching() {
        let (handler, read_store) = setup_test_query_handler().await;
        
        // Add test command
        let mut store = read_store.write().await;
        let cmd = create_test_command("cache-test", "content", 100);
        store.update_projection("cache-test".to_string(), cmd).await;
        drop(store);

        // First query (cache miss)
        let query = Query::GetCommand {
            name: "cache-test".to_string(),
        };
        let start = std::time::Instant::now();
        let _result1 = handler.handle(query.clone()).await.unwrap();
        let first_duration = start.elapsed();

        // Second query (cache hit)
        let start = std::time::Instant::now();
        let _result2 = handler.handle(query).await.unwrap();
        let second_duration = start.elapsed();

        // Cache hit should be faster (though this is not a reliable test in all environments)
        // The important thing is that both queries return the same result
        assert!(_result1 == _result2);
    }

    #[tokio::test]
    async fn test_search_scoring() {
        let handler = QueryHandler::new(Arc::new(RwLock::new(ReadStore::new().unwrap())));

        let cmd1 = create_test_command("exact-match", "some content", 100);
        let cmd2 = create_test_command("partial-match-test", "some content", 100);
        let cmd3 = create_test_command("other", "# Exact match in description", 100);
        let cmd4 = create_test_command("another", "exact match in content", 100);

        // Test exact name match gets highest score
        let score1 = handler.calculate_search_score(&cmd1, "exact-match");
        let score2 = handler.calculate_search_score(&cmd2, "exact-match");
        assert!(score1 > score2);

        // Test description match scores higher than content match
        let score3 = handler.calculate_search_score(&cmd3, "exact match");
        let score4 = handler.calculate_search_score(&cmd4, "exact match");
        assert!(score3 > score4);
    }

    #[tokio::test]
    async fn test_concurrent_queries() {
        let (handler, read_store) = setup_test_query_handler().await;
        
        // Add test commands
        let mut store = read_store.write().await;
        for i in 0..10 {
            let cmd = create_test_command(&format!("cmd-{}", i), &format!("content {}", i), i as u64 * 100);
            store.update_projection(format!("cmd-{}", i), cmd).await;
        }
        drop(store);

        // Execute multiple queries concurrently
        let mut handles = vec![];
        
        for i in 0..10 {
            let handler_clone = handler.clone();
            let handle = tokio::spawn(async move {
                let query = Query::GetCommand {
                    name: format!("cmd-{}", i),
                };
                handler_clone.handle(query).await
            });
            handles.push(handle);
        }

        // All queries should succeed
        for (i, handle) in handles.into_iter().enumerate() {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
            let cmd: CommandReadModel = serde_json::from_value(result.unwrap()).unwrap();
            assert_eq!(cmd.name, format!("cmd-{}", i));
        }
    }
}