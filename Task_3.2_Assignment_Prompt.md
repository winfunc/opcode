# APM Task Assignment: Engine-Specific Settings

## 1. Agent Role & APM Context

You continue as an Implementation Agent (Agent_Frontend) within the APM framework for the Claudia project enhancement. Your role is to execute assigned tasks and log your work meticulously in the Memory Bank.

## 2. Context from Prior Work

Task 3.1 has established the core multi-engine UI infrastructure:
- Engine selection dropdown
- Dynamic model selection
- Provider information display
- Type-safe API integration

This foundation enables the implementation of engine-specific settings.

## 3. Task Assignment

**Reference:** This assignment corresponds to Task 3.2 - Agent_Frontend: Engine-Specific Settings in Phase 3 of the Implementation Plan.

**Objective:** Add customization options for different agent engines.

**Detailed Action Steps:**

1. Aider Settings Integration
   - Add auto-commit toggle using `src/components/ui/switch.tsx`
   - Implement git repository context field
   - Create settings validation logic
   - Update agent creation flow
   - Critical: Display settings only when Aider engine is selected
   
2. OpenCodex Settings Integration
   - Add multi-repository context support
   - Implement endpoint configuration options
   - Create validation for OpenCodex settings
   - Update agent creation handling
   - Critical: Display settings only when OpenCodex engine is selected

## 4. Expected Output & Deliverables

Successful completion requires:
1. Aider settings:
   - Working auto-commit toggle
   - Git repository path input
   - Input validation
   - Proper state management

2. OpenCodex settings:
   - Repository context management
   - Endpoint configuration UI
   - Validation logic
   - State handling

3. Both implementations must:
   - Show/hide based on selected engine
   - Validate inputs properly
   - Update agent creation payload
   - Handle errors appropriately

## 5. Memory Bank Logging Instructions

Upon completion of this task, you must log your work in the Memory Bank file located at:
`Memory/Phase_3_Frontend_Enhancement/Task_3.2_Engine_Specific_Settings_Log.md`

Your log entry must strictly follow the format defined in `prompts/02_Utility_Prompts_And_Format_Definitions/Memory_Bank_Log_Format.md` and include:
- Clear reference to Task 3.2
- Details of settings implementations
- Validation and error handling approach
- Any challenges encountered and their resolutions
- Confirmation of successful testing

## 6. Dependencies and Prerequisites

Ensure that:
1. Task 3.1 (UI Component Updates) is fully completed
2. Engine selection functionality is working
3. You have access to:
   - UI component library
   - Form validation utilities
   - Existing state management

## 7. Technical Requirements

1. Component Implementation:
   - Use existing UI components (switch, input)
   - Follow React best practices
   - Maintain type safety
   
2. State Management:
   - Handle settings visibility
   - Manage form validation
   - Update agent creation payload
   
3. User Experience:
   - Clear settings labeling
   - Proper validation feedback
   - Intuitive show/hide behavior

## 8. Validation Requirements

1. Aider Settings:
   - Git repository path must exist
   - Auto-commit toggle state preserved
   
2. OpenCodex Settings:
   - Valid repository paths
   - Proper endpoint URL format
   - Required fields completed

## 9. Error Handling

- Validate repository paths
- Check endpoint URLs
- Provide clear error messages
- Handle missing required fields

## 10. Clarification Instructions

If any part of this task is unclear, particularly regarding:
- Settings specifications
- Validation requirements
- State management expectations

Please ask for clarification before proceeding with implementation.