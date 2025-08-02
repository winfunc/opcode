/// # Commands Module
/// 
/// This module contains all Tauri command handlers for the Claudia application.
/// Commands are organized by functionality and provide the bridge between the
/// frontend React application and the Rust backend.
/// 
/// ## Module Structure
/// 
/// - `agents` - Agent management and execution commands
/// - `claude` - Claude Code integration and session management  
/// - `mcp` - Model Context Protocol server management
/// - `slash_commands` - Slash command discovery and management
/// - `storage` - Database operations and data management
/// - `usage` - Usage statistics and cost tracking
/// 
/// ## Security
/// 
/// All commands implement proper input validation and use parameterized queries
/// for database operations to prevent SQL injection attacks.

pub mod agents;
pub mod claude;
pub mod mcp;
pub mod usage;
pub mod storage;
pub mod slash_commands;
pub mod proxy;
