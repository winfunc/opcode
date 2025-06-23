# APM Task Assignment: Command Builder Implementation

## 1. Agent Role & APM Context

You are activated as an Implementation Agent (Agent_Integration) within the Agentic Project Management (APM) framework for the Claudia project enhancement. Your role is to execute assigned tasks and log your work meticulously in the Memory Bank.

## 2. Context from Prior Work

Task 2.1 (OpenRouter Setup) has been successfully completed, providing:
- Validated API connectivity
- Model discovery capabilities
- Dependency validation
- Error handling framework
- Security mechanisms

This infrastructure serves as the foundation for implementing the command builders.

## 3. Task Assignment

**Reference:** This assignment corresponds to Task 2.2 - Agent_Integration: Command Builder Implementation in Phase 2 of the Implementation Plan.

**Objective:** Create robust command builders for Aider and OpenCodex integration.

**Detailed Action Steps:**

1. Aider Command Builder Implementation
   - Create `build_aider_command` function in `src-tauri/src/commands/agents.rs`
   - Implement model selection parameter handling
   - Add OpenRouter API key injection
   - Configure API base URL
   - Critical: Ensure proper sanitization of all command-line arguments
   
2. OpenCodex Command Builder Implementation
   - Create `build_opencodex_command` function
   - Handle command line arguments
   - Set up environment variables
   - Configure tool-specific settings
   - Critical: Follow similar pattern to Aider builder for consistency

## 4. Expected Output & Deliverables

Successful completion requires:
1. Aider command builder:
   - Function to build command with proper arguments
   - Model selection integration
   - API key handling
   - Proper command sanitization
   
2. OpenCodex command builder:
   - Command generation function
   - Environment variable configuration
   - Tool settings implementation
   - Consistent error handling

3. Both implementations must:
   - Handle all parameters safely
   - Integrate with OpenRouter infrastructure
   - Provide clear error messages
   - Support model selection

## 5. Memory Bank Logging Instructions

Upon completion of this task, you must log your work in the Memory Bank file located at:
`Memory/Phase_2_OpenAI_Compatible_Integration/Task_2.2_Command_Builder_Implementation_Log.md`

Your log entry must strictly follow the format defined in `prompts/02_Utility_Prompts_And_Format_Definitions/Memory_Bank_Log_Format.md` and include:
- Clear reference to Task 2.2
- Details of command builder implementations
- Command-line argument handling approach
- Any challenges encountered and their resolutions
- Confirmation of successful testing with both Aider and OpenCodex

## 6. Dependencies and Prerequisites

Ensure that:
1. Task 2.1 (OpenRouter Setup) is fully completed and verified
2. OpenRouter infrastructure is properly configured
3. You have access to:
   - Aider and OpenCodex documentation
   - Command-line argument specifications
   - Test environments for both tools

## 7. Technical Requirements

1. Command Building:
   - Sanitize all user inputs
   - Handle spaces and special characters in paths
   - Support all required tool flags and options
   
2. Integration:
   - Use OpenRouter infrastructure from Task 2.1
   - Maintain consistent error handling patterns
   - Support model selection functionality
   
3. Security:
   - Safe handling of command-line arguments
   - Proper escaping of special characters
   - Secure environment variable management

## 8. Clarification Instructions

If any part of this task is unclear, particularly regarding:
- Command-line argument specifications
- Tool-specific requirements
- Integration with OpenRouter infrastructure

Please ask for clarification before proceeding with implementation.