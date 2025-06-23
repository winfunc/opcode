# Task Assignment: Agent Struct and Database Enhancement

## Agent Role & Context

You are the Agent_Backend, responsible for core infrastructure modifications in the Claudia project. You will be enhancing the agent infrastructure to support multiple engine types (Claude, Aider, OpenCodex) by modifying the agent struct and database schema.

## Project Context

The Claudia project is being enhanced to support multiple AI agent types beyond Claude. This task is part of Phase 1: Agent Engine Infrastructure, which lays the foundation for multi-agent support.

## Current Task Details

### Task Reference
Task 1.1 - Agent Struct and Database Enhancement from the Implementation Plan

### Specific Objectives

1. Add Engine Field to Agent Struct:
   - File: `src-tauri/src/commands/agents.rs`
   - Add `pub engine: String` to the Agent struct
   - Update type definitions and documentation
   - Ensure field is non-nullable with "claude" as default value

2. Database Schema Migration:
   - Files: `src-tauri/src/main.rs`, `src-tauri/src/commands/agents.rs`
   - Create migration logic for engine column addition
   - Use transaction to ensure atomic migration
   - Implement ALTER TABLE statement: `ALTER TABLE agents ADD COLUMN engine TEXT NOT NULL DEFAULT 'claude'`

3. Model Discovery Command Implementation:
   - File: `src-tauri/src/commands/agents.rs`
   - Create `get_available_models(engine: String)` command
   - Register in `src-tauri/src/main.rs` invoke handler
   - Initially return hardcoded values for "claude"
   - Prepare structure for future engine integrations

### Technical Requirements

1. Error Handling:
   - Implement custom error types for detailed error reporting
   - Avoid using `map_err(|e| e.to_string())`
   - Ensure proper error propagation to frontend

2. Database Operations:
   - Use transactions for schema migrations
   - Include rollback logic for failed migrations
   - Validate existing data during migration

3. API Design:
   - Follow Tauri command patterns
   - Ensure type safety in frontend-backend communication
   - Document API changes in code

## Expected Output

1. Modified agent struct with new engine field
2. Successful database migration adding engine column
3. Working `get_available_models` command
4. Updated type definitions and documentation
5. Comprehensive error handling implementation

## Memory Bank Logging

You must log your progress in:
`Memory/Phase_1_Agent_Engine_Infrastructure/Task_1.1_Agent_Struct_Enhancement_Log.md`

Follow the format specified in `prompts/02_Utility_Prompts_And_Format_Definitions/Memory_Bank_Log_Format.md`

## Communication Protocol

1. Inform the User before making any file modifications
2. Request clarification if any technical requirements are unclear
3. Log significant decisions or implementation details in the Memory Bank
4. Report task completion with a summary of changes made

## Dependencies and Prerequisites

1. Existing Rust/Tauri backend structure
2. Access to SQLite database schema
3. Understanding of current agent execution flow

Proceed with implementation after confirming your understanding of these requirements.