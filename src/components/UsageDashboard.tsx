// oxlint-disable no-unused-vars
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, type UsageStats, type ProjectUsage, type UsageProgress } from "@/lib/api";
import { 
  ArrowLeft, 
  TrendingUp, 
  Calendar, 
  Filter,
  DollarSign,
  Activity,
  FileText,
  Briefcase,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageDashboardProps {
  onBack: () => void;
}

export const UsageDashboard: React.FC<UsageDashboardProps> = ({ onBack }) => {
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [sessionStats, setSessionStats] = useState<ProjectUsage[] | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<"all" | "7d" | "30d">("all");
  
  // Progressive loading state
  const [isProgressiveLoading, setIsProgressiveLoading] = useState(false);
  const [progress, setProgress] = useState<UsageProgress | null>(null);

  // Load cached data first, then start progressive loading if needed
  const loadUsageStats = useCallback(async () => {
    try {
      setError(null);
      setIsProgressiveLoading(true);
      
      // Try to get cached data first for immediate display
      const cacheKey = selectedDateRange === "all" ? "default" : selectedDateRange;
      try {
        const cachedStats = await api.getCachedUsageStats(cacheKey);
        if (cachedStats.total_sessions > 0) {
          setStats(cachedStats);
          setIsProgressiveLoading(false);
          
          // Load session stats in background
          const loadSessionStats = async () => {
            try {
              if (selectedDateRange === "all") {
                const sessionData = await api.getSessionStats();
                setSessionStats(sessionData);
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
                };

                const sessionData = await api.getSessionStats(
                  formatDateForApi(startDate),
                  formatDateForApi(endDate),
                  'desc'
                );
                setSessionStats(sessionData);
              }
            } catch (sessionError) {
              console.warn("Failed to load session stats:", sessionError);
            }
          };
          
          loadSessionStats();
          return; // We have cached data, no need to load progressively
        }
      } catch (_cacheError) {
        console.log("No cached data available, starting progressive load");
      }

      // No cached data or empty cache, start progressive loading
      const initialProgress = await api.getUsageStatsProgressive();
      setProgress(initialProgress);

      // If no files to process, show empty state
      if (initialProgress.total_files === 0) {
        setStats({
          total_cost: 0.0,
          total_tokens: 0,
          total_input_tokens: 0,
          total_output_tokens: 0,
          total_cache_creation_tokens: 0,
          total_cache_read_tokens: 0,
          total_sessions: 0,
          by_model: [],
          by_date: [],
          by_project: [],
        });
        setIsProgressiveLoading(false);
        setProgress(null);
        return;
      }

      // Process files in batches with better progress tracking
      let currentProgress = initialProgress;
      while (currentProgress.stage !== "complete" && currentProgress.percentage < 100) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Faster updates
        currentProgress = await api.processUsageBatch(20); // Larger batches for speed
        setProgress(currentProgress);
      }

      // Ensure we show 100% before finishing
      if (currentProgress.percentage >= 100) {
        setProgress({ ...currentProgress, percentage: 100, stage: "complete" });
        await new Promise(resolve => setTimeout(resolve, 200)); // Brief pause to show completion
      }

      // Get the final stats
      const finalStats = await api.getCachedUsageStats(cacheKey);
      setStats(finalStats);

      // Load session stats
      try {
        if (selectedDateRange === "all") {
          const sessionData = await api.getSessionStats();
          setSessionStats(sessionData);
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
          };

          const sessionData = await api.getSessionStats(
            formatDateForApi(startDate),
            formatDateForApi(endDate),
            'desc'
          );
          setSessionStats(sessionData);
        }
      } catch (sessionError) {
        console.warn("Failed to load session stats:", sessionError);
      }

    } catch (err) {
      console.error("Failed to load usage stats:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      
      // Check if it's a "no data" scenario vs actual error
      if (errorMessage.includes("Failed to get home directory") || 
          errorMessage.includes("No such file or directory")) {
        setError("No Claude Code usage data found. Start using Claude Code to see your usage statistics here.");
      } else {
        setError(`Failed to load usage statistics: ${errorMessage}`);
      }
    } finally {
      setIsProgressiveLoading(false);
      setProgress(null);
    }
  }, [selectedDateRange]);

  useEffect(() => {
    loadUsageStats();
  }, [loadUsageStats]);

  const handleRefresh = async () => {
    // Clear cache and reload
    try {
      await api.clearUsageCache();
      await loadUsageStats();
    } catch (err) {
      console.error("Failed to refresh:", err);
      setError("Failed to refresh data. Please try again.");
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatTokens = (num: number): string => {
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)}B`;
    } else if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return formatNumber(num);
  };

  const getModelDisplayName = (model: string): string => {
    const modelMap: Record<string, string> = {
      "claude-4-opus": "Opus 4",
      "claude-4-sonnet": "Sonnet 4",
      "claude-3.5-sonnet": "Sonnet 3.5",
      "claude-3-opus": "Opus 3",
    };
    return modelMap[model] || model;
  };

  const getModelColor = (model: string): string => {
    if (model.includes("opus")) return "text-purple-500";
    if (model.includes("sonnet")) return "text-blue-500";
    return "text-gray-500";
  };

  const renderProgressBar = () => {
    if (!progress) return null;

    return (
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {progress.stage === "scanning" && "Scanning files..."}
            {progress.stage === "processing" && "Processing usage data..."}
            {progress.stage === "aggregating" && "Aggregating statistics..."}
            {progress.stage === "complete" && "Complete!"}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round(progress.percentage)}%
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-[#d97757] h-2 rounded-full transition-all duration-200 ease-out"
            style={{ width: `${Math.min(Math.max(progress.percentage, 0), 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{progress.files_processed} / {progress.total_files} files</span>
          <span className="truncate max-w-[200px]" title={progress.current_file}>
            {progress.current_file}
          </span>
        </div>
      </div>
    );
  };

  const renderTimelineChart = () => {
    if (!stats || stats.by_date.length === 0) {
      return (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No usage data available for the selected period
        </div>
      );
    }

    const maxCost = Math.max(...stats.by_date.map(d => d.total_cost), 0);
    const halfMaxCost = maxCost / 2;

    return (
      <div className="relative pl-8 pr-4">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(maxCost)}</span>
          <span>{formatCurrency(halfMaxCost)}</span>
          <span>{formatCurrency(0)}</span>
        </div>
        
        {/* Chart container */}
        <div className="flex items-end space-x-2 h-64 border-l border-b border-border pl-4">
          {stats.by_date.slice().reverse().map((day) => {
            const heightPercent = maxCost > 0 ? (day.total_cost / maxCost) * 100 : 0;
            const date = new Date(day.date.replace(/-/g, '/'));
            const formattedDate = date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            });
            
            return (
              <div key={day.date} className="flex-1 h-full flex flex-col items-center justify-end group relative">
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
                  className="w-full bg-[#d97757] hover:opacity-80 transition-opacity rounded-t cursor-pointer"
                  style={{ height: `${heightPercent}%` }}
                />
                
                {/* X-axis label */}
                <div
                  className="absolute left-1/2 top-full mt-1 -translate-x-1/2 text-xs text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap pointer-events-none"
                >
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* X-axis label */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          Daily Usage Over Time
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Usage Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                Track your Claude Code usage and costs
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isProgressiveLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", isProgressiveLoading && "animate-spin")} />
            </Button>
            
            {/* Date Range Filter */}
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex space-x-1">
              {(["all", "30d", "7d"] as const).map((range) => (
                <Button
                  key={range}
                  variant={selectedDateRange === range ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedDateRange(range)}
                  disabled={isProgressiveLoading}
                  className="text-xs"
                >
                  {range === "all" ? "All Time" : range === "7d" ? "Last 7 Days" : "Last 30 Days"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {isProgressiveLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div>
                <p className="text-sm font-medium mb-4">Loading usage statistics...</p>
                {renderProgressBar()}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button onClick={loadUsageStats} size="sm">
                Try Again
              </Button>
            </div>
          </div>
        ) : stats ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Total Cost Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Cost</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(stats.total_cost)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Total Requests Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Requests</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatNumber(stats.total_sessions)}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Total Tokens Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Tokens</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTokens(stats.total_tokens)}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Average Cost per Session Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Cost/Session</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(
                        stats.total_sessions > 0 
                          ? stats.total_cost / stats.total_sessions 
                          : 0
                      )}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>
            </div>

            {/* Timeline Chart */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-6 flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Daily Usage Timeline</span>
              </h3>
              {renderTimelineChart()}
            </Card>

            {/* Token Breakdown */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-4">Token Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Input Tokens</p>
                  <p className="text-lg font-semibold">{formatTokens(stats.total_input_tokens)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Output Tokens</p>
                  <p className="text-lg font-semibold">{formatTokens(stats.total_output_tokens)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cache Write</p>
                  <p className="text-lg font-semibold">{formatTokens(stats.total_cache_creation_tokens)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cache Read</p>
                  <p className="text-lg font-semibold">{formatTokens(stats.total_cache_read_tokens)}</p>
                </div>
              </div>
            </Card>

            {/* Models and Projects */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Models */}
              <Card className="p-6">
                <h3 className="text-sm font-semibold mb-4">Usage by Model</h3>
                <div className="space-y-4">
                  {stats.by_model.map((model) => (
                    <div key={model.model} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getModelColor(model.model))}
                          >
                            {getModelDisplayName(model.model)}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {model.request_count} requests
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

              {/* Projects */}
              <Card className="p-6">
                <h3 className="text-sm font-semibold mb-4">Usage by Project</h3>
                <div className="space-y-3">
                  {stats.by_project.map((project) => (
                    <div key={project.project_path} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex flex-col truncate">
                        <span className="text-sm font-medium truncate" title={project.project_path}>
                          {project.project_path}
                        </span>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {project.request_count} requests
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTokens(project.total_tokens)} tokens
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(project.total_cost)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(project.total_cost / project.request_count)}/request
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Sessions */}
            {sessionStats && sessionStats.length > 0 && (
              <Card className="p-6">
                <h3 className="text-sm font-semibold mb-4">Recent Sessions</h3>
                <div className="space-y-3">
                  {sessionStats.slice(0, 10).map((session) => (
                    <div key={`${session.project_path}-${session.project_name}`} className="flex items-center justify-between py-2 border-b border-border last:border-0">
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
                          {new Date(session.last_used).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No usage data found</p>
              <p className="text-xs text-muted-foreground mt-2">
                Start using Claude Code to see your usage statistics here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
