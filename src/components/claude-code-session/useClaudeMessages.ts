import { useState, useCallback, useRef, useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { ClaudeStreamMessage } from "../AgentExecution";

/**
 * Configuration options for the useClaudeMessages hook
 */
interface UseClaudeMessagesOptions {
  onSessionInfo?: (info: { sessionId: string; projectId: string }) => void;
  onTokenUpdate?: (tokens: number) => void;
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
}

/**
 * React hook for managing Claude Code streaming messages
 *
 * Handles real-time streaming of Claude Code messages with automatic
 * event listening, message parsing, and state management. Provides
 * functionality for loading historical messages and managing streaming state.
 *
 * @param options - Configuration options for message handling
 * @returns Object containing message state and management functions
 *
 * @example
 * ```tsx
 * function ClaudeSession() {
 *   const {
 *     messages,
 *     isStreaming,
 *     currentSessionId,
 *     clearMessages,
 *     loadMessages
 *   } = useClaudeMessages({
 *     onSessionInfo: (info) => setSessionInfo(info),
 *     onTokenUpdate: (tokens) => setTotalTokens(tokens),
 *     onStreamingChange: (streaming, sessionId) => {
 *       setIsStreaming(streaming);
 *       setActiveSession(sessionId);
 *     }
 *   });
 *
 *   return (
 *     <div>
 *       <div>Status: {isStreaming ? 'Streaming...' : 'Idle'}</div>
 *       <div>Session: {currentSessionId}</div>
 *       <div>Messages: {messages.length}</div>
 *       <button onClick={clearMessages}>Clear Messages</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useClaudeMessages(options: UseClaudeMessagesOptions = {}) {
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [rawJsonlOutput, setRawJsonlOutput] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const eventListenerRef = useRef<UnlistenFn | null>(null);
  const accumulatedContentRef = useRef<{ [key: string]: string }>({});

  const handleMessage = useCallback(
    (message: ClaudeStreamMessage) => {
      if ((message as Record<string, unknown>).type === "start") {
        // Clear accumulated content for new stream
        accumulatedContentRef.current = {};
        setIsStreaming(true);
        options.onStreamingChange?.(true, currentSessionId);
      } else if ((message as Record<string, unknown>).type === "partial") {
        const messageWithTools = message as { tool_calls?: Array<Record<string, unknown>> };
        if (messageWithTools.tool_calls && messageWithTools.tool_calls.length > 0) {
          messageWithTools.tool_calls.forEach((toolCall: Record<string, unknown>) => {
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
      } else if (
        (message as Record<string, unknown>).type === "response" &&
        message.message?.usage
      ) {
        const totalTokens =
          (message.message.usage.input_tokens || 0) + (message.message.usage.output_tokens || 0);
        options.onTokenUpdate?.(totalTokens);
      } else if (
        (message as Record<string, unknown>).type === "error" ||
        (message as Record<string, unknown>).type === "response"
      ) {
        setIsStreaming(false);
        options.onStreamingChange?.(false, currentSessionId);
      }

      setMessages((prev) => [...prev, message]);
      setRawJsonlOutput((prev) => [...prev, JSON.stringify(message)]);

      // Extract session info
      const msgObj = message as Record<string, unknown>;
      if (msgObj.type === "session_info" && msgObj.session_id && msgObj.project_id) {
        options.onSessionInfo?.({
          sessionId: msgObj.session_id as string,
          projectId: msgObj.project_id as string,
        });
        setCurrentSessionId(msgObj.session_id as string);
      }
    },
    [currentSessionId, options]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setRawJsonlOutput([]);
    accumulatedContentRef.current = {};
  }, []);

  const loadMessages = useCallback(async (sessionId: string, projectId?: string) => {
    try {
      let historyMessages: unknown[];
      
      if (projectId) {
        // Use the correct API function for loading session history with project ID
        historyMessages = await api.loadSessionHistory(sessionId, projectId);
      } else {
        // Fallback to agent session history if no project ID
        historyMessages = await api.loadAgentSessionHistory(sessionId);
      }
      
      const loadedMessages: ClaudeStreamMessage[] = [];
      const loadedRawJsonl: string[] = [];

      historyMessages.forEach((message) => {
        try {
          let parsedMessage: ClaudeStreamMessage;
          
          if (typeof message === 'object' && message !== null) {
            // Message is already parsed
            parsedMessage = message as ClaudeStreamMessage;
            loadedRawJsonl.push(JSON.stringify(message));
          } else if (typeof message === 'string') {
            // Message is a JSON string
            parsedMessage = JSON.parse(message) as ClaudeStreamMessage;
            loadedRawJsonl.push(message);
          } else {
            // Skip invalid message types
            return;
          }
          
          loadedMessages.push(parsedMessage);
        } catch (_e) {
          logger.error("Failed to parse session history message:", _e);
        }
      });

      setMessages(loadedMessages);
      setRawJsonlOutput(loadedRawJsonl);
    } catch (error) {
      logger.error("Failed to load session history:", error);
      throw error;
    }
  }, []);

  // Set up event listener
  useEffect(() => {
    const setupListener = async () => {
      if (eventListenerRef.current) {
        eventListenerRef.current();
      }

      eventListenerRef.current = await listen<string>("claude-stream", (event) => {
        try {
          const message = JSON.parse(event.payload) as ClaudeStreamMessage;
          handleMessage(message);
        } catch (error) {
          logger.error("Failed to parse Claude stream message:", error);
        }
      });
    };

    setupListener();

    return () => {
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
    handleMessage,
  };
}
