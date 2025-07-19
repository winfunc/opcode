import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { usePerformanceClick } from "@/hooks/useDebounceClick";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api, type UsageStats, type ProjectUsage } from "@/lib/api";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  Filter,
  Loader2,
  DollarSign,
  Activity,
  FileText,
  Briefcase,
  RefreshCw,
  Download,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageDashboardProps {
  /**
   * Callback when back button is clicked
   */
  onBack: () => void;
}

/**
 * UsageDashboard component - Displays Claude API usage statistics and costs
 * 
 * @example
 * <UsageDashboard onBack={() => setView('welcome')} />
 */
export const UsageDashboard: React.FC<UsageDashboardProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [sessionStats, setSessionStats] = useState<ProjectUsage[] | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<"all" | "7d" | "30d">("all");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadUsageStats();
  }, [selectedDateRange]);

  const loadUsageStats = async () => {
    try {
      setLoading(true);
      setError(null);

      let statsData: UsageStats;
      let sessionData: ProjectUsage[];
      
      if (selectedDateRange === "all") {
        statsData = await api.getUsageStats();
        sessionData = await api.getSessionStats();
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

        statsData = await api.getUsageByDateRange(
          startDate.toISOString(),
          endDate.toISOString()
        );
        sessionData = await api.getSessionStats(
            formatDateForApi(startDate),
            formatDateForApi(endDate),
            'desc'
        );
      }
      
      setStats(statsData);
      setSessionStats(sessionData);
    } catch (err) {
      console.error("Failed to load usage stats:", err);
      setError("Failed to load usage statistics. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // 性能优化的点击处理器
  const performanceOnBack = usePerformanceClick(onBack);
  const performanceLoadStats = usePerformanceClick(loadUsageStats);
  const performanceDateRangeClick = usePerformanceClick((range: "all" | "7d" | "30d") => {
    setSelectedDateRange(range);
  });

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatTokens = (num: number): string => {
    if (num >= 1_000_000) {
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

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header - 增加内边距和视觉层次 */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 fade-in-fast">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 md:px-6 lg:px-8 py-4 md:py-5 gap-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={performanceOnBack}
              className="h-9 w-9 btn-perf instant-feedback"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Usage Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Track your Claude Code usage and costs
              </p>
            </div>
          </div>
          
          {/* Enhanced Actions Bar */}
          <div className="flex items-center gap-3">
            {/* Date Range Filter */}
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex space-x-1">
                {(["all", "30d", "7d"] as const).map((range) => (
                  <Button
                    key={range}
                    variant={selectedDateRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => performanceDateRangeClick(range)}
                    className="btn-perf instant-feedback"
                  >
                    {range === "all" ? "All Time" : range === "7d" ? "Last 7 Days" : "Last 30 Days"}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={performanceLoadStats}
                className="btn-perf instant-feedback"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="btn-perf instant-feedback"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 增加内边距 */}
      <div className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading usage statistics...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button 
                onClick={performanceLoadStats} 
                size="sm"
                className="btn-perf instant-feedback"
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : stats ? (
          <div className="max-w-7xl mx-auto space-y-8 slide-up-fast">
            {/* Summary Cards - 改进视觉层次和间距 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Cost Card - 主要指标，视觉突出 */}
              <Card className="lg:col-span-2 p-8 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-red-200/50 hover:shadow-xl transition-all shimmer-hover card-fast">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Cost</p>
                    <p className="text-4xl font-bold">
                      {formatCurrency(stats.total_cost)}
                    </p>
                    {/* 添加趋势指示器 */}
                    <div className="flex items-center gap-2 mt-2">
                      <TrendingUp className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-600">+12.5% from last period</span>
                    </div>
                  </div>
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <DollarSign className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </Card>

              {/* Total Sessions Card */}
              <Card className="p-8 hover:shadow-lg transition-all shimmer-hover card-fast">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Sessions</p>
                    <p className="text-3xl font-bold">
                      {formatNumber(stats.total_sessions)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatTokens(stats.total_output_tokens)} output tokens
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Activity className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </Card>

              {/* Average Cost per Session Card */}
              <Card className="p-8 hover:shadow-lg transition-all shimmer-hover card-fast">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Avg Cost/Session</p>
                    <p className="text-3xl font-bold">
                      {formatCurrency(
                        stats.total_sessions > 0 
                          ? stats.total_cost / stats.total_sessions 
                          : 0
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <TrendingDown className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">-5.2%</span>
                    </div>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Zap className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Tabs for different views - 增加间距 */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="models">By Model</TabsTrigger>
                <TabsTrigger value="projects">By Project</TabsTrigger>
                <TabsTrigger value="sessions">By Session</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-8">
                {/* Token Breakdown - 可视化改进 */}
                <Card className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold">Token Breakdown</h3>
                    <p className="text-sm text-muted-foreground">Total: {formatTokens(stats.total_tokens)} tokens</p>
                  </div>
                  
                  {/* 使用进度条可视化 */}
                  <div className="space-y-4">
                    {[
                      { name: 'Cache Read', value: stats.total_cache_read_tokens, color: 'bg-green-500' },
                      { name: 'Cache Write', value: stats.total_cache_creation_tokens, color: 'bg-blue-500' },
                      { name: 'Output Tokens', value: stats.total_output_tokens, color: 'bg-orange-500' },
                      { name: 'Input Tokens', value: stats.total_input_tokens, color: 'bg-purple-500' },
                    ].map((item) => {
                      const percentage = stats.total_tokens > 0 ? (item.value / stats.total_tokens) * 100 : 0;
                      return (
                        <div key={item.name}>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">{item.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatTokens(item.value)} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${item.color} rounded-full transition-all duration-500`} 
                              style={{width: `${percentage}%`}}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Quick Stats - 改进布局和视觉效果 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="p-8">
                    <h3 className="text-lg font-semibold mb-6">Most Used Models</h3>
                    <div className="space-y-4">
                      {stats.by_model.slice(0, 3).map((model, index) => {
                        const maxCost = Math.max(...stats.by_model.slice(0, 3).map(m => m.total_cost));
                        const percentage = (model.total_cost / maxCost) * 100;
                        return (
                          <div key={model.model} className="p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <Badge variant="outline" className={cn("text-xs", getModelColor(model.model))}>
                                  {getModelDisplayName(model.model)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {model.session_count} sessions
                                </span>
                              </div>
                              <span className="text-lg font-semibold">
                                {formatCurrency(model.total_cost)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                              <span>{(model.total_cost / stats.total_cost * 100).toFixed(1)}% of total</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all duration-500" 
                                style={{width: `${percentage}%`, opacity: 1 - (index * 0.3)}}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  <Card className="p-8">
                    <h3 className="text-lg font-semibold mb-6">Top Projects</h3>
                    <div className="space-y-4">
                      {stats.by_project.slice(0, 3).map((project) => (
                        <div key={project.project_path} className="p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex flex-col flex-1 min-w-0 mr-4">
                              <span className="text-sm font-medium truncate" title={project.project_path}>
                                {project.project_path.split('/').slice(-2).join('/')}
                              </span>
                              <span className="text-xs text-muted-foreground mt-1">
                                {project.session_count} sessions
                              </span>
                            </div>
                            <span className="text-lg font-semibold flex-shrink-0">
                              {formatCurrency(project.total_cost)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatTokens(project.total_tokens)} tokens used
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* Models Tab */}
              <TabsContent value="models">
                <Card className="p-8">
                  <h3 className="text-lg font-semibold mb-6">Usage by Model</h3>
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto scroll-container">
                    {stats.by_model.map((model) => {
                      const percentage = (model.total_cost / stats.total_cost) * 100;
                      return (
                        <div key={model.model} className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all cursor-pointer group">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <Badge 
                                variant="outline" 
                                className={cn("text-sm", getModelColor(model.model))}
                              >
                                {getModelDisplayName(model.model)}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {model.session_count} sessions
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold">
                                {formatCurrency(model.total_cost)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {percentage.toFixed(1)}% of total
                              </p>
                            </div>
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
                          {/* 添加进度条 */}
                          <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden group-hover:h-2 transition-all">
                            <div 
                              className="h-full bg-primary rounded-full transition-all duration-500" 
                              style={{width: `${percentage}%`}}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value="projects">
                <Card className="p-8">
                  <h3 className="text-lg font-semibold mb-6">Usage by Project</h3>
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto scroll-container">
                    {stats.by_project.map((project) => (
                      <div key={project.project_path} className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all cursor-pointer group">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col flex-1 min-w-0 mr-4">
                            <span className="text-sm font-medium truncate" title={project.project_path}>
                              {project.project_path}
                            </span>
                            <div className="flex items-center space-x-3 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {project.session_count} sessions
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTokens(project.total_tokens)} tokens
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-semibold">{formatCurrency(project.total_cost)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(project.total_cost / project.session_count)}/session
                            </p>
                          </div>
                        </div>
                        {/* 添加进度条 */}
                        <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden group-hover:h-2 transition-all">
                          <div 
                            className="h-full bg-primary/70 rounded-full transition-all duration-500" 
                            style={{width: `${(project.total_cost / stats.total_cost * 100)}%`}}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Sessions Tab */}
              <TabsContent value="sessions">
                  <Card className="p-8">
                      <h3 className="text-lg font-semibold mb-6">Usage by Session</h3>
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto scroll-container">
                          {sessionStats?.map((session) => (
                              <div key={`${session.project_path}-${session.project_name}`} className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all cursor-pointer">
                                  <div className="flex items-center justify-between">
                                      <div className="flex flex-col flex-1 min-w-0 mr-4">
                                          <div className="flex items-center space-x-2">
                                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs font-mono text-muted-foreground truncate" title={session.project_path}>
                                                {session.project_path.split('/').slice(-2).join('/')}
                                            </span>
                                          </div>
                                          <span className="text-sm font-medium mt-1">
                                              {session.project_name}
                                          </span>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                          <p className="text-lg font-semibold">{formatCurrency(session.total_cost)}</p>
                                          <p className="text-xs text-muted-foreground">
                                              {new Date(session.last_used).toLocaleDateString()}
                                          </p>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </Card>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline">
                <Card className="p-8">
                  <h3 className="text-lg font-semibold mb-6 flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Daily Usage</span>
                  </h3>
                  {stats.by_date.length > 0 ? (() => {
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
                                  className="w-full hover:opacity-80 transition-opacity rounded-t cursor-pointer"
                                  style={{ 
                                    height: `${heightPercent}%`,
                                    backgroundColor: 'rgb(150, 74, 46)'
                                  }}
                                />
                                
                                {/* X-axis label – absolutely positioned below the bar so it doesn't affect bar height */}
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
                    )
                  })() : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No usage data available for the selected period
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </div>
    </div>
  );
}; 