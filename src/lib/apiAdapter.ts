/**
 * API Adapter - Compatibility layer for Tauri vs Web environments
 * 
 * This module detects whether we're running in Tauri (desktop app) or web browser
 * and provides a unified interface that switches between:
 * - Tauri invoke calls (for desktop)
 * - REST API calls (for web/phone browser)
 */

import { invoke } from "@tauri-apps/api/core";

// Extend Window interface for Tauri
declare global {
  interface Window {
    __TAURI__?: any;
    __TAURI_METADATA__?: any;
    __TAURI_INTERNALS__?: any;
  }
}

// Environment detection
let isTauriEnvironment: boolean | null = null;

/**
 * Detect if we're running in Tauri environment
 */
function detectEnvironment(): boolean {
  if (isTauriEnvironment !== null) {
    return isTauriEnvironment;
  }

  // Check if we're in a browser environment first
  if (typeof window === 'undefined') {
    isTauriEnvironment = false;
    return false;
  }

  // Check for Tauri-specific indicators
  const isTauri = !!(
    window.__TAURI__ || 
    window.__TAURI_METADATA__ ||
    window.__TAURI_INTERNALS__ ||
    // Check user agent for Tauri
    navigator.userAgent.includes('Tauri')
  );

  console.log('[detectEnvironment] isTauri:', isTauri, 'userAgent:', navigator.userAgent);
  
  isTauriEnvironment = isTauri;
  return isTauri;
}

/**
 * Response wrapper for REST API calls
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Make a REST API call to our web server
 */
async function restApiCall<T>(endpoint: string, params?: any): Promise<T> {
  // First handle path parameters in the endpoint string
  let processedEndpoint = endpoint;
  console.log(`[REST API] Original endpoint: ${endpoint}, params:`, params);
  
  if (params) {
    Object.keys(params).forEach(key => {
      // Try different case variations for the placeholder
      const placeholders = [
        `{${key}}`,
        `{${key.charAt(0).toLowerCase() + key.slice(1)}}`,
        `{${key.charAt(0).toUpperCase() + key.slice(1)}}`
      ];
      
      placeholders.forEach(placeholder => {
        if (processedEndpoint.includes(placeholder)) {
          console.log(`[REST API] Replacing ${placeholder} with ${params[key]}`);
          processedEndpoint = processedEndpoint.replace(placeholder, encodeURIComponent(String(params[key])));
        }
      });
    });
  }
  
  console.log(`[REST API] Processed endpoint: ${processedEndpoint}`);
  
  const url = new URL(processedEndpoint, window.location.origin);
  
  // Add remaining params as query parameters for GET requests (if no placeholders remain)
  if (params && !processedEndpoint.includes('{')) {
    Object.keys(params).forEach(key => {
      // Only add as query param if it wasn't used as a path param
      if (!endpoint.includes(`{${key}}`) && 
          !endpoint.includes(`{${key.charAt(0).toLowerCase() + key.slice(1)}}`) &&
          !endpoint.includes(`{${key.charAt(0).toUpperCase() + key.slice(1)}}`) &&
          params[key] !== undefined && 
          params[key] !== null) {
        url.searchParams.append(key, String(params[key]));
      }
    });
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<T> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'API call failed');
    }

    return result.data as T;
  } catch (error) {
    console.error(`REST API call failed for ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Unified API adapter that works in both Tauri and web environments
 */
export async function apiCall<T>(command: string, params?: any): Promise<T> {
  const isWeb = !detectEnvironment();
  
  if (!isWeb) {
    // Tauri environment - try invoke
    console.log(`[Tauri] Calling: ${command}`, params);
    try {
      return await invoke<T>(command, params);
    } catch (error) {
      console.warn(`[Tauri] invoke failed, falling back to web mode:`, error);
      // Fall through to web mode
    }
  }
  
  // Web environment - use REST API
  console.log(`[Web] Calling: ${command}`, params);
  
  // Special handling for commands that use streaming/events
  const streamingCommands = ['execute_claude_code', 'continue_claude_code', 'resume_claude_code'];
  if (streamingCommands.includes(command)) {
    return handleStreamingCommand<T>(command, params);
  }
  
  // Map Tauri commands to REST endpoints
  const endpoint = mapCommandToEndpoint(command, params);
  return await restApiCall<T>(endpoint, params);
}

/**
 * Map Tauri command names to REST API endpoints
 */
function mapCommandToEndpoint(command: string, _params?: any): string {
  const commandToEndpoint: Record<string, string> = {
    // Project and session commands
    'list_projects': '/api/projects',
    'get_project_sessions': '/api/projects/{projectId}/sessions',
    
    // Agent commands
    'list_agents': '/api/agents',
    'fetch_github_agents': '/api/agents/github',
    'fetch_github_agent_content': '/api/agents/github/content',
    'import_agent_from_github': '/api/agents/import/github',
    'create_agent': '/api/agents',
    'update_agent': '/api/agents/{id}',
    'delete_agent': '/api/agents/{id}',
    'get_agent': '/api/agents/{id}',
    'export_agent': '/api/agents/{id}/export',
    'import_agent': '/api/agents/import',
    'import_agent_from_file': '/api/agents/import/file',
    'execute_agent': '/api/agents/{agentId}/execute',
    'list_agent_runs': '/api/agents/runs',
    'get_agent_run': '/api/agents/runs/{id}',
    'get_agent_run_with_real_time_metrics': '/api/agents/runs/{id}/metrics',
    'list_running_sessions': '/api/sessions/running',
    'kill_agent_session': '/api/agents/sessions/{runId}/kill',
    'get_session_status': '/api/agents/sessions/{runId}/status',
    'cleanup_finished_processes': '/api/agents/sessions/cleanup',
    'get_session_output': '/api/agents/sessions/{runId}/output',
    'get_live_session_output': '/api/agents/sessions/{runId}/output/live',
    'stream_session_output': '/api/agents/sessions/{runId}/output/stream',
    'load_agent_session_history': '/api/agents/sessions/{sessionId}/history',
    
    // Usage commands
    'get_usage_stats': '/api/usage',
    'get_usage_by_date_range': '/api/usage/range',
    'get_session_stats': '/api/usage/sessions',
    'get_usage_details': '/api/usage/details',
    
    // Settings and configuration
    'get_claude_settings': '/api/settings/claude',
    'save_claude_settings': '/api/settings/claude',
    'get_system_prompt': '/api/settings/system-prompt',
    'save_system_prompt': '/api/settings/system-prompt',
    'check_claude_version': '/api/settings/claude/version',
    'find_claude_md_files': '/api/claude-md',
    'read_claude_md_file': '/api/claude-md/read',
    'save_claude_md_file': '/api/claude-md/save',
    
    // Session management
    'open_new_session': '/api/sessions/new',
    'load_session_history': '/api/sessions/{sessionId}/history/{projectId}',
    'list_running_claude_sessions': '/api/sessions/running',
    'execute_claude_code': '/api/sessions/execute',
    'continue_claude_code': '/api/sessions/continue',
    'resume_claude_code': '/api/sessions/resume',
    'cancel_claude_execution': '/api/sessions/{sessionId}/cancel',
    'get_claude_session_output': '/api/sessions/{sessionId}/output',
    
    // MCP commands
    'mcp_add': '/api/mcp/servers',
    'mcp_list': '/api/mcp/servers',
    'mcp_get': '/api/mcp/servers/{name}',
    'mcp_remove': '/api/mcp/servers/{name}',
    'mcp_add_json': '/api/mcp/servers/json',
    'mcp_add_from_claude_desktop': '/api/mcp/import/claude-desktop',
    'mcp_serve': '/api/mcp/serve',
    'mcp_test_connection': '/api/mcp/servers/{name}/test',
    'mcp_reset_project_choices': '/api/mcp/reset-choices',
    'mcp_get_server_status': '/api/mcp/status',
    'mcp_read_project_config': '/api/mcp/project-config',
    'mcp_save_project_config': '/api/mcp/project-config',
    
    // Binary and installation management
    'get_claude_binary_path': '/api/settings/claude/binary-path',
    'set_claude_binary_path': '/api/settings/claude/binary-path',
    'list_claude_installations': '/api/settings/claude/installations',
    
    // Storage commands
    'storage_list_tables': '/api/storage/tables',
    'storage_read_table': '/api/storage/tables/{tableName}',
    'storage_update_row': '/api/storage/tables/{tableName}/rows/{id}',
    'storage_delete_row': '/api/storage/tables/{tableName}/rows/{id}',
    'storage_insert_row': '/api/storage/tables/{tableName}/rows',
    'storage_execute_sql': '/api/storage/sql',
    'storage_reset_database': '/api/storage/reset',
    
    // Hooks configuration
    'get_hooks_config': '/api/hooks/config',
    'update_hooks_config': '/api/hooks/config',
    'validate_hook_command': '/api/hooks/validate',
    
    // Slash commands
    'slash_commands_list': '/api/slash-commands',
    'slash_command_get': '/api/slash-commands/{commandId}',
    'slash_command_save': '/api/slash-commands',
    'slash_command_delete': '/api/slash-commands/{commandId}',
  };

  const endpoint = commandToEndpoint[command];
  if (!endpoint) {
    console.warn(`Unknown command: ${command}, falling back to generic endpoint`);
    return `/api/unknown/${command}`;
  }

  return endpoint;
}

/**
 * Get environment info for debugging
 */
export function getEnvironmentInfo() {
  return {
    isTauri: detectEnvironment(),
    userAgent: navigator.userAgent,
    location: window.location.href,
  };
}

/**
 * Handle streaming commands via WebSocket in web mode
 */
async function handleStreamingCommand<T>(command: string, params?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    // Use wss:// for HTTPS connections (e.g., ngrok), ws:// for HTTP (localhost)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/claude`;
    console.log(`[TRACE] handleStreamingCommand called:`);
    console.log(`[TRACE]   command: ${command}`);
    console.log(`[TRACE]   params:`, params);
    console.log(`[TRACE]   WebSocket URL: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log(`[TRACE] WebSocket opened successfully`);
      
      // Send execution request
      const request = {
        command_type: command.replace('_claude_code', ''), // execute, continue, resume
        project_path: params?.projectPath || '',
        prompt: params?.prompt || '',
        model: params?.model || 'claude-3-5-sonnet-20241022',
        session_id: params?.sessionId,
      };
      
      console.log(`[TRACE] Sending WebSocket request:`, request);
      console.log(`[TRACE] Request JSON:`, JSON.stringify(request));
      
      ws.send(JSON.stringify(request));
      console.log(`[TRACE] WebSocket request sent`);
    };
    
    ws.onmessage = (event) => {
      console.log(`[TRACE] WebSocket message received:`, event.data);
      try {
        const message = JSON.parse(event.data);
        console.log(`[TRACE] Parsed WebSocket message:`, message);
        
        if (message.type === 'start') {
          console.log(`[TRACE] Start message: ${message.message}`);
        } else if (message.type === 'output') {
          console.log(`[TRACE] Output message, content length: ${message.content?.length || 0}`);
          console.log(`[TRACE] Raw content:`, message.content);
          
          // The backend sends Claude output as a JSON string in the content field
          // We need to parse this to get the actual Claude message
          try {
            const claudeMessage = typeof message.content === 'string' 
              ? JSON.parse(message.content) 
              : message.content;
            console.log(`[TRACE] Parsed Claude message:`, claudeMessage);
            
            // Simulate Tauri event for compatibility with existing UI
            const customEvent = new CustomEvent('claude-output', {
              detail: claudeMessage
            });
            console.log(`[TRACE] Dispatching claude-output event:`, customEvent.detail);
            console.log(`[TRACE] Event type:`, customEvent.type);
            window.dispatchEvent(customEvent);
          } catch (e) {
            console.error(`[TRACE] Failed to parse Claude output content:`, e);
            console.error(`[TRACE] Content that failed to parse:`, message.content);
          }
        } else if (message.type === 'completion') {
          console.log(`[TRACE] Completion message:`, message);
          
          // Dispatch claude-complete event for UI state management
          const completeEvent = new CustomEvent('claude-complete', {
            detail: message.status === 'success'
          });
          console.log(`[TRACE] Dispatching claude-complete event:`, completeEvent.detail);
          window.dispatchEvent(completeEvent);
          
          ws.close();
          if (message.status === 'success') {
            console.log(`[TRACE] Resolving promise with success`);
            resolve({} as T); // Return empty object for now
          } else {
            console.log(`[TRACE] Rejecting promise with error: ${message.error}`);
            reject(new Error(message.error || 'Execution failed'));
          }
        } else if (message.type === 'error') {
          console.log(`[TRACE] Error message:`, message);
          
          // Dispatch claude-error event for UI error handling
          const errorEvent = new CustomEvent('claude-error', {
            detail: message.message || 'Unknown error'
          });
          console.log(`[TRACE] Dispatching claude-error event:`, errorEvent.detail);
          window.dispatchEvent(errorEvent);
          
          reject(new Error(message.message || 'Unknown error'));
        } else {
          console.log(`[TRACE] Unknown message type: ${message.type}`);
        }
      } catch (e) {
        console.error('[TRACE] Failed to parse WebSocket message:', e);
        console.error('[TRACE] Raw message:', event.data);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[TRACE] WebSocket error:', error);
      
      // Dispatch claude-error event for connection errors
      const errorEvent = new CustomEvent('claude-error', {
        detail: 'WebSocket connection failed'
      });
      console.log(`[TRACE] Dispatching claude-error event for WebSocket error`);
      window.dispatchEvent(errorEvent);
      
      reject(new Error('WebSocket connection failed'));
    };
    
    ws.onclose = (event) => {
      console.log(`[TRACE] WebSocket closed - code: ${event.code}, reason: ${event.reason}`);
      
      // If connection closed unexpectedly (not a normal close), dispatch cancelled event
      if (event.code !== 1000 && event.code !== 1001) {
        const cancelEvent = new CustomEvent('claude-complete', {
          detail: false // false indicates cancellation/failure
        });
        console.log(`[TRACE] Dispatching claude-complete event for unexpected close`);
        window.dispatchEvent(cancelEvent);
      }
    };
  });
}

/**
 * Initialize web mode compatibility
 * Sets up mocks for Tauri APIs when running in web mode
 */
export function initializeWebMode() {
  if (!detectEnvironment()) {
    // Mock Tauri event system for web mode
    if (!window.__TAURI__) {
      window.__TAURI__ = {
        event: {
          listen: (eventName: string, callback: (event: any) => void) => {
            // Listen for custom events that simulate Tauri events
            const handler = (e: any) => callback({ payload: e.detail });
            window.addEventListener(`${eventName}`, handler);
            return Promise.resolve(() => {
              window.removeEventListener(`${eventName}`, handler);
            });
          },
          emit: () => Promise.resolve(),
        },
        invoke: () => Promise.reject(new Error('Tauri invoke not available in web mode')),
        // Mock the core module that includes transformCallback
        core: {
          invoke: () => Promise.reject(new Error('Tauri invoke not available in web mode')),
          transformCallback: () => {
            throw new Error('Tauri transformCallback not available in web mode');
          }
        }
      };
    }
  }
}