use anyhow::Result;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::manager::CheckpointManager;

/// Manages checkpoint managers for active sessions
///
/// This struct maintains a stateful collection of CheckpointManager instances,
/// one per active session, to avoid recreating them on every command invocation.
/// It provides thread-safe access to managers and handles their lifecycle.
#[derive(Default, Clone)]
pub struct CheckpointState {
    /// Map of session_id to CheckpointManager
    /// Uses Arc<CheckpointManager> to allow sharing across async boundaries
    managers: Arc<RwLock<HashMap<String, Arc<CheckpointManager>>>>,
    /// The Claude directory path for consistent access
    claude_dir: Arc<RwLock<Option<PathBuf>>>,
}

impl CheckpointState {
    /// Creates a new CheckpointState instance
    pub fn new() -> Self {
        Self {
            managers: Arc::new(RwLock::new(HashMap::new())),
            claude_dir: Arc::new(RwLock::new(None)),
        }
    }

    /// Sets the Claude directory path
    ///
    /// This should be called once during application initialization
    pub async fn set_claude_dir(&self, claude_dir: PathBuf) {
        let mut dir = self.claude_dir.write().await;
        *dir = Some(claude_dir);
    }

    /// Gets or creates a CheckpointManager for a session
    ///
    /// If a manager already exists for the session, it returns the existing one.
    /// Otherwise, it creates a new manager and stores it for future use.
    ///
    /// # Arguments
    /// * `session_id` - The session identifier
    /// * `project_id` - The project identifier
    /// * `project_path` - The path to the project directory
    ///
    /// # Returns
    /// An Arc reference to the CheckpointManager for thread-safe sharing
    pub async fn get_or_create_manager(
        &self,
        session_id: String,
        project_id: String,
        project_path: PathBuf,
    ) -> Result<Arc<CheckpointManager>> {
        let mut managers = self.managers.write().await;

        // Check if manager already exists
        if let Some(manager) = managers.get(&session_id) {
            return Ok(Arc::clone(manager));
        }

        // Get Claude directory
        let claude_dir = {
            let dir = self.claude_dir.read().await;
            dir.as_ref()
                .ok_or_else(|| anyhow::anyhow!("Claude directory not set"))?
                .clone()
        };

        // Create new manager
        let manager =
            CheckpointManager::new(project_id, session_id.clone(), project_path, claude_dir)
                .await?;

        let manager_arc = Arc::new(manager);
        managers.insert(session_id, Arc::clone(&manager_arc));

        Ok(manager_arc)
    }

    /// Gets an existing CheckpointManager for a session
    ///
    /// Returns None if no manager exists for the session
    #[allow(dead_code)]
    pub async fn get_manager(&self, session_id: &str) -> Option<Arc<CheckpointManager>> {
        let managers = self.managers.read().await;
        managers.get(session_id).map(Arc::clone)
    }

    /// Removes a CheckpointManager for a session
    ///
    /// This should be called when a session ends to free resources
    pub async fn remove_manager(&self, session_id: &str) -> Option<Arc<CheckpointManager>> {
        let mut managers = self.managers.write().await;
        managers.remove(session_id)
    }

    /// Clears all managers
    ///
    /// This is useful for cleanup during application shutdown
    #[allow(dead_code)]
    pub async fn clear_all(&self) {
        let mut managers = self.managers.write().await;
        managers.clear();
    }

    /// Gets the number of active managers
    pub async fn active_count(&self) -> usize {
        let managers = self.managers.read().await;
        managers.len()
    }

    /// Lists all active session IDs
    pub async fn list_active_sessions(&self) -> Vec<String> {
        let managers = self.managers.read().await;
        managers.keys().cloned().collect()
    }

    /// Checks if a session has an active manager
    #[allow(dead_code)]
    pub async fn has_active_manager(&self, session_id: &str) -> bool {
        self.get_manager(session_id).await.is_some()
    }

    /// Clears all managers and returns the count that were cleared
    #[allow(dead_code)]
    pub async fn clear_all_and_count(&self) -> usize {
        let count = self.active_count().await;
        self.clear_all().await;
        count
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_checkpoint_state_lifecycle() {
        let state = CheckpointState::new();
        let temp_dir = TempDir::new().unwrap();
        let claude_dir = temp_dir.path().to_path_buf();

        // Set Claude directory
        state.set_claude_dir(claude_dir.clone()).await;

        // Create a manager
        let session_id = "test-session-123".to_string();
        let project_id = "test-project".to_string();
        let project_path = temp_dir.path().join("project");
        std::fs::create_dir_all(&project_path).unwrap();

        let manager1 = state
            .get_or_create_manager(session_id.clone(), project_id.clone(), project_path.clone())
            .await
            .unwrap();

        // Getting the same session should return the same manager
        let manager2 = state
            .get_or_create_manager(session_id.clone(), project_id.clone(), project_path.clone())
            .await
            .unwrap();

        assert!(Arc::ptr_eq(&manager1, &manager2));
        assert_eq!(state.active_count().await, 1);

        // Remove the manager
        let removed = state.remove_manager(&session_id).await;
        assert!(removed.is_some());
        assert_eq!(state.active_count().await, 0);

        // Getting after removal should create a new one
        let manager3 = state
            .get_or_create_manager(session_id.clone(), project_id, project_path)
            .await
            .unwrap();

        assert!(!Arc::ptr_eq(&manager1, &manager3));
    }
}
