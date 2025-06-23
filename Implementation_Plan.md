# Implementation Plan

Project Goal: Enhance the Claudia project with multi-agent support by integrating Aider and OpenCodex capabilities, transforming it into a universal AI coding assistant.

## Memory Bank System Structure

This project utilizes a multi-file Memory Bank system located in the `/Memory` directory. This structure was chosen due to the project's complexity, multiple phases, and distinct task domains. Each phase has its own subdirectory containing task-specific log files.

## Phase 1: Agent Engine Infrastructure - Agent Group Alpha

### Task 1.1 - Agent_Backend: Agent Struct and Database Enhancement
Objective: Modify the core agent infrastructure to support multiple engine types.

1. Add Engine Field to Agent Struct
   - Locate and modify `src-tauri/src/commands/agents.rs`
   - Add `pub engine: String` to the Agent struct
   - Update relevant type definitions and documentation
   - Guidance: Ensure the field is non-nullable with a default value of "claude"

2. Database Schema Migration
   - Create migration logic in `src-tauri/src/main.rs`
   - Update table creation SQL in `src-tauri/src/commands/agents.rs`
   - Execute one-time check for engine column existence
   - Implement ALTER TABLE statement: `ALTER TABLE agents ADD COLUMN engine TEXT NOT NULL DEFAULT 'claude'`
   - Guidance: Use transaction to ensure atomic migration

3. Model Discovery Command Implementation
   - Create new Tauri command `get_available_models(engine: String)` in `src-tauri/src/commands/agents.rs`
   - Register command in `src-tauri/src/main.rs` invoke handler
   - Return hardcoded values for "claude" engine initially
   - Prepare structure for Aider and OpenCodex integration
   - Guidance: Implement proper error handling using custom error types

### Task 1.2 - Agent_Backend: Execution Logic Refactor
Objective: Modify the agent execution system to support different engine types.

1. Execution Dispatcher Creation
   - Modify `execute_agent` command in `src-tauri/src/commands/agents.rs`
   - Add engine type inspection logic
   - Implement dispatch mechanism to engine-specific functions
   - Add comprehensive error handling for unsupported engines
   - Guidance: Ensure proper error propagation to frontend

2. Engine-Specific Function Implementation
   - Create `execute_claude_agent` function with existing logic
   - Create `execute_aider_agent` function placeholder
   - Create `execute_opencodex_agent` function placeholder
   - Add necessary type definitions and interfaces
   - Guidance: Maintain consistent error handling patterns across all engine functions

## Phase 2: OpenAI-Compatible Integration - Agent Group Beta

### Task 2.1 - Agent_Integration: OpenRouter Setup
Objective: Implement OpenRouter API integration for model flexibility.

1. Environment Variable Handling
   - Add OPENROUTER_API_KEY validation in `src-tauri/src/commands/agents.rs`
   - Implement binary detection for aider-chat and opencodex
   - Add error handling for missing dependencies
   - Guidance: Use std::env::var for environment variable access

2. OpenRouter API Client
   - Use reqwest crate to call OpenRouter API
   - Create models endpoint integration (https://openrouter.ai/api/v1/models)
   - Parse and validate API responses
   - Add error handling and retry logic
   - Guidance: Consider creating a dedicated module for API client functionality

### Task 2.2 - Agent_Integration: Command Builder Implementation
Objective: Create robust command builders for Aider and OpenCodex integration.

1. Aider Command Builder
   - Create `build_aider_command` function in `src-tauri/src/commands/agents.rs`
   - Add model selection parameter handling
   - Implement OpenRouter API key injection
   - Configure API base URL
   - Guidance: Sanitize all command-line arguments

2. OpenCodex Command Builder
   - Create `build_opencodex_command` function
   - Handle command line arguments
   - Set up environment variables
   - Configure tool-specific settings
   - Guidance: Follow similar pattern to Aider builder for consistency

## Phase 3: Frontend Enhancement - Agent Group Gamma

### Task 3.1 - Agent_Frontend: UI Component Updates
Objective: Enhance the frontend to support multiple agent engines.

1. Engine Selector Implementation
   - Add engine selection dropdown to `src/components/CreateAgent.tsx`
   - Integrate with `src/components/ui/select.tsx`
   - Implement model fetching via `src/lib/api.ts`
   - Update form validation logic
   - Guidance: Use existing UI component patterns

2. Model Information Display
   - Update model dropdown to show provider information
   - Add tooltips using `src/components/ui/tooltip.tsx`
   - Implement loading states for API calls
   - Add error handling for unavailable models
   - Guidance: Follow existing UI/UX patterns for consistency

### Task 3.2 - Agent_Frontend: Engine-Specific Settings
Objective: Add customization options for different agent engines.

1. Aider Settings Integration
   - Add auto-commit toggle using `src/components/ui/switch.tsx`
   - Implement git repository context field
   - Create settings validation logic
   - Update agent creation flow
   - Guidance: Show settings only when Aider engine is selected

2. OpenCodex Settings Integration
   - Add multi-repository context support
   - Implement endpoint configuration options
   - Create validation for OpenCodex settings
   - Update agent creation handling
   - Guidance: Show settings only when OpenCodex engine is selected

## Note on Handover Protocol

For long-running projects or situations requiring context transfer (e.g., exceeding LLM context limits, changing specialized agents), the APM Handover Protocol should be initiated. This ensures smooth transitions and preserves project knowledge. Detailed procedures are outlined in the framework guide:

`prompts/01_Manager_Agent_Core_Guides/05_Handover_Protocol_Guide.md`

The current Manager Agent or the User should initiate this protocol as needed.