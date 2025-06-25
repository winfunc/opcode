use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

pub mod manager;
pub mod state;
pub mod storage;

/// Represents a checkpoint in the session timeline
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Checkpoint {
    /// Unique identifier for the checkpoint
    pub id: String,
    /// Session ID this checkpoint belongs to
    pub session_id: String,
    /// Project ID for the session
    pub project_id: String,
    /// Index of the last message in this checkpoint
    pub message_index: usize,
    /// Timestamp when checkpoint was created
    pub timestamp: DateTime<Utc>,
    /// User-provided description
    pub description: Option<String>,
    /// Parent checkpoint ID for fork tracking
    pub parent_checkpoint_id: Option<String>,
    /// Metadata about the checkpoint
    pub metadata: CheckpointMetadata,
}

/// Metadata associated with a checkpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointMetadata {
    /// Total tokens used up to this point
    pub total_tokens: u64,
    /// Model used for the last operation
    pub model_used: String,
    /// The user prompt that led to this state
    pub user_prompt: String,
    /// Number of file changes in this checkpoint
    pub file_changes: usize,
    /// Size of all file snapshots in bytes
    pub snapshot_size: u64,
}

/// Represents a snapshot of a file at a checkpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSnapshot {
    /// Checkpoint this snapshot belongs to
    pub checkpoint_id: String,
    /// Relative path from project root
    pub file_path: PathBuf,
    /// Full content of the file (will be compressed)
    pub content: String,
    /// SHA-256 hash for integrity verification
    pub hash: String,
    /// Whether this file was deleted at this checkpoint
    pub is_deleted: bool,
    /// File permissions (Unix mode)
    pub permissions: Option<u32>,
    /// File size in bytes
    pub size: u64,
}

/// Represents a node in the timeline tree
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineNode {
    /// The checkpoint at this node
    pub checkpoint: Checkpoint,
    /// Child nodes (for branches/forks)
    pub children: Vec<TimelineNode>,
    /// IDs of file snapshots associated with this checkpoint
    pub file_snapshot_ids: Vec<String>,
}

/// The complete timeline for a session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTimeline {
    /// Session ID this timeline belongs to
    pub session_id: String,
    /// Root node of the timeline tree
    pub root_node: Option<TimelineNode>,
    /// ID of the current active checkpoint
    pub current_checkpoint_id: Option<String>,
    /// Whether auto-checkpointing is enabled
    pub auto_checkpoint_enabled: bool,
    /// Strategy for automatic checkpoints
    pub checkpoint_strategy: CheckpointStrategy,
    /// Total number of checkpoints in timeline
    pub total_checkpoints: usize,
}

/// Strategy for automatic checkpoint creation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckpointStrategy {
    /// Only create checkpoints manually
    Manual,
    /// Create checkpoint after each user prompt
    PerPrompt,
    /// Create checkpoint after each tool use
    PerToolUse,
    /// Create checkpoint after destructive operations
    Smart,
}

/// Tracks the state of files for checkpointing
#[derive(Debug, Clone)]
pub struct FileTracker {
    /// Map of file paths to their current state
    pub tracked_files: HashMap<PathBuf, FileState>,
}

/// State of a tracked file
#[derive(Debug, Clone)]
pub struct FileState {
    /// Last known hash of the file
    pub last_hash: String,
    /// Whether the file has been modified since last checkpoint
    pub is_modified: bool,
    /// Last modification timestamp
    pub last_modified: DateTime<Utc>,
    /// Whether the file currently exists
    pub exists: bool,
}

/// Result of a checkpoint operation
#[derive(Debug, Serialize, Deserialize)]
pub struct CheckpointResult {
    /// The created/restored checkpoint
    pub checkpoint: Checkpoint,
    /// Number of files snapshot/restored
    pub files_processed: usize,
    /// Any warnings during the operation
    pub warnings: Vec<String>,
}

/// Diff between two checkpoints
#[derive(Debug, Serialize, Deserialize)]
pub struct CheckpointDiff {
    /// Source checkpoint ID
    pub from_checkpoint_id: String,
    /// Target checkpoint ID  
    pub to_checkpoint_id: String,
    /// Files that were modified
    pub modified_files: Vec<FileDiff>,
    /// Files that were added
    pub added_files: Vec<PathBuf>,
    /// Files that were deleted
    pub deleted_files: Vec<PathBuf>,
    /// Token usage difference
    pub token_delta: i64,
}

/// Diff for a single file
#[derive(Debug, Serialize, Deserialize)]
pub struct FileDiff {
    /// File path
    pub path: PathBuf,
    /// Number of additions
    pub additions: usize,
    /// Number of deletions
    pub deletions: usize,
    /// Unified diff content (optional)
    pub diff_content: Option<String>,
}

impl Default for CheckpointStrategy {
    fn default() -> Self {
        CheckpointStrategy::Smart
    }
}

impl SessionTimeline {
    /// Create a new empty timeline
    pub fn new(session_id: String) -> Self {
        Self {
            session_id,
            root_node: None,
            current_checkpoint_id: None,
            auto_checkpoint_enabled: false,
            checkpoint_strategy: CheckpointStrategy::default(),
            total_checkpoints: 0,
        }
    }

    /// Find a checkpoint by ID in the timeline tree
    pub fn find_checkpoint(&self, checkpoint_id: &str) -> Option<&TimelineNode> {
        self.root_node
            .as_ref()
            .and_then(|root| Self::find_in_tree(root, checkpoint_id))
    }

    fn find_in_tree<'a>(node: &'a TimelineNode, checkpoint_id: &str) -> Option<&'a TimelineNode> {
        if node.checkpoint.id == checkpoint_id {
            return Some(node);
        }

        for child in &node.children {
            if let Some(found) = Self::find_in_tree(child, checkpoint_id) {
                return Some(found);
            }
        }

        None
    }
}

/// Checkpoint storage paths
pub struct CheckpointPaths {
    pub timeline_file: PathBuf,
    pub checkpoints_dir: PathBuf,
    pub files_dir: PathBuf,
}

impl CheckpointPaths {
    pub fn new(claude_dir: &PathBuf, project_id: &str, session_id: &str) -> Self {
        let base_dir = claude_dir
            .join("projects")
            .join(project_id)
            .join(".timelines")
            .join(session_id);

        Self {
            timeline_file: base_dir.join("timeline.json"),
            checkpoints_dir: base_dir.join("checkpoints"),
            files_dir: base_dir.join("files"),
        }
    }

    pub fn checkpoint_dir(&self, checkpoint_id: &str) -> PathBuf {
        self.checkpoints_dir.join(checkpoint_id)
    }

    pub fn checkpoint_metadata_file(&self, checkpoint_id: &str) -> PathBuf {
        self.checkpoint_dir(checkpoint_id).join("metadata.json")
    }

    pub fn checkpoint_messages_file(&self, checkpoint_id: &str) -> PathBuf {
        self.checkpoint_dir(checkpoint_id).join("messages.jsonl")
    }

    #[allow(dead_code)]
    pub fn file_snapshot_path(&self, _checkpoint_id: &str, file_hash: &str) -> PathBuf {
        // In content-addressable storage, files are stored by hash in the content pool
        self.files_dir.join("content_pool").join(file_hash)
    }

    #[allow(dead_code)]
    pub fn file_reference_path(&self, checkpoint_id: &str, safe_filename: &str) -> PathBuf {
        // References are stored per checkpoint
        self.files_dir
            .join("refs")
            .join(checkpoint_id)
            .join(format!("{}.json", safe_filename))
    }
}
