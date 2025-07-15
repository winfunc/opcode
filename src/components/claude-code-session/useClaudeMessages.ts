import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { getEnvironmentInfo } from '@/lib/apiAdapter';
import type { ClaudeStreamMessage } from '../AgentExecution';

// Conditional import for Tauri
let tauriListen: any;
try {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    tauriListen = require('@tauri-apps/api/event').listen;
  }
} catch (e) {
  console.log('[useClaudeMessages] Tauri event API not available, using web mode');
}

interface UseClaudeMessagesOptions {
  onSessionInfo?: (info: { sessionId: string; projectId: string }) => void;
  onTokenUpdate?: (tokens: number) => void;
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
}

export function useClaudeMessages(options: UseClaudeMessagesOptions = {}) {
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [rawJsonlOutput, setRawJsonlOutput] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const eventListenerRef = useRef<(() => void) | null>(null);
  const accumulatedContentRef = useRef<{ [key: string]: string }>({});

  const handleMessage = useCallback((message: ClaudeStreamMessage) => {
    console.log('[TRACE] useClaudeMessages.handleMessage called with:', message);
    
    if ((message as any).type === "start") {
      console.log('[TRACE] Start message detected - clearing accumulated content and setting streaming=true');
      // Clear accumulated content for new stream
      accumulatedContentRef.current = {};
      setIsStreaming(true);
      options.onStreamingChange?.(true, currentSessionId);
    } else if ((message as any).type === "partial") {
      console.log('[TRACE] Partial message detected');
      if (message.tool_calls && message.tool_calls.length > 0) {
        message.tool_calls.forEach((toolCall: any) => {
          if (toolCall.content && toolCall.partial_tool_call_index !== undefined) {
            const key = `tool-${toolCall.partial_tool_call_index}`;
            if (!accumulatedContentRef.current[key]) {
              accumulatedContentRef.current[key] = "";
            }
            accumulatedContentRef.current[key] += toolCall.content;
            toolCall.accumulated_content = accumulatedContentRef.current[key];
          }
        });
      }
    } else if ((message as any).type === "response" && message.message?.usage) {
      console.log('[TRACE] Response message with usage detected');
      const totalTokens = (message.message.usage.input_tokens || 0) + 
                         (message.message.usage.output_tokens || 0);
      console.log('[TRACE] Total tokens:', totalTokens);
      options.onTokenUpdate?.(totalTokens);
    } else if ((message as any).type === "error" || (message as any).type === "response") {
      console.log('[TRACE] Error or response message detected - setting streaming=false');
      setIsStreaming(false);
      options.onStreamingChange?.(false, currentSessionId);
    } else if ((message as any).type === "output") {
      console.log('[TRACE] Output message detected, content:', (message as any).content);
    } else {
      console.log('[TRACE] Unknown message type:', (message as any).type);
    }

    console.log('[TRACE] Adding message to state');
    setMessages(prev => {
      const newMessages = [...prev, message];
      console.log('[TRACE] Total messages now:', newMessages.length);
      return newMessages;
    });
    setRawJsonlOutput(prev => [...prev, JSON.stringify(message)]);

    // Extract session info
    if ((message as any).type === "session_info" && (message as any).session_id && (message as any).project_id) {
      console.log('[TRACE] Session info detected:', (message as any).session_id, (message as any).project_id);
      options.onSessionInfo?.({
        sessionId: (message as any).session_id,
        projectId: (message as any).project_id
      });
      setCurrentSessionId((message as any).session_id);
    }
  }, [currentSessionId, options]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setRawJsonlOutput([]);
    accumulatedContentRef.current = {};
  }, []);

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const output = await api.getSessionOutput(parseInt(sessionId));
      // Note: API returns a string, not an array of outputs
      const outputs = [{ jsonl: output }];
      const loadedMessages: ClaudeStreamMessage[] = [];
      const loadedRawJsonl: string[] = [];
      
      outputs.forEach(output => {
        if (output.jsonl) {
          const lines = output.jsonl.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            try {
              const msg = JSON.parse(line);
              loadedMessages.push(msg);
              loadedRawJsonl.push(line);
            } catch (e) {
              console.error("Failed to parse JSONL:", e);
            }
          });
        }
      });
      
      setMessages(loadedMessages);
      setRawJsonlOutput(loadedRawJsonl);
    } catch (error) {
      console.error("Failed to load session outputs:", error);
      throw error;
    }
  }, []);

  // Set up event listener
  useEffect(() => {
    const setupListener = async () => {
      console.log('[TRACE] useClaudeMessages setupListener called');
      if (eventListenerRef.current) {
        console.log('[TRACE] Cleaning up existing event listener');
        eventListenerRef.current();
      }
      
      const envInfo = getEnvironmentInfo();
      console.log('[TRACE] Environment info:', envInfo);
      
      if (envInfo.isTauri && tauriListen) {
        // Tauri mode - use Tauri's event system
        console.log('[TRACE] Setting up Tauri event listener for claude-stream');
        eventListenerRef.current = await tauriListen("claude-stream", (event: any) => {
          console.log('[TRACE] Tauri event received:', event);
          try {
            const message = JSON.parse(event.payload) as ClaudeStreamMessage;
            console.log('[TRACE] Parsed Tauri message:', message);
            handleMessage(message);
          } catch (error) {
            console.error("[TRACE] Failed to parse Claude stream message:", error);
          }
        });
        console.log('[TRACE] Tauri event listener setup complete');
      } else {
        // Web mode - use DOM events (these are dispatched by our WebSocket handler)
        console.log('[TRACE] Setting up web event listener for claude-output');
        const webEventHandler = (event: any) => {
          console.log('[TRACE] Web event received:', event);
          console.log('[TRACE] Event detail:', event.detail);
          try {
            const message = event.detail as ClaudeStreamMessage;
            console.log('[TRACE] Calling handleMessage with:', message);
            handleMessage(message);
          } catch (error) {
            console.error("[TRACE] Failed to parse Claude stream message:", error);
          }
        };
        
        window.addEventListener('claude-output', webEventHandler);
        console.log('[TRACE] Web event listener added for claude-output');
        console.log('[TRACE] Event listener function:', webEventHandler);
        
        // Test if event listener is working
        setTimeout(() => {
          console.log('[TRACE] Testing event dispatch...');
          window.dispatchEvent(new CustomEvent('claude-output', {
            detail: { type: 'test', message: 'test event' }
          }));
        }, 1000);
        
        eventListenerRef.current = () => {
          console.log('[TRACE] Removing web event listener');
          window.removeEventListener('claude-output', webEventHandler);
        };
      }
    };

    setupListener();

    return () => {
      console.log('[TRACE] useClaudeMessages cleanup');
      if (eventListenerRef.current) {
        eventListenerRef.current();
      }
    };
  }, [handleMessage]);

  return {
    messages,
    rawJsonlOutput,
    isStreaming,
    currentSessionId,
    clearMessages,
    loadMessages,
    handleMessage
  };
}