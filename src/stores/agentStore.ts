import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { api } from '@/lib/api';
import type { AgentRunWithMetrics } from '@/lib/api';

interface AgentState {
  // Agent runs data
  agentRuns: AgentRunWithMetrics[];
  runningAgents: Set<string>;
  sessionOutputs: Record<string, string>;
  
  // UI state
  isLoadingRuns: boolean;
  isLoadingOutput: boolean;
  error: string | null;
  lastFetchTime: number;
  
  // Actions
  fetchAgentRuns: (forceRefresh?: boolean) => Promise<void>;
  fetchSessionOutput: (runId: number) => Promise<void>;
  createAgentRun: (data: { agentId: number; projectPath: string; task: string; model?: string }) => Promise<AgentRunWithMetrics>;
  cancelAgentRun: (runId: number) => Promise<void>;
  deleteAgentRun: (runId: number) => Promise<void>;
  clearError: () => void;
  
  // Real-time updates
  handleAgentRunUpdate: (run: AgentRunWithMetrics) => void;
  
  // Polling management
  startPolling: (interval?: number) => void;
  stopPolling: () => void;
  pollingInterval: NodeJS.Timeout | null;
}

export const useAgentStore = create<AgentState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    agentRuns: [],
    runningAgents: new Set(),
    sessionOutputs: {},
    isLoadingRuns: false,
    isLoadingOutput: false,
    error: null,
    lastFetchTime: 0,
    pollingInterval: null,
    
    // Fetch agent runs with caching
    fetchAgentRuns: async (forceRefresh = false) => {
      const now = Date.now();
      const { lastFetchTime } = get();
      
      // Cache for 5 seconds unless forced
      if (!forceRefresh && now - lastFetchTime < 5000) {
        return;
      }
      
      set({ isLoadingRuns: true, error: null });
      
      try {
        const runs = await api.listAgentRuns();
        const runningIds = runs
          .filter(r => r.status === 'running' || r.status === 'pending')
          .map(r => r.id?.toString() || '')
          .filter(Boolean);
        
        set({
          agentRuns: runs,
          runningAgents: new Set(runningIds),
          isLoadingRuns: false,
          lastFetchTime: now
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch agent runs',
          isLoadingRuns: false
        });
      }
    },
    
    // Fetch session output for a specific run
    fetchSessionOutput: async (runId: number) => {
      set({ isLoadingOutput: true, error: null });
      
      try {
        const output = await api.getAgentRunWithRealTimeMetrics(runId).then(run => run.output || '');
        set(state => ({
          sessionOutputs: {
            ...state.sessionOutputs,
            [runId]: output
          },
          isLoadingOutput: false
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch session output',
          isLoadingOutput: false
        });
      }
    },
    
    // Create a new agent run
    createAgentRun: async (data: { agentId: number; projectPath: string; task: string; model?: string }) => {
      try {
        const runId = await api.executeAgent(data.agentId, data.projectPath, data.task, data.model);
        
        // Fetch the created run details
        const run = await api.getAgentRun(runId);
        
        // Update local state immediately
        set(state => ({
          agentRuns: [run, ...state.agentRuns],
          runningAgents: new Set([...state.runningAgents, runId.toString()])
        }));
        
        return run;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to create agent run'
        });
        throw error;
      }
    },
    
    // Cancel an agent run
    cancelAgentRun: async (runId: number) => {
      try {
        await api.killAgentSession(runId);
        
        // Update local state
        set(state => ({
          agentRuns: state.agentRuns.map(r =>
            r.id === runId ? { ...r, status: 'cancelled' } : r
          ),
          runningAgents: new Set(
            [...state.runningAgents].filter(id => id !== runId.toString())
          )
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to cancel agent run'
        });
        throw error;
      }
    },
    
    // Delete an agent run
    deleteAgentRun: async (runId: number) => {
      try {
        // First ensure the run is cancelled if it's still running
        const run = get().agentRuns.find(r => r.id === runId);
        if (run && (run.status === 'running' || run.status === 'pending')) {
          await api.killAgentSession(runId);
        }
        
        // Note: There's no deleteAgentRun API method, so we just remove from local state
        // The run will remain in the database but won't be shown in the UI
        
        // Update local state
        set(state => ({
          agentRuns: state.agentRuns.filter(r => r.id !== runId),
          runningAgents: new Set(
            [...state.runningAgents].filter(id => id !== runId.toString())
          ),
          sessionOutputs: Object.fromEntries(
            Object.entries(state.sessionOutputs).filter(([id]) => id !== runId.toString())
          )
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to delete agent run'
        });
        throw error;
      }
    },
    
    // Clear error
    clearError: () => set({ error: null }),
    
    // Handle real-time agent run updates
    handleAgentRunUpdate: (run: AgentRunWithMetrics) => {
      set(state => {
        const existingIndex = state.agentRuns.findIndex(r => r.id === run.id);
        const updatedRuns = [...state.agentRuns];
        
        if (existingIndex >= 0) {
          updatedRuns[existingIndex] = run;
        } else {
          updatedRuns.unshift(run);
        }
        
        const runningIds = updatedRuns
          .filter(r => r.status === 'running' || r.status === 'pending')
          .map(r => r.id?.toString() || '')
          .filter(Boolean);
        
        return {
          agentRuns: updatedRuns,
          runningAgents: new Set(runningIds)
        };
      });
    },
    
    // Start polling for updates
    startPolling: (interval = 3000) => {
      const { pollingInterval, stopPolling } = get();
      
      // Clear existing interval
      if (pollingInterval) {
        stopPolling();
      }
      
      // Start new interval
      const newInterval = setInterval(() => {
        const { runningAgents } = get();
        if (runningAgents.size > 0) {
          get().fetchAgentRuns();
        }
      }, interval);
      
      set({ pollingInterval: newInterval });
    },
    
    // Stop polling
    stopPolling: () => {
      const { pollingInterval } = get();
      if (pollingInterval) {
        clearInterval(pollingInterval);
        set({ pollingInterval: null });
      }
    }
  }))
);