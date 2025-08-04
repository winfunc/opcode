import type { 
  EventName,
  FeatureUsageProperties,
  ErrorProperties,
  SessionProperties,
  ModelProperties,
  AgentProperties,
  MCPProperties,
  SlashCommandProperties,
  PerformanceMetrics,
  PromptSubmittedProperties,
  SessionStoppedProperties,
  EnhancedSessionStoppedProperties,
  CheckpointCreatedProperties,
  CheckpointRestoredProperties,
  ToolExecutedProperties,
  AgentStartedProperties,
  AgentProgressProperties,
  AgentErrorProperties,
  MCPServerAddedProperties,
  MCPServerRemovedProperties,
  MCPToolInvokedProperties,
  MCPConnectionErrorProperties,
  SlashCommandSelectedProperties,
  SlashCommandExecutedProperties,
  SlashCommandCreatedProperties,
  APIErrorProperties,
  UIErrorProperties,
  PerformanceBottleneckProperties,
  MemoryWarningProperties,
  UserJourneyProperties,
  EnhancedPromptSubmittedProperties,
  EnhancedToolExecutedProperties,
  EnhancedErrorProperties,
  SessionEngagementProperties,
  FeatureDiscoveryProperties,
  OutputQualityProperties,
  ResourceUsageProperties,
  FeatureAdoptionProperties,
  FeatureCombinationProperties,
  AIInteractionProperties,
  PromptPatternProperties,
  WorkflowProperties,
  NetworkPerformanceProperties,
  SuggestionProperties
} from './types';

export const ANALYTICS_EVENTS = {
  // Session events
  SESSION_CREATED: 'session_created' as EventName,
  SESSION_COMPLETED: 'session_completed' as EventName,
  SESSION_RESUMED: 'session_resumed' as EventName,
  PROMPT_SUBMITTED: 'prompt_submitted' as EventName,
  SESSION_STOPPED: 'session_stopped' as EventName,
  CHECKPOINT_CREATED: 'checkpoint_created' as EventName,
  CHECKPOINT_RESTORED: 'checkpoint_restored' as EventName,
  TOOL_EXECUTED: 'tool_executed' as EventName,
  
  // Feature usage events
  FEATURE_USED: 'feature_used' as EventName,
  MODEL_SELECTED: 'model_selected' as EventName,
  TAB_CREATED: 'tab_created' as EventName,
  TAB_CLOSED: 'tab_closed' as EventName,
  FILE_OPENED: 'file_opened' as EventName,
  FILE_EDITED: 'file_edited' as EventName,
  FILE_SAVED: 'file_saved' as EventName,
  
  // Agent events
  AGENT_EXECUTED: 'agent_executed' as EventName,
  AGENT_STARTED: 'agent_started' as EventName,
  AGENT_PROGRESS: 'agent_progress' as EventName,
  AGENT_ERROR: 'agent_error' as EventName,
  
  // MCP events
  MCP_SERVER_CONNECTED: 'mcp_server_connected' as EventName,
  MCP_SERVER_DISCONNECTED: 'mcp_server_disconnected' as EventName,
  MCP_SERVER_ADDED: 'mcp_server_added' as EventName,
  MCP_SERVER_REMOVED: 'mcp_server_removed' as EventName,
  MCP_TOOL_INVOKED: 'mcp_tool_invoked' as EventName,
  MCP_CONNECTION_ERROR: 'mcp_connection_error' as EventName,
  
  // Slash command events
  SLASH_COMMAND_USED: 'slash_command_used' as EventName,
  SLASH_COMMAND_SELECTED: 'slash_command_selected' as EventName,
  SLASH_COMMAND_EXECUTED: 'slash_command_executed' as EventName,
  SLASH_COMMAND_CREATED: 'slash_command_created' as EventName,
  
  // Settings and system events
  SETTINGS_CHANGED: 'settings_changed' as EventName,
  APP_STARTED: 'app_started' as EventName,
  APP_CLOSED: 'app_closed' as EventName,
  
  // Error and performance events
  ERROR_OCCURRED: 'error_occurred' as EventName,
  API_ERROR: 'api_error' as EventName,
  UI_ERROR: 'ui_error' as EventName,
  PERFORMANCE_BOTTLENECK: 'performance_bottleneck' as EventName,
  MEMORY_WARNING: 'memory_warning' as EventName,
  
  // User journey events
  JOURNEY_MILESTONE: 'journey_milestone' as EventName,
  USER_RETENTION: 'user_retention' as EventName,
  
  // AI interaction events
  AI_INTERACTION: 'ai_interaction' as EventName,
  PROMPT_PATTERN: 'prompt_pattern' as EventName,
  
  // Quality events
  OUTPUT_REGENERATED: 'output_regenerated' as EventName,
  CONVERSATION_ABANDONED: 'conversation_abandoned' as EventName,
  SUGGESTION_ACCEPTED: 'suggestion_accepted' as EventName,
  SUGGESTION_REJECTED: 'suggestion_rejected' as EventName,
  
  // Workflow events
  WORKFLOW_STARTED: 'workflow_started' as EventName,
  WORKFLOW_COMPLETED: 'workflow_completed' as EventName,
  WORKFLOW_ABANDONED: 'workflow_abandoned' as EventName,
  
  // Feature adoption events
  FEATURE_DISCOVERED: 'feature_discovered' as EventName,
  FEATURE_ADOPTED: 'feature_adopted' as EventName,
  FEATURE_COMBINATION: 'feature_combination' as EventName,
  
  // Resource usage events
  RESOURCE_USAGE_HIGH: 'resource_usage_high' as EventName,
  RESOURCE_USAGE_SAMPLED: 'resource_usage_sampled' as EventName,
  
  // Network performance events
  NETWORK_PERFORMANCE: 'network_performance' as EventName,
  NETWORK_FAILURE: 'network_failure' as EventName,
  
  // Engagement events
  SESSION_ENGAGEMENT: 'session_engagement' as EventName,
} as const;

// Event property builders - help ensure consistent event structure
export const eventBuilders = {
  session: (props: SessionProperties) => ({
    event: ANALYTICS_EVENTS.SESSION_CREATED,
    properties: {
      category: 'session',
      ...props,
    },
  }),
  
  feature: (feature: string, subfeature?: string, metadata?: Record<string, any>) => ({
    event: ANALYTICS_EVENTS.FEATURE_USED,
    properties: {
      category: 'feature',
      feature,
      subfeature,
      ...metadata,
    } as FeatureUsageProperties,
  }),
  
  error: (errorType: string, errorCode?: string, context?: string) => ({
    event: ANALYTICS_EVENTS.ERROR_OCCURRED,
    properties: {
      category: 'error',
      error_type: errorType,
      error_code: errorCode,
      context,
    } as ErrorProperties,
  }),
  
  model: (newModel: string, previousModel?: string, source?: string) => ({
    event: ANALYTICS_EVENTS.MODEL_SELECTED,
    properties: {
      category: 'model',
      new_model: newModel,
      previous_model: previousModel,
      source,
    } as ModelProperties,
  }),
  
  agent: (agentType: string, success: boolean, agentName?: string, durationMs?: number) => ({
    event: ANALYTICS_EVENTS.AGENT_EXECUTED,
    properties: {
      category: 'agent',
      agent_type: agentType,
      agent_name: agentName,
      success,
      duration_ms: durationMs,
    } as AgentProperties,
  }),
  
  mcp: (serverName: string, success: boolean, serverType?: string) => ({
    event: ANALYTICS_EVENTS.MCP_SERVER_CONNECTED,
    properties: {
      category: 'mcp',
      server_name: serverName,
      server_type: serverType,
      success,
    } as MCPProperties,
  }),
  
  slashCommand: (command: string, success: boolean) => ({
    event: ANALYTICS_EVENTS.SLASH_COMMAND_USED,
    properties: {
      category: 'slash_command',
      command,
      success,
    } as SlashCommandProperties,
  }),
  
  performance: (metrics: PerformanceMetrics) => ({
    event: ANALYTICS_EVENTS.FEATURE_USED,
    properties: {
      category: 'performance',
      feature: 'system_metrics',
      ...metrics,
    },
  }),
  
  // Claude Code Session event builders
  promptSubmitted: (props: PromptSubmittedProperties) => ({
    event: ANALYTICS_EVENTS.PROMPT_SUBMITTED,
    properties: {
      category: 'session',
      ...props,
    },
  }),
  
  sessionStopped: (props: SessionStoppedProperties) => ({
    event: ANALYTICS_EVENTS.SESSION_STOPPED,
    properties: {
      category: 'session',
      ...props,
    },
  }),
  
  // Enhanced session stopped with detailed metrics
  enhancedSessionStopped: (props: EnhancedSessionStoppedProperties) => ({
    event: ANALYTICS_EVENTS.SESSION_STOPPED,
    properties: {
      category: 'session',
      duration_ms: props.duration_ms,
      messages_count: props.messages_count,
      reason: props.reason,
      // Timing metrics
      time_to_first_message_ms: props.time_to_first_message_ms,
      average_response_time_ms: props.average_response_time_ms,
      idle_time_ms: props.idle_time_ms,
      // Interaction metrics
      prompts_sent: props.prompts_sent,
      tools_executed: props.tools_executed,
      tools_failed: props.tools_failed,
      files_created: props.files_created,
      files_modified: props.files_modified,
      files_deleted: props.files_deleted,
      // Content metrics
      total_tokens_used: props.total_tokens_used,
      code_blocks_generated: props.code_blocks_generated,
      errors_encountered: props.errors_encountered,
      // Session context
      model: props.model,
      has_checkpoints: props.has_checkpoints,
      checkpoint_count: props.checkpoint_count,
      was_resumed: props.was_resumed,
      // Agent context
      agent_type: props.agent_type,
      agent_name: props.agent_name ? sanitizers.sanitizeAgentName(props.agent_name) : undefined,
      agent_success: props.agent_success,
      // Stop context
      stop_source: props.stop_source,
      final_state: props.final_state,
      has_pending_prompts: props.has_pending_prompts,
      pending_prompts_count: props.pending_prompts_count,
    },
  }),
  
  checkpointCreated: (props: CheckpointCreatedProperties) => ({
    event: ANALYTICS_EVENTS.CHECKPOINT_CREATED,
    properties: {
      category: 'session',
      ...props,
    },
  }),
  
  checkpointRestored: (props: CheckpointRestoredProperties) => ({
    event: ANALYTICS_EVENTS.CHECKPOINT_RESTORED,
    properties: {
      category: 'session',
      ...props,
    },
  }),
  
  toolExecuted: (props: ToolExecutedProperties) => ({
    event: ANALYTICS_EVENTS.TOOL_EXECUTED,
    properties: {
      category: 'session',
      tool_name: sanitizers.sanitizeToolName(props.tool_name),
      execution_time_ms: props.execution_time_ms,
      success: props.success,
      error_message: props.error_message ? sanitizers.sanitizeErrorMessage(props.error_message) : undefined,
    },
  }),
  
  // Enhanced Agent event builders
  agentStarted: (props: AgentStartedProperties) => ({
    event: ANALYTICS_EVENTS.AGENT_STARTED,
    properties: {
      category: 'agent',
      agent_type: props.agent_type,
      agent_name: props.agent_name ? sanitizers.sanitizeAgentName(props.agent_name) : undefined,
      has_custom_prompt: props.has_custom_prompt,
    },
  }),
  
  agentProgress: (props: AgentProgressProperties) => ({
    event: ANALYTICS_EVENTS.AGENT_PROGRESS,
    properties: {
      category: 'agent',
      ...props,
    },
  }),
  
  agentError: (props: AgentErrorProperties) => ({
    event: ANALYTICS_EVENTS.AGENT_ERROR,
    properties: {
      category: 'agent',
      ...props,
    },
  }),
  
  // MCP event builders
  mcpServerAdded: (props: MCPServerAddedProperties) => ({
    event: ANALYTICS_EVENTS.MCP_SERVER_ADDED,
    properties: {
      category: 'mcp',
      ...props,
    },
  }),
  
  mcpServerRemoved: (props: MCPServerRemovedProperties) => ({
    event: ANALYTICS_EVENTS.MCP_SERVER_REMOVED,
    properties: {
      category: 'mcp',
      server_name: sanitizers.sanitizeServerName(props.server_name),
      was_connected: props.was_connected,
    },
  }),
  
  mcpToolInvoked: (props: MCPToolInvokedProperties) => ({
    event: ANALYTICS_EVENTS.MCP_TOOL_INVOKED,
    properties: {
      category: 'mcp',
      server_name: sanitizers.sanitizeServerName(props.server_name),
      tool_name: sanitizers.sanitizeToolName(props.tool_name),
      invocation_source: props.invocation_source,
    },
  }),
  
  mcpConnectionError: (props: MCPConnectionErrorProperties) => ({
    event: ANALYTICS_EVENTS.MCP_CONNECTION_ERROR,
    properties: {
      category: 'mcp',
      server_name: sanitizers.sanitizeServerName(props.server_name),
      error_type: props.error_type,
      retry_attempt: props.retry_attempt,
    },
  }),
  
  // Slash Command event builders
  slashCommandSelected: (props: SlashCommandSelectedProperties) => ({
    event: ANALYTICS_EVENTS.SLASH_COMMAND_SELECTED,
    properties: {
      category: 'slash_command',
      command_name: sanitizers.sanitizeCommandName(props.command_name),
      selection_method: props.selection_method,
    },
  }),
  
  slashCommandExecuted: (props: SlashCommandExecutedProperties) => ({
    event: ANALYTICS_EVENTS.SLASH_COMMAND_EXECUTED,
    properties: {
      category: 'slash_command',
      command_name: sanitizers.sanitizeCommandName(props.command_name),
      parameters_count: props.parameters_count,
      execution_time_ms: props.execution_time_ms,
    },
  }),
  
  slashCommandCreated: (props: SlashCommandCreatedProperties) => ({
    event: ANALYTICS_EVENTS.SLASH_COMMAND_CREATED,
    properties: {
      category: 'slash_command',
      ...props,
    },
  }),
  
  // Error and Performance event builders
  apiError: (props: APIErrorProperties) => ({
    event: ANALYTICS_EVENTS.API_ERROR,
    properties: {
      category: 'error',
      endpoint: sanitizers.sanitizeEndpoint(props.endpoint),
      error_code: props.error_code,
      retry_count: props.retry_count,
      response_time_ms: props.response_time_ms,
    },
  }),
  
  uiError: (props: UIErrorProperties) => ({
    event: ANALYTICS_EVENTS.UI_ERROR,
    properties: {
      category: 'error',
      ...props,
    },
  }),
  
  performanceBottleneck: (props: PerformanceBottleneckProperties) => ({
    event: ANALYTICS_EVENTS.PERFORMANCE_BOTTLENECK,
    properties: {
      category: 'performance',
      ...props,
    },
  }),
  
  memoryWarning: (props: MemoryWarningProperties) => ({
    event: ANALYTICS_EVENTS.MEMORY_WARNING,
    properties: {
      category: 'performance',
      ...props,
    },
  }),
  
  // User journey event builders
  journeyMilestone: (props: UserJourneyProperties) => ({
    event: ANALYTICS_EVENTS.JOURNEY_MILESTONE,
    properties: {
      category: 'user_journey',
      ...props,
    },
  }),
  
  // Enhanced prompt submission with more context
  enhancedPromptSubmitted: (props: EnhancedPromptSubmittedProperties) => ({
    event: ANALYTICS_EVENTS.PROMPT_SUBMITTED,
    properties: {
      category: 'session',
      prompt_length: props.prompt_length,
      model: props.model,
      has_attachments: props.has_attachments,
      source: props.source,
      word_count: props.word_count,
      conversation_depth: props.conversation_depth,
      prompt_complexity: props.prompt_complexity,
      contains_code: props.contains_code,
      language_detected: props.language_detected,
      session_age_ms: props.session_age_ms,
    },
  }),
  
  // Enhanced tool execution with more context
  enhancedToolExecuted: (props: EnhancedToolExecutedProperties) => ({
    event: ANALYTICS_EVENTS.TOOL_EXECUTED,
    properties: {
      category: 'session',
      tool_name: sanitizers.sanitizeToolName(props.tool_name),
      execution_time_ms: props.execution_time_ms,
      success: props.success,
      error_message: props.error_message ? sanitizers.sanitizeErrorMessage(props.error_message) : undefined,
      tool_category: props.tool_category,
      consecutive_failures: props.consecutive_failures,
      retry_attempted: props.retry_attempted,
      input_size_bytes: props.input_size_bytes,
      output_size_bytes: props.output_size_bytes,
    },
  }),
  
  // Enhanced error tracking
  enhancedError: (props: EnhancedErrorProperties) => ({
    event: ANALYTICS_EVENTS.ERROR_OCCURRED,
    properties: {
      category: 'error',
      error_type: props.error_type,
      error_code: props.error_code,
      error_message: props.error_message ? sanitizers.sanitizeErrorMessage(props.error_message) : undefined,
      context: props.context,
      user_action_before_error: props.user_action_before_error,
      recovery_attempted: props.recovery_attempted,
      recovery_successful: props.recovery_successful,
      error_frequency: props.error_frequency,
      stack_trace_hash: props.stack_trace_hash,
    },
  }),
  
  // Session engagement
  sessionEngagement: (props: SessionEngagementProperties) => ({
    event: ANALYTICS_EVENTS.SESSION_ENGAGEMENT,
    properties: {
      category: 'engagement',
      ...props,
    },
  }),
  
  // Feature discovery
  featureDiscovered: (props: FeatureDiscoveryProperties) => ({
    event: ANALYTICS_EVENTS.FEATURE_DISCOVERED,
    properties: {
      category: 'feature_adoption',
      ...props,
    },
  }),
  
  // Output quality
  outputRegenerated: (props: OutputQualityProperties) => ({
    event: ANALYTICS_EVENTS.OUTPUT_REGENERATED,
    properties: {
      category: 'quality',
      ...props,
    },
  }),
  
  // Conversation abandoned
  conversationAbandoned: (reason: string, messagesCount: number) => ({
    event: ANALYTICS_EVENTS.CONVERSATION_ABANDONED,
    properties: {
      category: 'quality',
      reason,
      messages_count: messagesCount,
    },
  }),
  
  // Suggestion tracking
  suggestionAccepted: (props: SuggestionProperties) => ({
    event: ANALYTICS_EVENTS.SUGGESTION_ACCEPTED,
    properties: {
      category: 'quality',
      ...props,
    },
  }),
  
  suggestionRejected: (props: SuggestionProperties) => ({
    event: ANALYTICS_EVENTS.SUGGESTION_REJECTED,
    properties: {
      category: 'quality',
      ...props,
    },
  }),
  
  // Resource usage
  resourceUsageHigh: (props: ResourceUsageProperties) => ({
    event: ANALYTICS_EVENTS.RESOURCE_USAGE_HIGH,
    properties: {
      category: 'performance',
      ...props,
    },
  }),
  
  resourceUsageSampled: (props: ResourceUsageProperties) => ({
    event: ANALYTICS_EVENTS.RESOURCE_USAGE_SAMPLED,
    properties: {
      category: 'performance',
      ...props,
    },
  }),
  
  // Feature adoption
  featureAdopted: (props: FeatureAdoptionProperties) => ({
    event: ANALYTICS_EVENTS.FEATURE_ADOPTED,
    properties: {
      category: 'feature_adoption',
      ...props,
    },
  }),
  
  featureCombination: (props: FeatureCombinationProperties) => ({
    event: ANALYTICS_EVENTS.FEATURE_COMBINATION,
    properties: {
      category: 'feature_adoption',
      ...props,
    },
  }),
  
  // AI interactions
  aiInteraction: (props: AIInteractionProperties) => ({
    event: ANALYTICS_EVENTS.AI_INTERACTION,
    properties: {
      category: 'ai',
      ...props,
    },
  }),
  
  promptPattern: (props: PromptPatternProperties) => ({
    event: ANALYTICS_EVENTS.PROMPT_PATTERN,
    properties: {
      category: 'ai',
      ...props,
    },
  }),
  
  // Workflow tracking
  workflowStarted: (props: WorkflowProperties) => ({
    event: ANALYTICS_EVENTS.WORKFLOW_STARTED,
    properties: {
      category: 'workflow',
      ...props,
    },
  }),
  
  workflowCompleted: (props: WorkflowProperties) => ({
    event: ANALYTICS_EVENTS.WORKFLOW_COMPLETED,
    properties: {
      category: 'workflow',
      ...props,
    },
  }),
  
  workflowAbandoned: (props: WorkflowProperties) => ({
    event: ANALYTICS_EVENTS.WORKFLOW_ABANDONED,
    properties: {
      category: 'workflow',
      ...props,
    },
  }),
  
  // Network performance
  networkPerformance: (props: NetworkPerformanceProperties) => ({
    event: ANALYTICS_EVENTS.NETWORK_PERFORMANCE,
    properties: {
      category: 'network',
      endpoint_type: props.endpoint_type,
      latency_ms: props.latency_ms,
      payload_size_bytes: props.payload_size_bytes,
      connection_quality: props.connection_quality,
      retry_count: props.retry_count,
      circuit_breaker_triggered: props.circuit_breaker_triggered,
    },
  }),
  
  networkFailure: (props: NetworkPerformanceProperties) => ({
    event: ANALYTICS_EVENTS.NETWORK_FAILURE,
    properties: {
      category: 'network',
      endpoint_type: props.endpoint_type,
      latency_ms: props.latency_ms,
      payload_size_bytes: props.payload_size_bytes,
      connection_quality: props.connection_quality,
      retry_count: props.retry_count,
      circuit_breaker_triggered: props.circuit_breaker_triggered,
    },
  }),
};

// Sanitization helpers to remove PII
export const sanitizers = {
  // Remove file paths, keeping only extension
  sanitizeFilePath: (path: string): string => {
    const ext = path.split('.').pop();
    return ext ? `*.${ext}` : 'unknown';
  },
  
  // Remove project names and paths
  sanitizeProjectPath: (_path: string): string => {
    return 'project';
  },
  
  // Sanitize error messages that might contain sensitive info
  sanitizeErrorMessage: (message: string): string => {
    // Remove file paths
    message = message.replace(/\/[\w\-\/\.]+/g, '/***');
    // Remove potential API keys or tokens
    message = message.replace(/[a-zA-Z0-9]{20,}/g, '***');
    // Remove email addresses
    message = message.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '***@***.***');
    return message;
  },
  
  // Sanitize agent names that might contain user info
  sanitizeAgentName: (name: string): string => {
    // Only keep the type, remove custom names
    return name.split('-')[0] || 'custom';
  },
  
  // Sanitize tool names to remove any user-specific info
  sanitizeToolName: (name: string): string => {
    // Remove any path-like structures
    return name.replace(/\/[\w\-\/\.]+/g, '').toLowerCase();
  },
  
  // Sanitize server names to remove any user-specific info
  sanitizeServerName: (name: string): string => {
    // Keep only the type or first part
    return name.split(/[\-_]/)[0] || 'custom';
  },
  
  // Sanitize command names
  sanitizeCommandName: (name: string): string => {
    // Remove any custom prefixes or user-specific parts
    return name.replace(/^custom-/, '').split('-')[0] || 'custom';
  },
  
  // Sanitize API endpoints
  sanitizeEndpoint: (endpoint: string): string => {
    // Remove any dynamic IDs or user-specific parts
    return endpoint.replace(/\/\d+/g, '/:id').replace(/\/[\w\-]{20,}/g, '/:id');
  },
};
