/**
 * API Adapter for Claudia
 * 
 * This module provides a unified interface for API calls that works
 * in both Tauri desktop and web environments.
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, type UnlistenFn, type EventCallback } from "@tauri-apps/api/event";

export interface ApiAdapter {
  /** Whether running in desktop mode */
  readonly isDesktop: boolean;
  
  /** Invoke a command/API call */
  invoke<T>(command: string, args?: any): Promise<T>;
  
  /** Listen to events */
  listen(event: string, handler: EventCallback<any>): Promise<UnlistenFn>;
  
  /** Remove all listeners for an event */
  removeAllListeners(event?: string): void;
}

/**
 * Tauri Desktop API Adapter
 */
class TauriApiAdapter implements ApiAdapter {
  readonly isDesktop = true;
  private listeners = new Map<string, UnlistenFn[]>();

  async invoke<T>(command: string, args?: any): Promise<T> {
    return tauriInvoke<T>(command, args);
  }

  async listen(event: string, handler: EventCallback<any>): Promise<UnlistenFn> {
    const unlisten = await tauriListen(event, handler);
    
    // Track listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(unlisten);
    
    return unlisten;
  }

  removeAllListeners(event?: string): void {
    if (event) {
      const listeners = this.listeners.get(event) || [];
      listeners.forEach(unlisten => unlisten());
      this.listeners.delete(event);
    } else {
      this.listeners.forEach(listeners => {
        listeners.forEach(unlisten => unlisten());
      });
      this.listeners.clear();
    }
  }
}

/**
 * Web API Adapter
 */
class WebApiAdapter implements ApiAdapter {
  readonly isDesktop = false;
  private ws: WebSocket | null = null;
  private eventHandlers = new Map<string, Set<EventCallback<any>>>();
  private apiBase: string;

  constructor(apiBase = 'http://localhost:8080/api', wsUrl = 'ws://localhost:8080/ws') {
    this.apiBase = apiBase;
    this.connectWebSocket(wsUrl);
  }

  private connectWebSocket(wsUrl: string) {
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.emitEvent(message.type, message.data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting in 5s...');
        setTimeout(() => this.connectWebSocket(wsUrl), 5000);
      };
    } catch (e) {
      console.error('Failed to connect WebSocket:', e);
    }
  }

  private emitEvent(event: string, data: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        handler({ event, payload: data, id: Date.now() });
      });
    }
  }

  async invoke<T>(command: string, args?: any): Promise<T> {
    // Map Tauri commands to REST endpoints
    let endpoint = this.mapCommandToEndpoint(command);
    const method = this.getMethodForCommand(command);
    
    // Handle path parameters (e.g., :id)
    if (args && endpoint.includes(':')) {
      // Replace :param with actual values
      endpoint = endpoint.replace(/:(\w+)/g, (match, param) => {
        const value = args[param] || args[param + 'Id'] || args[param + '_id'];
        if (value !== undefined) {
          delete args[param];
          delete args[param + 'Id'];
          delete args[param + '_id'];
          return String(value);
        }
        return match;
      });
    }
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (method !== 'GET' && args && Object.keys(args).length > 0) {
      options.body = JSON.stringify(args);
    } else if (method === 'GET' && args && Object.keys(args).length > 0) {
      // Add query parameters for GET requests
      const params = new URLSearchParams();
      Object.entries(args).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      if (queryString) {
        endpoint = endpoint.includes('?') 
          ? endpoint + '&' + queryString
          : endpoint + '?' + queryString;
      }
    }

    const response = await fetch(`${this.apiBase}${endpoint}`, options);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `API call failed: ${response.status}`);
    }

    const result = await response.json();
    
    // Extract data from success wrapper if present
    if (result.success && result.data !== undefined) {
      return result.data;
    }
    
    return result;
  }

  async listen(event: string, handler: EventCallback<any>): Promise<UnlistenFn> {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    
    this.eventHandlers.get(event)!.add(handler);
    
    // Return unlisten function
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(event);
        }
      }
    };
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.eventHandlers.delete(event);
    } else {
      this.eventHandlers.clear();
    }
  }

  private mapCommandToEndpoint(command: string): string {
    // Map Tauri commands to REST endpoints
    const mappings: Record<string, string> = {
      // Project management
      'list_projects': '/projects',
      'get_project_sessions': '/projects/:id/sessions',
      
      // Claude execution
      'execute_claude_code': '/claude/execute',
      'continue_claude_code': '/claude/continue',
      'resume_claude_code': '/claude/resume',
      'cancel_claude_execution': '/claude/cancel',
      'list_running_claude_sessions': '/running-claude-sessions',
      'get_claude_session_output': '/claude/status/:session_id',
      
      // Agent management
      'list_agents': '/agents',
      'create_agent': '/agents',
      'get_agent': '/agents/:id',
      'update_agent': '/agents/:id',
      'delete_agent': '/agents/:id',
      'execute_agent': '/agents/:id/execute',
      'list_agent_runs': '/agents/:id/runs',
      'list_running_sessions': '/running-sessions',
      
      // Usage analytics
      'get_usage_stats': '/usage/stats',
      'get_usage_details': '/usage/details',
      'get_usage_by_date_range': '/usage/date-range',
      'get_session_stats': '/usage/session/:id/stats',
      
      // MCP servers
      'mcp_list': '/mcp/servers',
      'mcp_add': '/mcp/servers',
      'mcp_get': '/mcp/servers/:name',
      'mcp_remove': '/mcp/servers/:name',
      'mcp_test_connection': '/mcp/test',
      
      // Settings
      'get_claude_settings': '/settings/claude',
      'save_claude_settings': '/settings/claude',
      'get_system_prompt': '/settings/system-prompt',
      'save_system_prompt': '/settings/system-prompt',
      
      // File system
      'list_directory_contents': '/fs/list',
      'search_files': '/fs/search',
      'find_claude_md_files': '/claude-md/find',
      'read_claude_md_file': '/claude-md/read',
      'save_claude_md_file': '/claude-md/save',
      
      // Session history
      'load_session_history': '/sessions/:projectId/:sessionId/history',
      'load_agent_session_history': '/agent-sessions/:sessionId/history',
      
      // Agent runs
      'get_agent_run': '/agent-runs/:id',
      'kill_agent_session': '/agent-sessions/:runId/kill',
      'get_session_output': '/agent-sessions/:runId/output',
      'get_live_session_output': '/agent-sessions/:runId/live-output',
      
      // Checkpoints
      'create_checkpoint': '/checkpoints',
      'restore_checkpoint': '/checkpoints/restore',
      'list_checkpoints': '/sessions/:sessionId/checkpoints',
      'fork_from_checkpoint': '/checkpoints/fork',
      'get_session_timeline': '/sessions/:sessionId/timeline',
      'update_checkpoint_settings': '/checkpoint-settings',
      'get_checkpoint_diff': '/checkpoints/diff',
      
      // Slash commands
      'list_slash_commands': '/slash-commands',
      'create_slash_command': '/slash-commands',
      'update_slash_command': '/slash-commands/:id',
      'delete_slash_command': '/slash-commands/:id',
      'execute_slash_command': '/slash-commands/execute'
    };

    return mappings[command] || `/${command}`;
  }

  private getMethodForCommand(command: string): string {
    // Determine HTTP method based on command
    if (command.startsWith('create_') || command.startsWith('add_') || 
        command.includes('execute') || command.includes('save')) {
      return 'POST';
    } else if (command.startsWith('update_')) {
      return 'PUT';
    } else if (command.startsWith('delete_') || command.startsWith('remove_')) {
      return 'DELETE';
    }
    return 'GET';
  }
}

/**
 * Create and return the appropriate API adapter based on the environment
 */
export function createApiAdapter(): ApiAdapter {
  // Check if running in Tauri
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return new TauriApiAdapter();
  }
  
  // Use web adapter with environment-based URLs
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api';
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
  
  return new WebApiAdapter(apiBase, wsUrl);
}

// Create singleton instance
export const apiAdapter = createApiAdapter();