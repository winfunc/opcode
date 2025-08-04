import { useCallback, useEffect, useRef } from 'react';
import { analytics, ANALYTICS_EVENTS, eventBuilders } from '@/lib/analytics';
import type { EventName } from '@/lib/analytics/types';

// Screen name mapping for tab types
const TAB_SCREEN_NAMES: Record<string, string> = {
  'chat': 'chat_session',
  'agent': 'agent_view',
  'projects': 'projects_list',
  'usage': 'usage_dashboard',
  'mcp': 'mcp_manager',
  'settings': 'settings',
  'claude-md': 'markdown_editor',
  'claude-file': 'file_editor',
  'agent-execution': 'agent_execution',
  'create-agent': 'create_agent',
  'import-agent': 'import_agent',
};

interface UseAnalyticsReturn {
  track: (eventName: EventName | string, properties?: Record<string, any>) => void;
  trackEvent: ReturnType<typeof useTrackEvent>;
  isEnabled: boolean;
  hasConsented: boolean;
}

export function useAnalytics(): UseAnalyticsReturn {
  const isEnabled = analytics.isEnabled();
  const hasConsented = analytics.hasConsented();
  
  const track = useCallback((eventName: EventName | string, properties?: Record<string, any>) => {
    analytics.track(eventName, properties);
  }, []);
  
  const trackEvent = useTrackEvent();
  
  return {
    track,
    trackEvent,
    isEnabled,
    hasConsented,
  };
}

export function useTrackEvent() {
  return {
    // Session events
    sessionCreated: (model: string, source?: string) => {
      const event = eventBuilders.session({ model, source });
      analytics.track(event.event, event.properties);
    },
    
    sessionCompleted: () => {
      analytics.track(ANALYTICS_EVENTS.SESSION_COMPLETED);
    },
    
    sessionResumed: (checkpointId: string) => {
      const event = eventBuilders.session({ resumed: true, checkpoint_id: checkpointId });
      analytics.track(ANALYTICS_EVENTS.SESSION_RESUMED, event.properties);
    },
    
    // Feature usage
    featureUsed: (feature: string, subfeature?: string, metadata?: Record<string, any>) => {
      const event = eventBuilders.feature(feature, subfeature, metadata);
      analytics.track(event.event, event.properties);
    },
    
    // Model selection
    modelSelected: (newModel: string, previousModel?: string, source?: string) => {
      const event = eventBuilders.model(newModel, previousModel, source);
      analytics.track(event.event, event.properties);
    },
    
    // Tab events
    tabCreated: (tabType: string) => {
      analytics.track(ANALYTICS_EVENTS.TAB_CREATED, { tab_type: tabType });
    },
    
    tabClosed: (tabType: string) => {
      analytics.track(ANALYTICS_EVENTS.TAB_CLOSED, { tab_type: tabType });
    },
    
    // File operations
    fileOpened: (fileType: string) => {
      analytics.track(ANALYTICS_EVENTS.FILE_OPENED, { file_type: fileType });
    },
    
    fileEdited: (fileType: string) => {
      analytics.track(ANALYTICS_EVENTS.FILE_EDITED, { file_type: fileType });
    },
    
    fileSaved: (fileType: string) => {
      analytics.track(ANALYTICS_EVENTS.FILE_SAVED, { file_type: fileType });
    },
    
    // Agent execution
    agentExecuted: (agentType: string, success: boolean, agentName?: string, durationMs?: number) => {
      const event = eventBuilders.agent(agentType, success, agentName, durationMs);
      analytics.track(event.event, event.properties);
    },
    
    // MCP events
    mcpServerConnected: (serverName: string, success: boolean, serverType?: string) => {
      const event = eventBuilders.mcp(serverName, success, serverType);
      analytics.track(event.event, event.properties);
    },
    
    mcpServerDisconnected: (serverName: string) => {
      analytics.track(ANALYTICS_EVENTS.MCP_SERVER_DISCONNECTED, { server_name: serverName });
    },
    
    // Slash commands
    slashCommandUsed: (command: string, success: boolean) => {
      const event = eventBuilders.slashCommand(command, success);
      analytics.track(event.event, event.properties);
    },
    
    // Settings
    settingsChanged: (setting: string, value: any) => {
      analytics.track(ANALYTICS_EVENTS.SETTINGS_CHANGED, { setting, value });
    },
    
    // Errors
    errorOccurred: (errorType: string, errorCode?: string, context?: string) => {
      const event = eventBuilders.error(errorType, errorCode, context);
      analytics.track(event.event, event.properties);
    },
    
    // Performance
    performanceMetrics: (metrics: Record<string, number>) => {
      const event = eventBuilders.performance(metrics);
      analytics.track(event.event, event.properties);
    },
    
    // Claude Code Session events
    promptSubmitted: (props: Parameters<typeof eventBuilders.promptSubmitted>[0]) => {
      const event = eventBuilders.promptSubmitted(props);
      analytics.track(event.event, event.properties);
    },
    
    sessionStopped: (props: Parameters<typeof eventBuilders.sessionStopped>[0]) => {
      const event = eventBuilders.sessionStopped(props);
      analytics.track(event.event, event.properties);
    },
    
    enhancedSessionStopped: (props: Parameters<typeof eventBuilders.enhancedSessionStopped>[0]) => {
      const event = eventBuilders.enhancedSessionStopped(props);
      analytics.track(event.event, event.properties);
    },
    
    checkpointCreated: (props: Parameters<typeof eventBuilders.checkpointCreated>[0]) => {
      const event = eventBuilders.checkpointCreated(props);
      analytics.track(event.event, event.properties);
    },
    
    checkpointRestored: (props: Parameters<typeof eventBuilders.checkpointRestored>[0]) => {
      const event = eventBuilders.checkpointRestored(props);
      analytics.track(event.event, event.properties);
    },
    
    toolExecuted: (props: Parameters<typeof eventBuilders.toolExecuted>[0]) => {
      const event = eventBuilders.toolExecuted(props);
      analytics.track(event.event, event.properties);
    },
    
    // Enhanced Agent events
    agentStarted: (props: Parameters<typeof eventBuilders.agentStarted>[0]) => {
      const event = eventBuilders.agentStarted(props);
      analytics.track(event.event, event.properties);
    },
    
    agentProgress: (props: Parameters<typeof eventBuilders.agentProgress>[0]) => {
      const event = eventBuilders.agentProgress(props);
      analytics.track(event.event, event.properties);
    },
    
    agentError: (props: Parameters<typeof eventBuilders.agentError>[0]) => {
      const event = eventBuilders.agentError(props);
      analytics.track(event.event, event.properties);
    },
    
    // MCP events
    mcpServerAdded: (props: Parameters<typeof eventBuilders.mcpServerAdded>[0]) => {
      const event = eventBuilders.mcpServerAdded(props);
      analytics.track(event.event, event.properties);
    },
    
    mcpServerRemoved: (props: Parameters<typeof eventBuilders.mcpServerRemoved>[0]) => {
      const event = eventBuilders.mcpServerRemoved(props);
      analytics.track(event.event, event.properties);
    },
    
    mcpToolInvoked: (props: Parameters<typeof eventBuilders.mcpToolInvoked>[0]) => {
      const event = eventBuilders.mcpToolInvoked(props);
      analytics.track(event.event, event.properties);
    },
    
    mcpConnectionError: (props: Parameters<typeof eventBuilders.mcpConnectionError>[0]) => {
      const event = eventBuilders.mcpConnectionError(props);
      analytics.track(event.event, event.properties);
    },
    
    // Slash Command events
    slashCommandSelected: (props: Parameters<typeof eventBuilders.slashCommandSelected>[0]) => {
      const event = eventBuilders.slashCommandSelected(props);
      analytics.track(event.event, event.properties);
    },
    
    slashCommandExecuted: (props: Parameters<typeof eventBuilders.slashCommandExecuted>[0]) => {
      const event = eventBuilders.slashCommandExecuted(props);
      analytics.track(event.event, event.properties);
    },
    
    slashCommandCreated: (props: Parameters<typeof eventBuilders.slashCommandCreated>[0]) => {
      const event = eventBuilders.slashCommandCreated(props);
      analytics.track(event.event, event.properties);
    },
    
    // Error and Performance events
    apiError: (props: Parameters<typeof eventBuilders.apiError>[0]) => {
      const event = eventBuilders.apiError(props);
      analytics.track(event.event, event.properties);
    },
    
    uiError: (props: Parameters<typeof eventBuilders.uiError>[0]) => {
      const event = eventBuilders.uiError(props);
      analytics.track(event.event, event.properties);
    },
    
    performanceBottleneck: (props: Parameters<typeof eventBuilders.performanceBottleneck>[0]) => {
      const event = eventBuilders.performanceBottleneck(props);
      analytics.track(event.event, event.properties);
    },
    
    memoryWarning: (props: Parameters<typeof eventBuilders.memoryWarning>[0]) => {
      const event = eventBuilders.memoryWarning(props);
      analytics.track(event.event, event.properties);
    },
    
    // User journey events
    journeyMilestone: (props: Parameters<typeof eventBuilders.journeyMilestone>[0]) => {
      const event = eventBuilders.journeyMilestone(props);
      analytics.track(event.event, event.properties);
    },
    
    // Enhanced tracking methods
    enhancedPromptSubmitted: (props: Parameters<typeof eventBuilders.enhancedPromptSubmitted>[0]) => {
      const event = eventBuilders.enhancedPromptSubmitted(props);
      analytics.track(event.event, event.properties);
    },
    
    enhancedToolExecuted: (props: Parameters<typeof eventBuilders.enhancedToolExecuted>[0]) => {
      const event = eventBuilders.enhancedToolExecuted(props);
      analytics.track(event.event, event.properties);
    },
    
    enhancedError: (props: Parameters<typeof eventBuilders.enhancedError>[0]) => {
      const event = eventBuilders.enhancedError(props);
      analytics.track(event.event, event.properties);
    },
    
    // Session engagement
    sessionEngagement: (props: Parameters<typeof eventBuilders.sessionEngagement>[0]) => {
      const event = eventBuilders.sessionEngagement(props);
      analytics.track(event.event, event.properties);
    },
    
    // Feature discovery and adoption
    featureDiscovered: (props: Parameters<typeof eventBuilders.featureDiscovered>[0]) => {
      const event = eventBuilders.featureDiscovered(props);
      analytics.track(event.event, event.properties);
    },
    
    featureAdopted: (props: Parameters<typeof eventBuilders.featureAdopted>[0]) => {
      const event = eventBuilders.featureAdopted(props);
      analytics.track(event.event, event.properties);
    },
    
    featureCombination: (props: Parameters<typeof eventBuilders.featureCombination>[0]) => {
      const event = eventBuilders.featureCombination(props);
      analytics.track(event.event, event.properties);
    },
    
    // Quality metrics
    outputRegenerated: (props: Parameters<typeof eventBuilders.outputRegenerated>[0]) => {
      const event = eventBuilders.outputRegenerated(props);
      analytics.track(event.event, event.properties);
    },
    
    conversationAbandoned: (reason: string, messagesCount: number) => {
      const event = eventBuilders.conversationAbandoned(reason, messagesCount);
      analytics.track(event.event, event.properties);
    },
    
    suggestionAccepted: (props: Parameters<typeof eventBuilders.suggestionAccepted>[0]) => {
      const event = eventBuilders.suggestionAccepted(props);
      analytics.track(event.event, event.properties);
    },
    
    suggestionRejected: (props: Parameters<typeof eventBuilders.suggestionRejected>[0]) => {
      const event = eventBuilders.suggestionRejected(props);
      analytics.track(event.event, event.properties);
    },
    
    // AI interactions
    aiInteraction: (props: Parameters<typeof eventBuilders.aiInteraction>[0]) => {
      const event = eventBuilders.aiInteraction(props);
      analytics.track(event.event, event.properties);
    },
    
    promptPattern: (props: Parameters<typeof eventBuilders.promptPattern>[0]) => {
      const event = eventBuilders.promptPattern(props);
      analytics.track(event.event, event.properties);
    },
    
    // Workflow tracking
    workflowStarted: (props: Parameters<typeof eventBuilders.workflowStarted>[0]) => {
      const event = eventBuilders.workflowStarted(props);
      analytics.track(event.event, event.properties);
    },
    
    workflowCompleted: (props: Parameters<typeof eventBuilders.workflowCompleted>[0]) => {
      const event = eventBuilders.workflowCompleted(props);
      analytics.track(event.event, event.properties);
    },
    
    workflowAbandoned: (props: Parameters<typeof eventBuilders.workflowAbandoned>[0]) => {
      const event = eventBuilders.workflowAbandoned(props);
      analytics.track(event.event, event.properties);
    },
    
    // Network performance
    networkPerformance: (props: Parameters<typeof eventBuilders.networkPerformance>[0]) => {
      const event = eventBuilders.networkPerformance(props);
      analytics.track(event.event, event.properties);
    },
    
    networkFailure: (props: Parameters<typeof eventBuilders.networkFailure>[0]) => {
      const event = eventBuilders.networkFailure(props);
      analytics.track(event.event, event.properties);
    },
    
    // Resource usage (direct methods)
    resourceUsageHigh: (props: Parameters<typeof eventBuilders.resourceUsageHigh>[0]) => {
      const event = eventBuilders.resourceUsageHigh(props);
      analytics.track(event.event, event.properties);
    },
    
    resourceUsageSampled: (props: Parameters<typeof eventBuilders.resourceUsageSampled>[0]) => {
      const event = eventBuilders.resourceUsageSampled(props);
      analytics.track(event.event, event.properties);
    },
  };
}

export function usePageView(pageName: string, properties?: Record<string, any>) {
  const hasTracked = useRef(false);
  
  useEffect(() => {
    if (!hasTracked.current && analytics.isEnabled()) {
      analytics.track('$pageview', {
        page_name: pageName,
        ...properties,
      });
      hasTracked.current = true;
    }
  }, [pageName, properties]);
}

export function useAppLifecycle() {
  useEffect(() => {
    // Track app start
    analytics.track(ANALYTICS_EVENTS.APP_STARTED);
    
    // Track app close
    const handleUnload = () => {
      analytics.track(ANALYTICS_EVENTS.APP_CLOSED);
      analytics.shutdown();
    };
    
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);
}

// Hook for tracking component-specific metrics
export function useComponentMetrics(componentName: string) {
  const mountTime = useRef(Date.now());
  const renderCount = useRef(0);
  
  useEffect(() => {
    renderCount.current += 1;
  });
  
  useEffect(() => {
    return () => {
      // Track component unmount metrics
      const lifetime = Date.now() - mountTime.current;
      analytics.track('component_metrics', {
        component: componentName,
        lifetime_ms: lifetime,
        render_count: renderCount.current,
      });
    };
  }, [componentName]);
}

// Hook for tracking user interactions
export function useInteractionTracking(interactionType: string) {
  return useCallback((details?: Record<string, any>) => {
    analytics.track('user_interaction', {
      interaction_type: interactionType,
      ...details,
    });
  }, [interactionType]);
}

// Hook for tracking screen changes
export function useScreenTracking(tabType?: string, tabId?: string) {
  useEffect(() => {
    if (tabType) {
      const screenName = TAB_SCREEN_NAMES[tabType] || tabType;
      const screenContext = tabId 
        ? `${screenName}/${tabId.substring(0, 8)}` 
        : screenName;
      
      analytics.setScreen(screenContext);
    }
  }, [tabType, tabId]);
}

// Export screen names for external use
export { TAB_SCREEN_NAMES };

// Hook for tracking feature experiments
export function useFeatureExperiment(featureName: string, variant: string) {
  // const trackEvent = useTrackEvent();
  
  useEffect(() => {
    analytics.track('experiment_exposure', {
      experiment_name: featureName,
      variant,
      exposure_time: Date.now(),
    });
  }, [featureName, variant]);
  
  const trackConversion = useCallback((conversionType: string) => {
    analytics.track('experiment_conversion', {
      experiment_name: featureName,
      variant,
      conversion_type: conversionType,
    });
  }, [featureName, variant]);
  
  return { trackConversion };
}

// Hook for tracking user paths/navigation
export function usePathTracking(pathname: string) {
  const previousPath = useRef<string>('');
  
  useEffect(() => {
    if (previousPath.current && previousPath.current !== pathname) {
      analytics.track('path_transition', {
        from: previousPath.current,
        to: pathname,
        transition_type: 'navigation',
      });
    }
    previousPath.current = pathname;
  }, [pathname]);
}

// Hook for tracking feature adoption
export function useFeatureAdoptionTracking(featureName: string) {
  const startTime = useRef<number>(Date.now());
  const usageCount = useRef<number>(0);
  const trackEvent = useTrackEvent();
  
  const trackUsage = useCallback(() => {
    usageCount.current += 1;
    
    // Track discovery on first use
    if (usageCount.current === 1) {
      trackEvent.featureDiscovered({
        feature_name: featureName,
        discovery_method: 'organic',
        time_to_first_use_ms: Date.now() - startTime.current,
        initial_success: true,
      });
    }
    
    // Track adoption after 5 uses
    if (usageCount.current === 5) {
      const daysSinceFirst = (Date.now() - startTime.current) / (1000 * 60 * 60 * 24);
      trackEvent.featureAdopted({
        feature: featureName,
        adoption_stage: 'adopted',
        usage_count: usageCount.current,
        days_since_first_use: daysSinceFirst,
        usage_trend: 'increasing',
      });
    }
  }, [featureName, trackEvent]);
  
  return { trackUsage, usageCount: usageCount.current };
}

// Hook for tracking workflow completion
export function useWorkflowTracking(workflowType: string) {
  const startTime = useRef<number | null>(null);
  const stepsCompleted = useRef<number>(0);
  const toolsUsed = useRef<Set<string>>(new Set());
  const interruptions = useRef<number>(0);
  const trackEvent = useTrackEvent();
  
  const startWorkflow = useCallback((totalSteps: number) => {
    startTime.current = Date.now();
    stepsCompleted.current = 0;
    toolsUsed.current.clear();
    interruptions.current = 0;
    
    trackEvent.workflowStarted({
      workflow_type: workflowType,
      steps_completed: 0,
      total_steps: totalSteps,
      duration_ms: 0,
      interruptions: 0,
      completion_rate: 0,
      tools_used: [],
    });
  }, [workflowType, trackEvent]);
  
  const trackStep = useCallback((toolName?: string) => {
    stepsCompleted.current += 1;
    if (toolName) {
      toolsUsed.current.add(toolName);
    }
  }, []);
  
  const trackInterruption = useCallback(() => {
    interruptions.current += 1;
  }, []);
  
  const completeWorkflow = useCallback((totalSteps: number, success: boolean = true) => {
    if (!startTime.current) return;
    
    const duration = Date.now() - startTime.current;
    const completionRate = stepsCompleted.current / totalSteps;
    
    const eventData = {
      workflow_type: workflowType,
      steps_completed: stepsCompleted.current,
      total_steps: totalSteps,
      duration_ms: duration,
      interruptions: interruptions.current,
      completion_rate: completionRate,
      tools_used: Array.from(toolsUsed.current),
    };
    
    if (success) {
      trackEvent.workflowCompleted(eventData);
    } else {
      trackEvent.workflowAbandoned(eventData);
    }
    
    // Reset
    startTime.current = null;
  }, [workflowType, trackEvent]);
  
  return {
    startWorkflow,
    trackStep,
    trackInterruption,
    completeWorkflow,
  };
}

// Hook for tracking AI interaction quality
export function useAIInteractionTracking(model: string) {
  const interactionStart = useRef<number | null>(null);
  const contextSwitches = useRef<number>(0);
  const clarificationRequests = useRef<number>(0);
  const trackEvent = useTrackEvent();
  
  const startInteraction = useCallback(() => {
    interactionStart.current = Date.now();
    contextSwitches.current = 0;
    clarificationRequests.current = 0;
  }, []);
  
  const trackContextSwitch = useCallback(() => {
    contextSwitches.current += 1;
  }, []);
  
  const trackClarificationRequest = useCallback(() => {
    clarificationRequests.current += 1;
  }, []);
  
  const completeInteraction = useCallback((
    requestTokens: number,
    responseTokens: number,
    qualityScore?: number
  ) => {
    if (!interactionStart.current) return;
    
    trackEvent.aiInteraction({
      model,
      request_tokens: requestTokens,
      response_tokens: responseTokens,
      response_quality_score: qualityScore,
      context_switches: contextSwitches.current,
      clarification_requests: clarificationRequests.current,
    });
    
    // Reset
    interactionStart.current = null;
  }, [model, trackEvent]);
  
  return {
    startInteraction,
    trackContextSwitch,
    trackClarificationRequest,
    completeInteraction,
  };
}

// Hook for tracking network performance
export function useNetworkPerformanceTracking() {
  const trackEvent = useTrackEvent();
  
  const trackRequest = useCallback((
    _endpoint: string,
    endpointType: 'mcp' | 'api' | 'webhook',
    latency: number,
    payloadSize: number,
    success: boolean,
    retryCount: number = 0
  ) => {
    const connectionQuality: 'excellent' | 'good' | 'poor' = 
      latency < 100 ? 'excellent' :
      latency < 500 ? 'good' : 'poor';
    
    const eventData = {
      endpoint_type: endpointType,
      latency_ms: latency,
      payload_size_bytes: payloadSize,
      connection_quality: connectionQuality,
      retry_count: retryCount,
      circuit_breaker_triggered: false,
    };
    
    if (success) {
      trackEvent.networkPerformance(eventData);
    } else {
      trackEvent.networkFailure(eventData);
    }
  }, [trackEvent]);
  
  return { trackRequest };
}
