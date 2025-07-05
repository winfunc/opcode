#[cfg(test)]
mod command_handler_tests {
    use super::super::command_handlers::{Command, CommandHandler, Event, EventStore, WriteModel};
    use std::sync::Arc;
    use tokio::sync::RwLock;
    use uuid::Uuid;

    async fn setup_test_handler() -> (CommandHandler, Arc<RwLock<EventStore>>, Arc<RwLock<WriteModel>>) {
        let event_store = Arc::new(RwLock::new(EventStore::new()));
        let write_model = Arc::new(RwLock::new(WriteModel::new()));
        let handler = CommandHandler::new(event_store.clone(), write_model.clone());
        (handler, event_store, write_model)
    }

    #[tokio::test]
    async fn test_create_command_success() {
        let (handler, event_store, write_model) = setup_test_handler().await;

        let command = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "test-cmd".to_string(),
            content: "echo test".to_string(),
            description: Some("Test command".to_string()),
        };

        let events = handler.handle(command).await.unwrap();
        assert_eq!(events.len(), 1);

        match &events[0] {
            Event::CommandCreated { name, content, description, .. } => {
                assert_eq!(name, "test-cmd");
                assert_eq!(content, "echo test");
                assert_eq!(description.as_ref().unwrap(), "Test command");
            }
            _ => panic!("Expected CommandCreated event"),
        }

        // Verify event was stored
        let store = event_store.read().await;
        assert_eq!(store.get_all().await.len(), 1);

        // Verify write model was updated
        let model = write_model.read().await;
        assert!(model.exists("test-cmd").await.unwrap());
    }

    #[tokio::test]
    async fn test_create_duplicate_command_fails() {
        let (handler, _, _) = setup_test_handler().await;

        // Create first command
        let command1 = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "duplicate".to_string(),
            content: "first".to_string(),
            description: None,
        };
        handler.handle(command1).await.unwrap();

        // Try to create duplicate
        let command2 = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "duplicate".to_string(),
            content: "second".to_string(),
            description: None,
        };
        
        let result = handler.handle(command2).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("already exists"));
    }

    #[tokio::test]
    async fn test_update_command_success() {
        let (handler, _, write_model) = setup_test_handler().await;

        // Create command first
        let create = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "update-test".to_string(),
            content: "original".to_string(),
            description: None,
        };
        handler.handle(create).await.unwrap();

        // Update command
        let update = Command::UpdateCommand {
            id: Uuid::new_v4(),
            name: "update-test".to_string(),
            content: "updated".to_string(),
            description: Some("Updated description".to_string()),
        };
        
        let events = handler.handle(update).await.unwrap();
        assert_eq!(events.len(), 1);

        match &events[0] {
            Event::CommandUpdated { name, content, description, .. } => {
                assert_eq!(name, "update-test");
                assert_eq!(content, "updated");
                assert_eq!(description.as_ref().unwrap(), "Updated description");
            }
            _ => panic!("Expected CommandUpdated event"),
        }
    }

    #[tokio::test]
    async fn test_delete_command_success() {
        let (handler, event_store, _) = setup_test_handler().await;

        // Create command first
        let create = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "delete-test".to_string(),
            content: "to be deleted".to_string(),
            description: None,
        };
        handler.handle(create).await.unwrap();

        // Delete command
        let delete = Command::DeleteCommand {
            id: Uuid::new_v4(),
            name: "delete-test".to_string(),
        };
        
        let events = handler.handle(delete).await.unwrap();
        assert_eq!(events.len(), 1);

        match &events[0] {
            Event::CommandDeleted { name, .. } => {
                assert_eq!(name, "delete-test");
            }
            _ => panic!("Expected CommandDeleted event"),
        }

        // Verify event history
        let store = event_store.read().await;
        assert_eq!(store.get_all().await.len(), 2); // Create + Delete
    }

    #[tokio::test]
    async fn test_rename_command_success() {
        let (handler, _, write_model) = setup_test_handler().await;

        // Create command first
        let create = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "old-name".to_string(),
            content: "content".to_string(),
            description: None,
        };
        handler.handle(create).await.unwrap();

        // Rename command
        let rename = Command::RenameCommand {
            id: Uuid::new_v4(),
            old_name: "old-name".to_string(),
            new_name: "new-name".to_string(),
        };
        
        let events = handler.handle(rename).await.unwrap();
        assert_eq!(events.len(), 1);

        match &events[0] {
            Event::CommandRenamed { old_name, new_name, .. } => {
                assert_eq!(old_name, "old-name");
                assert_eq!(new_name, "new-name");
            }
            _ => panic!("Expected CommandRenamed event"),
        }

        // Verify write model reflects the change
        let model = write_model.read().await;
        assert!(!model.exists("old-name").await.unwrap());
        assert!(model.exists("new-name").await.unwrap());
    }

    #[tokio::test]
    async fn test_set_executable_success() {
        let (handler, _, _) = setup_test_handler().await;

        // Create command first
        let create = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "exec-test".to_string(),
            content: "#!/bin/bash\necho test".to_string(),
            description: None,
        };
        handler.handle(create).await.unwrap();

        // Set executable
        let set_exec = Command::SetExecutable {
            id: Uuid::new_v4(),
            name: "exec-test".to_string(),
            executable: true,
        };
        
        let events = handler.handle(set_exec).await.unwrap();
        assert_eq!(events.len(), 1);

        match &events[0] {
            Event::ExecutableSet { name, executable, .. } => {
                assert_eq!(name, "exec-test");
                assert_eq!(*executable, true);
            }
            _ => panic!("Expected ExecutableSet event"),
        }
    }

    #[tokio::test]
    async fn test_command_validation() {
        let (handler, _, _) = setup_test_handler().await;

        // Test empty name
        let invalid_name = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "".to_string(),
            content: "content".to_string(),
            description: None,
        };
        assert!(handler.handle(invalid_name).await.is_err());

        // Test name with path separator
        let invalid_path = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "test/command".to_string(),
            content: "content".to_string(),
            description: None,
        };
        assert!(handler.handle(invalid_path).await.is_err());

        // Test empty content
        let empty_content = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "test".to_string(),
            content: "".to_string(),
            description: None,
        };
        assert!(handler.handle(empty_content).await.is_err());

        // Test content too large (> 1MB)
        let large_content = Command::CreateCommand {
            id: Uuid::new_v4(),
            name: "test".to_string(),
            content: "x".repeat(1_048_577),
            description: None,
        };
        assert!(handler.handle(large_content).await.is_err());
    }

    #[tokio::test]
    async fn test_event_store_filtering() {
        let (handler, event_store, _) = setup_test_handler().await;

        // Create multiple commands
        for i in 0..3 {
            let create = Command::CreateCommand {
                id: Uuid::new_v4(),
                name: format!("cmd-{}", i),
                content: format!("content-{}", i),
                description: None,
            };
            handler.handle(create).await.unwrap();
        }

        // Update one command
        let update = Command::UpdateCommand {
            id: Uuid::new_v4(),
            name: "cmd-1".to_string(),
            content: "updated".to_string(),
            description: None,
        };
        handler.handle(update).await.unwrap();

        // Get events for specific command
        let store = event_store.read().await;
        let cmd1_events = store.get_by_command("cmd-1").await;
        assert_eq!(cmd1_events.len(), 2); // Create + Update

        // Get all events
        let all_events = store.get_all().await;
        assert_eq!(all_events.len(), 4); // 3 Creates + 1 Update
    }

    #[tokio::test]
    async fn test_concurrent_command_handling() {
        let (handler, _, write_model) = setup_test_handler().await;

        // Create multiple commands concurrently
        let mut handles = vec![];
        
        for i in 0..10 {
            let handler_clone = handler.clone();
            let handle = tokio::spawn(async move {
                let command = Command::CreateCommand {
                    id: Uuid::new_v4(),
                    name: format!("concurrent-{}", i),
                    content: format!("content-{}", i),
                    description: None,
                };
                handler_clone.handle(command).await
            });
            handles.push(handle);
        }

        // Wait for all to complete
        for handle in handles {
            assert!(handle.await.unwrap().is_ok());
        }

        // Verify all commands were created
        let model = write_model.read().await;
        for i in 0..10 {
            assert!(model.exists(&format!("concurrent-{}", i)).await.unwrap());
        }
    }
}