export interface AnalyticsEvent {
  event: string;
  properties?: {
    category?: string;
    action?: string;
    label?: string;
    value?: number;
    [key: string]: any;
  };
  timestamp: number;
  sessionId: string;
  userId: string; // anonymous UUID
}

export interface AnalyticsSettings {
  enabled: boolean;
  hasConsented: boolean;
  consentDate?: string;
  userId?: string;
  sessionId?: string;
}

export interface AnalyticsConfig {
  apiKey: string;
  apiHost?: string;
  persistence?: 'localStorage' | 'memory';
  autocapture?: boolean;
  disable_session_recording?: boolean;
  opt_out_capturing_by_default?: boolean;
  loaded?: (posthog: any) => void;
}

export type EventName = 
  | 'session_created'
  | 'session_completed'
  | 'session_resumed'
  | 'feature_used'
  | 'error_occurred'
  | 'model_selected'
  | 'tab_created'
  | 'tab_closed'
  | 'file_opened'
  | 'file_edited'
  | 'file_saved'
  | 'agent_executed'
  | 'mcp_server_connected'
  | 'mcp_server_disconnected'
  | 'slash_command_used'
  | 'settings_changed'
  | 'app_started'
  | 'app_closed'
  // New session events
  | 'prompt_submitted'
  | 'session_stopped'
  | 'checkpoint_created'
  | 'checkpoint_restored'
  | 'tool_executed'
  // New agent events
  | 'agent_started'
  | 'agent_progress'
  | 'agent_error'
  // New MCP events
  | 'mcp_server_added'
  | 'mcp_server_removed'
  | 'mcp_tool_invoked'
  | 'mcp_connection_error'
  // New slash command events
  | 'slash_command_selected'
  | 'slash_command_executed'
  | 'slash_command_created'
  // New error and performance events
  | 'api_error'
  | 'ui_error'
  | 'performance_bottleneck'
  | 'memory_warning'
  // User journey events
  | 'journey_milestone'
  | 'user_retention'
  // AI interaction events
  | 'ai_interaction'
  | 'prompt_pattern'
  // Quality events
  | 'output_regenerated'
  | 'conversation_abandoned'
  | 'suggestion_accepted'
  | 'suggestion_rejected'
  // Workflow events
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_abandoned'
  // Feature adoption events
  | 'feature_discovered'
  | 'feature_adopted'
  | 'feature_combination'
  // Resource usage events
  | 'resource_usage_high'
  | 'resource_usage_sampled'
  // Network performance events
  | 'network_performance'
  | 'network_failure'
  // Engagement events
  | 'session_engagement';

export interface FeatureUsageProperties {
  feature: string;
  subfeature?: string;
  metadata?: Record<string, any>;
}

export interface ErrorProperties {
  error_type: string;
  error_code?: string;
  error_message?: string;
  context?: string;
}

export interface SessionProperties {
  model?: string;
  source?: string;
  resumed?: boolean;
  checkpoint_id?: string;
}

export interface ModelProperties {
  previous_model?: string;
  new_model: string;
  source?: string;
}

export interface AgentProperties {
  agent_type: string;
  agent_name?: string;
  success: boolean;
  duration_ms?: number;
}

export interface MCPProperties {
  server_name: string;
  server_type?: string;
  success: boolean;
}

export interface SlashCommandProperties {
  command: string;
  success: boolean;
}

export interface PerformanceMetrics {
  startup_time_ms?: number;
  memory_usage_mb?: number;
  api_response_time_ms?: number;
  render_time_ms?: number;
}

// Claude Code Session event properties
export interface PromptSubmittedProperties {
  prompt_length: number;
  model: string;
  has_attachments: boolean;
  source: 'keyboard' | 'button';
  word_count: number;
}

export interface SessionStoppedProperties {
  duration_ms: number;
  messages_count: number;
  reason: 'user_stopped' | 'error' | 'completed';
}

// Enhanced session stopped properties for detailed analytics
export interface EnhancedSessionStoppedProperties extends SessionStoppedProperties {
  // Timing metrics
  time_to_first_message_ms?: number;
  average_response_time_ms?: number;
  idle_time_ms?: number;
  
  // Interaction metrics
  prompts_sent: number;
  tools_executed: number;
  tools_failed: number;
  files_created: number;
  files_modified: number;
  files_deleted: number;
  
  // Content metrics
  total_tokens_used?: number;
  code_blocks_generated?: number;
  errors_encountered: number;
  
  // Session context
  model: string;
  has_checkpoints: boolean;
  checkpoint_count?: number;
  was_resumed: boolean;
  
  // Agent context (if applicable)
  agent_type?: string;
  agent_name?: string;
  agent_success?: boolean;
  
  // Stop context
  stop_source: 'user_button' | 'keyboard_shortcut' | 'timeout' | 'error' | 'completed';
  final_state: 'success' | 'partial' | 'failed' | 'cancelled';
  has_pending_prompts: boolean;
  pending_prompts_count?: number;
}

export interface CheckpointCreatedProperties {
  checkpoint_number: number;
  session_duration_at_checkpoint: number;
}

export interface CheckpointRestoredProperties {
  checkpoint_id: string;
  time_since_checkpoint_ms: number;
}

export interface ToolExecutedProperties {
  tool_name: string;
  execution_time_ms: number;
  success: boolean;
  error_message?: string;
}

// Enhanced Agent properties
export interface AgentStartedProperties {
  agent_type: string;
  agent_name?: string;
  has_custom_prompt: boolean;
}

export interface AgentProgressProperties {
  step_number: number;
  step_type: string;
  duration_ms: number;
  agent_type: string;
}

export interface AgentErrorProperties {
  error_type: string;
  error_stage: string;
  retry_count: number;
  agent_type: string;
}

// MCP properties
export interface MCPServerAddedProperties {
  server_type: string;
  configuration_method: 'manual' | 'preset' | 'import';
}

export interface MCPServerRemovedProperties {
  server_name: string;
  was_connected: boolean;
}

export interface MCPToolInvokedProperties {
  server_name: string;
  tool_name: string;
  invocation_source: 'user' | 'agent' | 'suggestion';
}

export interface MCPConnectionErrorProperties {
  server_name: string;
  error_type: string;
  retry_attempt: number;
}

// Slash Command properties
export interface SlashCommandSelectedProperties {
  command_name: string;
  selection_method: 'click' | 'keyboard' | 'autocomplete';
}

export interface SlashCommandExecutedProperties {
  command_name: string;
  parameters_count: number;
  execution_time_ms: number;
}

export interface SlashCommandCreatedProperties {
  command_type: 'custom' | 'imported';
  has_parameters: boolean;
}

// Error and Performance properties
export interface APIErrorProperties {
  endpoint: string;
  error_code: string | number;
  retry_count: number;
  response_time_ms: number;
}

export interface UIErrorProperties {
  component_name: string;
  error_type: string;
  user_action?: string;
}

export interface PerformanceBottleneckProperties {
  operation_type: string;
  duration_ms: number;
  data_size?: number;
  threshold_exceeded: boolean;
}

export interface MemoryWarningProperties {
  component: string;
  memory_mb: number;
  threshold_exceeded: boolean;
  gc_count?: number;
}

// User Journey properties
export interface UserJourneyProperties {
  journey_stage: 'onboarding' | 'first_chat' | 'first_agent' | 'power_user';
  milestone_reached?: string;
  time_to_milestone_ms?: number;
}

// Enhanced prompt properties
export interface EnhancedPromptSubmittedProperties extends PromptSubmittedProperties {
  conversation_depth: number;
  prompt_complexity: 'simple' | 'moderate' | 'complex';
  contains_code: boolean;
  language_detected?: string;
  session_age_ms: number;
}

// Enhanced tool properties
export interface EnhancedToolExecutedProperties extends ToolExecutedProperties {
  tool_category: 'file' | 'search' | 'system' | 'custom';
  consecutive_failures?: number;
  retry_attempted: boolean;
  input_size_bytes?: number;
  output_size_bytes?: number;
}

// Enhanced error properties
export interface EnhancedErrorProperties extends ErrorProperties {
  user_action_before_error?: string;
  recovery_attempted: boolean;
  recovery_successful?: boolean;
  error_frequency: number;
  stack_trace_hash?: string;
}

// Session engagement properties
export interface SessionEngagementProperties {
  session_duration_ms: number;
  messages_sent: number;
  tools_used: string[];
  files_modified: number;
  engagement_score: number;
}

// Feature discovery properties
export interface FeatureDiscoveryProperties {
  feature_name: string;
  discovery_method: 'organic' | 'prompted' | 'documentation';
  time_to_first_use_ms: number;
  initial_success: boolean;
}

// Output quality properties
export interface OutputQualityProperties {
  regeneration_count: number;
  modification_requested: boolean;
  final_acceptance: boolean;
  time_to_acceptance_ms: number;
}

// Resource usage properties
export interface ResourceUsageProperties {
  cpu_usage_percent?: number;
  memory_usage_mb: number;
  disk_io_mb?: number;
  network_requests_count: number;
  cache_hit_rate?: number;
  active_connections: number;
}

// Feature adoption properties
export interface FeatureAdoptionProperties {
  feature: string;
  adoption_stage: 'discovered' | 'tried' | 'adopted' | 'abandoned';
  usage_count: number;
  days_since_first_use: number;
  usage_trend: 'increasing' | 'stable' | 'decreasing';
}

// Feature combination properties
export interface FeatureCombinationProperties {
  primary_feature: string;
  secondary_feature: string;
  combination_frequency: number;
  workflow_efficiency_gain?: number;
}

// AI interaction properties
export interface AIInteractionProperties {
  model: string;
  request_tokens: number;
  response_tokens: number;
  response_quality_score?: number;
  context_switches: number;
  clarification_requests: number;
}

// Prompt pattern properties
export interface PromptPatternProperties {
  prompt_category: string;
  prompt_effectiveness: 'high' | 'medium' | 'low';
  required_iterations: number;
  final_satisfaction: boolean;
}

// Workflow properties
export interface WorkflowProperties {
  workflow_type: string;
  steps_completed: number;
  total_steps: number;
  duration_ms: number;
  interruptions: number;
  completion_rate: number;
  tools_used: string[];
}

// Network performance properties
export interface NetworkPerformanceProperties {
  endpoint_type: 'mcp' | 'api' | 'webhook';
  latency_ms: number;
  payload_size_bytes: number;
  connection_quality: 'excellent' | 'good' | 'poor';
  retry_count: number;
  circuit_breaker_triggered: boolean;
}

// Suggestion properties
export interface SuggestionProperties {
  suggestion_type: string;
  suggestion_source: string;
  accepted: boolean;
  response_time_ms: number;
}
