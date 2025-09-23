import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api, type UsageStats, type ProjectUsage } from "@/lib/api";
import { Calendar, Filter, Loader2, Briefcase } from "lucide-react";

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
export const UsageDashboard: React.FC<UsageDashboardProps> = ({}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [sessionStats, setSessionStats] = useState<ProjectUsage[] | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<
    "all" | "7d" | "30d"
  >("7d");
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
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          return `${year}${month}${day}`;
        };

        statsData = await api.getUsageByDateRange(
          startDate.toISOString(),
          endDate.toISOString(),
        );
        sessionData = await api.getSessionStats(
          formatDateForApi(startDate),
          formatDateForApi(endDate),
          "desc",
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

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat("en-US").format(num);
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

  // Helper for model color (unused in this original version)

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
                    variant={
                      selectedDateRange === range ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setSelectedDateRange(range)}
                  >
                    {range === "all"
                      ? "All Time"
                      : range === "7d"
                        ? "Last 7 Days"
                        : "Last 30 Days"}
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
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 text-body-small text-destructive"
            >
              {error}
              <Button onClick={loadUsageStats} size="sm" className="ml-4">
                Try Again
              </Button>
            </motion.div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total Cost Card */}
                <Card className="p-4 shimmer-hover">
                  <div>
                    <p className="text-caption text-muted-foreground">
                      Total Cost
                    </p>
                    <p className="text-display-2 mt-1">
                      {formatCurrency(stats.total_cost)}
                    </p>
                  </div>
                </Card>

                {/* Total Sessions Card */}
                <Card className="p-4 shimmer-hover">
                  <div>
                    <p className="text-caption text-muted-foreground">
                      Total Sessions
                    </p>
                    <p className="text-display-2 mt-1">
                      {formatNumber(stats.total_sessions)}
                    </p>
                  </div>
                </Card>

                {/* Total Tokens Card */}
                <Card className="p-4 shimmer-hover">
                  <div>
                    <p className="text-caption text-muted-foreground">
                      Total Tokens
                    </p>
                    <p className="text-display-2 mt-1">
                      {formatTokens(stats.total_tokens)}
                    </p>
                  </div>
                </Card>

                {/* Average Cost per Session Card */}
                <Card className="p-4 shimmer-hover">
                  <div>
                    <p className="text-caption text-muted-foreground">
                      Avg Cost/Session
                    </p>
                    <p className="text-display-2 mt-1">
                      {formatCurrency(
                        stats.total_sessions > 0
                          ? stats.total_cost / stats.total_sessions
                          : 0,
                      )}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Tabs for different views */}
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid grid-cols-5 w-full mb-6 h-auto p-1">
                  <TabsTrigger value="overview" className="py-2.5 px-3">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="models" className="py-2.5 px-3">
                    By Model
                  </TabsTrigger>
                  <TabsTrigger value="projects" className="py-2.5 px-3">
                    By Project
                  </TabsTrigger>
                  <TabsTrigger value="sessions" className="py-2.5 px-3">
                    By Session
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="py-2.5 px-3">
                    Timeline
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6 mt-6">
                  <Card className="p-6">
                    <h3 className="text-label mb-4">Token Breakdown</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-caption text-muted-foreground">
                          Input Tokens
                        </p>
                        <p className="text-heading-4">
                          {formatTokens(stats.total_input_tokens)}
                        </p>
                      </div>
                      <div>
                        <p className="text-caption text-muted-foreground">
                          Output Tokens
                        </p>
                        <p className="text-heading-4">
                          {formatTokens(stats.total_output_tokens)}
                        </p>
                      </div>
                      <div>
                        <p className="text-caption text-muted-foreground">
                          Cache Write
                        </p>
                        <p className="text-heading-4">
                          {formatTokens(stats.total_cache_creation_tokens)}
                        </p>
                      </div>
                      <div>
                        <p className="text-caption text-muted-foreground">
                          Cache Read
                        </p>
                        <p className="text-heading-4">
                          {formatTokens(stats.total_cache_read_tokens)}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-6">
                      <h3 className="text-label mb-4">Most Used Models</h3>
                      <div className="space-y-3">
                        {stats.by_model.slice(0, 3).map((model) => (
                          <div
                            key={model.model}
                            className="flex items-center justify-between"
                          >
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
                        ))}
                      </div>
                    </Card>

                    <Card className="p-6">
                      <h3 className="text-label mb-4">Top Projects</h3>
                      <div className="space-y-3">
                        {stats.by_project.slice(0, 3).map((project) => (
                          <div
                            key={project.project_path}
                            className="flex items-center justify-between"
                          >
                            <div className="flex flex-col">
                              <span
                                className="text-body-small font-medium truncate max-w-[200px]"
                                title={project.project_path}
                              >
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
                        ))}
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                {/* Models Tab */}
                <TabsContent value="models" className="space-y-6 mt-6">
                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-4">
                      Usage by Model
                    </h3>
                    <div className="space-y-4">
                      {stats.by_model.map((model) => (
                        <div key={model.model} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Badge variant="outline" className="text-xs">
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
                              <span className="text-muted-foreground">
                                Input:{" "}
                              </span>
                              <span className="font-medium">
                                {formatTokens(model.input_tokens)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Output:{" "}
                              </span>
                              <span className="font-medium">
                                {formatTokens(model.output_tokens)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Cache W:{" "}
                              </span>
                              <span className="font-medium">
                                {formatTokens(model.cache_creation_tokens)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Cache R:{" "}
                              </span>
                              <span className="font-medium">
                                {formatTokens(model.cache_read_tokens)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </TabsContent>

                {/* Projects Tab */}
                <TabsContent value="projects" className="space-y-6 mt-6">
                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-4">
                      Usage by Project
                    </h3>
                    <div className="space-y-3">
                      {stats.by_project.map((project) => (
                        <div
                          key={project.project_path}
                          className="flex items-center justify-between py-2 border-b border-border last:border-0"
                        >
                          <div className="flex flex-col truncate">
                            <span
                              className="text-sm font-medium truncate"
                              title={project.project_path}
                            >
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
                            <p className="text-sm font-semibold">
                              {formatCurrency(project.total_cost)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(
                                project.total_cost / project.session_count,
                              )}
                              /session
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </TabsContent>

                {/* Sessions Tab */}
                <TabsContent value="sessions" className="space-y-6 mt-6">
                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-4">
                      Usage by Session
                    </h3>
                    <div className="space-y-3">
                      {sessionStats?.map((session) => (
                        <div
                          key={`${session.project_path}-${session.project_name}`}
                          className="flex items-center justify-between py-2 border-b border-border last:border-0"
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-2">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                              <span
                                className="text-xs font-mono text-muted-foreground truncate max-w-[200px]"
                                title={session.project_path}
                              >
                                {session.project_path
                                  .split("/")
                                  .slice(-2)
                                  .join("/")}
                              </span>
                            </div>
                            <span className="text-sm font-medium mt-1">
                              {session.project_name}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              {formatCurrency(session.total_cost)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.last_used).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </TabsContent>

                {/* Timeline Tab */}
                <TabsContent value="timeline" className="space-y-6 mt-6">
                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-6 flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Daily Usage</span>
                    </h3>
                    {stats.by_date.length > 0 ? (
                      (() => {
                        const maxCost = Math.max(
                          ...stats.by_date.map((d) => d.total_cost),
                          0,
                        );
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
                              {stats.by_date
                                .slice()
                                .reverse()
                                .map((day) => {
                                  const heightPercent =
                                    maxCost > 0
                                      ? (day.total_cost / maxCost) * 100
                                      : 0;
                                  const date = new Date(
                                    day.date.replace(/-/g, "/"),
                                  );
                                  const formattedDate = date.toLocaleDateString(
                                    "en-US",
                                    {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                    },
                                  );

                                  return (
                                    <div
                                      key={day.date}
                                      className="flex-1 h-full flex flex-col items-center justify-end group relative"
                                    >
                                      {/* Tooltip */}
                                      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                        <div className="bg-background border border-border rounded-lg shadow-lg p-3 whitespace-nowrap">
                                          <p className="text-sm font-semibold">
                                            {formattedDate}
                                          </p>
                                          <p className="text-sm text-muted-foreground mt-1">
                                            Cost:{" "}
                                            {formatCurrency(day.total_cost)}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {formatTokens(day.total_tokens)}{" "}
                                            tokens
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {day.models_used.length} model
                                            {day.models_used.length !== 1
                                              ? "s"
                                              : ""}
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

                                      {/* X-axis label – absolutely positioned below the bar so it doesn't affect bar height */}
                                      <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 text-xs text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap pointer-events-none">
                                        {date.toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        })}
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
                      })()
                    ) : (
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
    </div>
  );
};
