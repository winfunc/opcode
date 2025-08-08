import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api, type UsageStats, type ProjectUsage } from "@/lib/api";
import { 
  Calendar, 
  Filter,
  Loader2,
  Briefcase,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface UsageDashboardProps {
  /**
   * Callback when back button is clicked
   */
  onBack: () => void;
}

// Cache for storing fetched data
const dataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache - increased for better performance

/**
 * Optimized UsageDashboard component with caching and progressive loading
 */
export const UsageDashboard: React.FC<UsageDashboardProps> = ({ }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [sessionStats, setSessionStats] = useState<ProjectUsage[] | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<"all" | "7d" | "30d">("7d");
  const [activeTab, setActiveTab] = useState("overview");
  const [hasLoadedTabs, setHasLoadedTabs] = useState<Set<string>>(new Set(["overview"]));
  
  // Pagination states
  const [projectsPage, setProjectsPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Memoized formatters to prevent recreation on each render
  const formatCurrency = useMemo(() => (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }, []);

  const formatNumber = useMemo(() => (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  }, []);

  const formatTokens = useMemo(() => (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return formatNumber(num);
  }, [formatNumber]);

  const getModelDisplayName = useCallback((model: string): string => {
    const modelMap: Record<string, string> = {
      "claude-4-opus": "Opus 4",
      "claude-4-sonnet": "Sonnet 4",
      "claude-3.5-sonnet": "Sonnet 3.5",
      "claude-3-opus": "Opus 3",
    };
    return modelMap[model] || model;
  }, []);

  // Function to get cached data or null
  const getCachedData = useCallback((key: string) => {
    const cached = dataCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }, []);

  // Function to set cached data
  const setCachedData = useCallback((key: string, data: any) => {
    dataCache.set(key, { data, timestamp: Date.now() });
  }, []);

  const loadUsageStats = useCallback(async () => {
    const cacheKey = `usage-${selectedDateRange}`;
    
    // Check cache first
    const cachedStats = getCachedData(`${cacheKey}-stats`);
    const cachedSessions = getCachedData(`${cacheKey}-sessions`);
    
    if (cachedStats && cachedSessions) {
      setStats(cachedStats);
      setSessionStats(cachedSessions);
      setLoading(false);
      return;
    }

    try {
      // Don't show loading spinner if we have cached data for a different range
      if (!stats && !sessionStats) {
        setLoading(true);
      }
      setError(null);

      let statsData: UsageStats;
      let sessionData: ProjectUsage[] = [];
      
      if (selectedDateRange === "all") {
        // Fetch both in parallel for all time
        const [statsResult, sessionResult] = await Promise.all([
          api.getUsageStats(),
          api.getSessionStats()
        ]);
        statsData = statsResult;
        sessionData = sessionResult;
      } else {
        const endDate = new Date();
        const startDate = new Date();
        const days = selectedDateRange === "7d" ? 7 : 30;
        startDate.setDate(startDate.getDate() - days);
        
        const formatDateForApi = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}${month}${day}`;
        }

        // Fetch both in parallel for better performance
        const [statsResult, sessionResult] = await Promise.all([
          api.getUsageByDateRange(
            startDate.toISOString(),
            endDate.toISOString()
          ),
          api.getSessionStats(
            formatDateForApi(startDate),
            formatDateForApi(endDate),
            'desc'
          )
        ]);
        
        statsData = statsResult;
        sessionData = sessionResult;
      }
      
      // Update state
      setStats(statsData);
      setSessionStats(sessionData);
      
      // Cache the data
      setCachedData(`${cacheKey}-stats`, statsData);
      setCachedData(`${cacheKey}-sessions`, sessionData);
    } catch (err: any) {
      console.error("Failed to load usage stats:", err);
      setError("Failed to load usage statistics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedDateRange, getCachedData, setCachedData, stats, sessionStats]);

  // Load data on mount and when date range changes
  useEffect(() => {
    // Reset pagination when date range changes
    setProjectsPage(1);
    setSessionsPage(1);
    loadUsageStats();
  }, [loadUsageStats])

  // Preload adjacent tabs when idle
  useEffect(() => {
    if (!stats || loading) return;
    
    const tabOrder = ["overview", "models", "projects", "sessions", "timeline"];
    const currentIndex = tabOrder.indexOf(activeTab);
    
    // Use requestIdleCallback if available, otherwise setTimeout
    const schedulePreload = (callback: () => void) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout: 2000 });
      } else {
        setTimeout(callback, 100);
      }
    };
    
    // Preload adjacent tabs
    schedulePreload(() => {
      if (currentIndex > 0) {
        setHasLoadedTabs(prev => new Set([...prev, tabOrder[currentIndex - 1]]));
      }
      if (currentIndex < tabOrder.length - 1) {
        setHasLoadedTabs(prev => new Set([...prev, tabOrder[currentIndex + 1]]));
      }
    });
  }, [activeTab, stats, loading])

  // Memoize expensive computations
  const summaryCards = useMemo(() => {
    if (!stats) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 shimmer-hover">
          <div>
            <p className="text-caption text-muted-foreground">Total Cost</p>
            <p className="text-display-2 mt-1">
              {formatCurrency(stats.total_cost)}
            </p>
          </div>
        </Card>

        <Card className="p-4 shimmer-hover">
          <div>
            <p className="text-caption text-muted-foreground">Total Sessions</p>
            <p className="text-display-2 mt-1">
              {formatNumber(stats.total_sessions)}
            </p>
          </div>
        </Card>

        <Card className="p-4 shimmer-hover">
          <div>
            <p className="text-caption text-muted-foreground">Total Tokens</p>
            <p className="text-display-2 mt-1">
              {formatTokens(stats.total_tokens)}
            </p>
          </div>
        </Card>

        <Card className="p-4 shimmer-hover">
          <div>
            <p className="text-caption text-muted-foreground">Avg Cost/Session</p>
            <p className="text-display-2 mt-1">
              {formatCurrency(
                stats.total_sessions > 0 
                  ? stats.total_cost / stats.total_sessions 
                  : 0
              )}
            </p>
          </div>
        </Card>
      </div>
    );
  }, [stats, formatCurrency, formatNumber, formatTokens]);

  // Memoize the most used models section
  const mostUsedModels = useMemo(() => {
    if (!stats?.by_model) return null;
    
    return stats.by_model.slice(0, 3).map((model) => (
      <div key={model.model} className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-caption">
            {getModelDisplayName(model.model)}
          </Badge>
          <span className="text-caption text-muted-foreground">
            {model.session_count} sessions
          </span>
        </div>
        <span className="text-body-small font-medium">
          {formatCurrency(model.total_cost)}
        </span>
      </div>
    ));
  }, [stats, formatCurrency, getModelDisplayName]);

  // Memoize top projects section
  const topProjects = useMemo(() => {
    if (!stats?.by_project) return null;
    
    return stats.by_project.slice(0, 3).map((project) => (
      <div key={project.project_path} className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-body-small font-medium truncate max-w-[200px]" title={project.project_path}>
            {project.project_path}
          </span>
          <span className="text-caption text-muted-foreground">
            {project.session_count} sessions
          </span>
        </div>
        <span className="text-body-small font-medium">
          {formatCurrency(project.total_cost)}
        </span>
      </div>
    ));
  }, [stats, formatCurrency]);

  // Memoize timeline chart data
  const timelineChartData = useMemo(() => {
    if (!stats?.by_date || stats.by_date.length === 0) return null;
    
    const maxCost = Math.max(...stats.by_date.map(d => d.total_cost), 0);
    const halfMaxCost = maxCost / 2;
    const reversedData = stats.by_date.slice().reverse();
    
    return {
      maxCost,
      halfMaxCost,
      reversedData,
      bars: reversedData.map(day => ({
        ...day,
        heightPercent: maxCost > 0 ? (day.total_cost / maxCost) * 100 : 0,
        date: new Date(day.date.replace(/-/g, '/')),
      }))
    };
  }, [stats?.by_date]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-heading-1">Usage Dashboard</h1>
              <p className="mt-1 text-body-small text-muted-foreground">
                Track your Claude Code usage and costs
              </p>
            </div>
            {/* Date Range Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex space-x-1">
                {(["7d", "30d", "all"] as const).map((range) => (
                  <Button
                    key={range}
                    variant={selectedDateRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDateRange(range)}
                    disabled={loading}
                  >
                    {range === "all" ? "All Time" : range === "7d" ? "Last 7 Days" : "Last 30 Days"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 text-body-small text-destructive">
              {error}
              <Button onClick={() => loadUsageStats()} size="sm" className="ml-4">
                Try Again
              </Button>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              {summaryCards}

              {/* Tabs for different views */}
              <Tabs value={activeTab} onValueChange={(value) => {
                setActiveTab(value);
                setHasLoadedTabs(prev => new Set([...prev, value]));
              }} className="w-full">
                <TabsList className="grid grid-cols-5 w-full mb-6 h-auto p-1">
                  <TabsTrigger value="overview" className="py-2.5 px-3">Overview</TabsTrigger>
                  <TabsTrigger value="models" className="py-2.5 px-3">By Model</TabsTrigger>
                  <TabsTrigger value="projects" className="py-2.5 px-3">By Project</TabsTrigger>
                  <TabsTrigger value="sessions" className="py-2.5 px-3">By Session</TabsTrigger>
                  <TabsTrigger value="timeline" className="py-2.5 px-3">Timeline</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6 mt-6">
                  <Card className="p-6">
                    <h3 className="text-label mb-4">Token Breakdown</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-caption text-muted-foreground">Input Tokens</p>
                        <p className="text-heading-4">{formatTokens(stats.total_input_tokens)}</p>
                      </div>
                      <div>
                        <p className="text-caption text-muted-foreground">Output Tokens</p>
                        <p className="text-heading-4">{formatTokens(stats.total_output_tokens)}</p>
                      </div>
                      <div>
                        <p className="text-caption text-muted-foreground">Cache Write</p>
                        <p className="text-heading-4">{formatTokens(stats.total_cache_creation_tokens)}</p>
                      </div>
                      <div>
                        <p className="text-caption text-muted-foreground">Cache Read</p>
                        <p className="text-heading-4">{formatTokens(stats.total_cache_read_tokens)}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-6">
                      <h3 className="text-label mb-4">Most Used Models</h3>
                      <div className="space-y-3">
                        {mostUsedModels}
                      </div>
                    </Card>

                    <Card className="p-6">
                      <h3 className="text-label mb-4">Top Projects</h3>
                      <div className="space-y-3">
                        {topProjects}
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                {/* Models Tab - Lazy render and cache */}
                <TabsContent value="models" className="space-y-6 mt-6">
                  {hasLoadedTabs.has("models") && stats && (
                    <div style={{ display: activeTab === "models" ? "block" : "none" }}>
                      <Card className="p-6">
                        <h3 className="text-sm font-semibold mb-4">Usage by Model</h3>
                        <div className="space-y-4">
                          {stats.by_model.map((model) => (
                          <div key={model.model} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Badge 
                                  variant="outline" 
                                  className="text-xs"
                                >
                                  {getModelDisplayName(model.model)}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {model.session_count} sessions
                                </span>
                              </div>
                              <span className="text-sm font-semibold">
                                {formatCurrency(model.total_cost)}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Input: </span>
                                <span className="font-medium">{formatTokens(model.input_tokens)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Output: </span>
                                <span className="font-medium">{formatTokens(model.output_tokens)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Cache W: </span>
                                <span className="font-medium">{formatTokens(model.cache_creation_tokens)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Cache R: </span>
                                <span className="font-medium">{formatTokens(model.cache_read_tokens)}</span>
                              </div>
                            </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* Projects Tab - Lazy render and cache */}
                <TabsContent value="projects" className="space-y-6 mt-6">
                  {hasLoadedTabs.has("projects") && stats && (
                    <div style={{ display: activeTab === "projects" ? "block" : "none" }}>
                      <Card className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold">Usage by Project</h3>
                        <span className="text-xs text-muted-foreground">
                          {stats.by_project.length} total projects
                        </span>
                      </div>
                      <div className="space-y-3">
                        {(() => {
                          const startIndex = (projectsPage - 1) * ITEMS_PER_PAGE;
                          const endIndex = startIndex + ITEMS_PER_PAGE;
                          const paginatedProjects = stats.by_project.slice(startIndex, endIndex);
                          const totalPages = Math.ceil(stats.by_project.length / ITEMS_PER_PAGE);
                          
                          return (
                            <>
                              {paginatedProjects.map((project) => (
                                <div key={project.project_path} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                  <div className="flex flex-col truncate">
                                    <span className="text-sm font-medium truncate" title={project.project_path}>
                                      {project.project_path}
                                    </span>
                                    <div className="flex items-center space-x-3 mt-1">
                                      <span className="text-caption text-muted-foreground">
                                        {project.session_count} sessions
                                      </span>
                                      <span className="text-caption text-muted-foreground">
                                        {formatTokens(project.total_tokens)} tokens
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold">{formatCurrency(project.total_cost)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatCurrency(project.total_cost / project.session_count)}/session
                                    </p>
                                  </div>
                                </div>
                              ))}
                              
                              {/* Pagination Controls */}
                              {totalPages > 1 && (
                                <div className="flex items-center justify-between pt-4">
                                  <span className="text-xs text-muted-foreground">
                                    Showing {startIndex + 1}-{Math.min(endIndex, stats.by_project.length)} of {stats.by_project.length}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setProjectsPage(prev => Math.max(1, prev - 1))}
                                      disabled={projectsPage === 1}
                                    >
                                      <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm">
                                      Page {projectsPage} of {totalPages}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setProjectsPage(prev => Math.min(totalPages, prev + 1))}
                                      disabled={projectsPage === totalPages}
                                    >
                                      <ChevronRight className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                          })()}
                        </div>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* Sessions Tab - Lazy render and cache */}
                <TabsContent value="sessions" className="space-y-6 mt-6">
                  {hasLoadedTabs.has("sessions") && (
                    <div style={{ display: activeTab === "sessions" ? "block" : "none" }}>
                      <Card className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold">Usage by Session</h3>
                        {sessionStats && sessionStats.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {sessionStats.length} total sessions
                          </span>
                        )}
                      </div>
                      <div className="space-y-3">
                        {sessionStats && sessionStats.length > 0 ? (() => {
                          const startIndex = (sessionsPage - 1) * ITEMS_PER_PAGE;
                          const endIndex = startIndex + ITEMS_PER_PAGE;
                          const paginatedSessions = sessionStats.slice(startIndex, endIndex);
                          const totalPages = Math.ceil(sessionStats.length / ITEMS_PER_PAGE);
                          
                          return (
                            <>
                              {paginatedSessions.map((session, index) => (
                                <div key={`${session.project_path}-${session.project_name}-${startIndex + index}`} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                  <div className="flex flex-col">
                                    <div className="flex items-center space-x-2">
                                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]" title={session.project_path}>
                                        {session.project_path.split('/').slice(-2).join('/')}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium mt-1">
                                      {session.project_name}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold">{formatCurrency(session.total_cost)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {session.last_used ? new Date(session.last_used).toLocaleDateString() : 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              
                              {/* Pagination Controls */}
                              {totalPages > 1 && (
                                <div className="flex items-center justify-between pt-4">
                                  <span className="text-xs text-muted-foreground">
                                    Showing {startIndex + 1}-{Math.min(endIndex, sessionStats.length)} of {sessionStats.length}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSessionsPage(prev => Math.max(1, prev - 1))}
                                      disabled={sessionsPage === 1}
                                    >
                                      <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm">
                                      Page {sessionsPage} of {totalPages}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSessionsPage(prev => Math.min(totalPages, prev + 1))}
                                      disabled={sessionsPage === totalPages}
                                    >
                                      <ChevronRight className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })() : (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            No session data available for the selected period
                          </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* Timeline Tab - Lazy render and cache */}
                <TabsContent value="timeline" className="space-y-6 mt-6">
                  {hasLoadedTabs.has("timeline") && stats && (
                    <div style={{ display: activeTab === "timeline" ? "block" : "none" }}>
                      <Card className="p-6">
                      <h3 className="text-sm font-semibold mb-6 flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span>Daily Usage</span>
                      </h3>
                      {timelineChartData ? (
                        <div className="relative pl-8 pr-4">
                          {/* Y-axis labels */}
                          <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-muted-foreground">
                            <span>{formatCurrency(timelineChartData.maxCost)}</span>
                            <span>{formatCurrency(timelineChartData.halfMaxCost)}</span>
                            <span>{formatCurrency(0)}</span>
                          </div>
                          
                          {/* Chart container */}
                          <div className="flex items-end space-x-2 h-64 border-l border-b border-border pl-4">
                            {timelineChartData.bars.map((day) => {
                              const formattedDate = day.date.toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              });
                              
                              return (
                                <div key={day.date.toISOString()} className="flex-1 h-full flex flex-col items-center justify-end group relative">
                                  {/* Tooltip */}
                                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                    <div className="bg-background border border-border rounded-lg shadow-lg p-3 whitespace-nowrap">
                                      <p className="text-sm font-semibold">{formattedDate}</p>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        Cost: {formatCurrency(day.total_cost)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatTokens(day.total_tokens)} tokens
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {day.models_used.length} model{day.models_used.length !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                      <div className="border-4 border-transparent border-t-border"></div>
                                    </div>
                                  </div>
                                  
                                  {/* Bar */}
                                  <div 
                                    className="w-full bg-primary hover:opacity-80 transition-opacity rounded-t cursor-pointer"
                                    style={{ height: `${day.heightPercent}%` }}
                                  />
                                  
                                  {/* X-axis label – absolutely positioned below the bar */}
                                  <div
                                    className="absolute left-1/2 top-full mt-2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap pointer-events-none"
                                  >
                                    {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* X-axis label */}
                          <div className="mt-10 text-center text-xs text-muted-foreground">
                            Daily Usage Over Time
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          No usage data available for the selected period
                        </div>
                        )}
                      </Card>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};