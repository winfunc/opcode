import React, { useState, useCallback, useEffect } from "react";
import { api } from "./api";
import { logger } from "@/lib/logger";

import { handleError } from "@/lib/errorHandler";
import {
  ClaudeStreamMessage,
  CachedSessionOutput,
  OutputCacheContextType,
} from "./outputCacheUtils";
import { OutputCacheContext } from "./outputCacheHook";

/**
 * Props for the OutputCacheProvider component
 */
interface OutputCacheProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component for output caching functionality
 *
 * Manages caching of session outputs with automatic polling for running sessions.
 * Provides context for components to access cached output data and manage cache state.
 * Includes background polling to keep running session data up-to-date.
 *
 * @param children - Child components that will have access to the output cache context
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <OutputCacheProvider>
 *       <SessionViewer />
 *       <AgentRunner />
 *     </OutputCacheProvider>
 *   );
 * }
 * ```
 */
export function OutputCacheProvider({ children }: OutputCacheProviderProps) {
  const [cache, setCache] = useState<Map<number, CachedSessionOutput>>(new Map());
  const [isPolling, setIsPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(
    null
  );

  const getCachedOutput = useCallback(
    (sessionId: number): CachedSessionOutput | null => {
      return cache.get(sessionId) || null;
    },
    [cache]
  );

  const setCachedOutput = useCallback((sessionId: number, data: CachedSessionOutput) => {
    setCache((prev) => new Map(prev.set(sessionId, data)));
  }, []);

  const updateSessionStatus = useCallback((sessionId: number, status: string) => {
    setCache((prev) => {
      const existing = prev.get(sessionId);
      if (existing) {
        const updated = new Map(prev);
        updated.set(sessionId, { ...existing, status });
        return updated;
      }
      return prev;
    });
  }, []);

  const clearCache = useCallback((sessionId?: number) => {
    if (sessionId) {
      setCache((prev) => {
        const updated = new Map(prev);
        updated.delete(sessionId);
        return updated;
      });
    } else {
      setCache(new Map());
    }
  }, []);

  const parseOutput = useCallback(async (rawOutput: string): Promise<ClaudeStreamMessage[]> => {
    if (!rawOutput) return [];

    const lines = rawOutput.split("\n").filter((line) => line.trim());
    const parsedMessages: ClaudeStreamMessage[] = [];

    for (const line of lines) {
      try {
        const message = JSON.parse(line) as ClaudeStreamMessage;
        parsedMessages.push(message);
      } catch (err) {
        await handleError("Failed to parse message:", { context: err, line });
        // Add a fallback message for unparseable content
        parsedMessages.push({
          type: "result",
          subtype: "error",
          error: "Failed to parse message",
          raw_content: line,
        });
      }
    }

    return parsedMessages;
  }, []);

  const updateSessionCache = useCallback(
    async (sessionId: number, status: string) => {
      try {
        const rawOutput = await api.getSessionOutput(sessionId);

        // 使用 Promise.resolve 包装以避免阻塞
        const messages = await Promise.resolve(parseOutput(rawOutput));

        setCachedOutput(sessionId, {
          output: rawOutput,
          messages,
          lastUpdated: Date.now(),
          status,
        });
      } catch (error) {
        logger.warn(`Failed to update cache for session ${sessionId}:`, error);
      }
    },
    [parseOutput, setCachedOutput]
  );

  const pollRunningSessions = useCallback(async () => {
    try {
      const runningSessions = await api.listRunningAgentSessions();

      // Update cache for all running sessions
      for (const session of runningSessions) {
        if (session.id && session.status === "running") {
          await updateSessionCache(session.id, session.status);
        }
      }

      // Clean up cache for sessions that are no longer running
      const runningIds = new Set(runningSessions.map((s) => s.id).filter(Boolean));
      setCache((prev) => {
        const updated = new Map();
        for (const [sessionId, data] of prev) {
          if (runningIds.has(sessionId) || data.status !== "running") {
            updated.set(sessionId, data);
          }
        }
        return updated;
      });
    } catch (error) {
      logger.warn("Failed to poll running sessions:", error);
    }
  }, [updateSessionCache]);

  const startBackgroundPolling = useCallback(() => {
    if (pollingInterval) return;

    setIsPolling(true);
    const interval = setInterval(pollRunningSessions, 3000); // Poll every 3 seconds
    setPollingInterval(interval);
  }, [pollingInterval, pollRunningSessions]);

  const stopBackgroundPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setIsPolling(false);
  }, [pollingInterval]);

  // Auto-start polling when provider mounts
  useEffect(() => {
    startBackgroundPolling();
    return () => stopBackgroundPolling();
  }, [startBackgroundPolling, stopBackgroundPolling]);

  const value: OutputCacheContextType = {
    getCachedOutput,
    setCachedOutput,
    updateSessionStatus,
    clearCache,
    isPolling,
    startBackgroundPolling,
    stopBackgroundPolling,
  };

  return <OutputCacheContext.Provider value={value}>{children}</OutputCacheContext.Provider>;
}
