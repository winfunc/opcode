//! Agent management system
//! 
//! This module provides a modular system for managing Claude AI agents,
//! their execution, and related functionality.

pub mod types;
pub mod database;
pub mod execution;
pub mod binary;
pub mod metrics;
pub mod commands;

// Re-export commonly used types
