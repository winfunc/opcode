import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api, type UsageStats, type ProjectUsage } from "@/lib/api";
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Filter,
  Loader2,
  DollarSign,
  Activity,
  FileText,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { handleError } from "@/lib/errorHandler";
import { formatUnixTimestamp } from "@/lib/date-utils";
/**
 * Props interface for the UsageDashboard component
 */
interface UsageDashboardProps {
  /**
   * Callback when back button is clicked
   */
  onBack: () => void;
}

/**
 * UsageDashboard component - Displays Claude API usage statistics and costs
 *
 * A comprehensive analytics dashboard for monitoring Claude API usage, costs,
 * and performance metrics. Features include date range filtering, project-wise
 * breakdowns, cost analysis, token usage trends, and detailed session statistics.
 *
 * @param onBack - Callback when back button is clicked
 *
 * @example
 * ```tsx
 * <UsageDashboard onBack={() => setView('welcome')} />
 * ```
 */
export const UsageDashboard: React.FC<UsageDashboardProps> = ({ onBack }) => {
  const { t, language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [sessionStats, setSessionStats] = useState<ProjectUsage[] | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<"all" | "7d" | "30d">("all");
  const [activeTab, setActiveTab] = useState("overview");

  const loadUsageStats = useCallback(async () => {
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

        /**
         * Format date for API request
         *
         * @param date - Date to format
         * @returns Formatted date string
         */
        const formatDateForApi = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          return `${year}${month}${day}`;
        };

        statsData = await api.getUsageByDateRange(startDate.toISOString(), endDate.toISOString());
        sessionData = await api.getSessionStats(
          formatDateForApi(startDate),
          formatDateForApi(endDate),
          "desc"
        );
      }

      setStats(statsData);
      setSessionStats(sessionData);
    } catch (err) {
      await handleError("Failed to load usage stats:", { context: err });
      setError(t.usage.failedToLoadUsageStats);
    } finally {
      setLoading(false);
    }
  }, [selectedDateRange, t.usage.failedToLoadUsageStats]);

  useEffect(() => {
    loadUsageStats();
  }, [selectedDateRange, loadUsageStats]);

  /**
   * Format amount as currency
   *
   * @param amount - Amount to format
   * @returns Formatted currency string
   */
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  /**
   * Format number with thousand separators
   *
   * @param num - Number to format
   * @returns Formatted number string
   */
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const getLocaleFromLanguage = (language: string): string => {
    const localeMap: Record<string, string> = {
      'zh': 'zh-CN',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'ru': 'ru-RU',
      'pt': 'pt-PT',
      'it': 'it-IT',
      'ar': 'ar-SA',
      'hi': 'hi-IN',
      'en': 'en-US'
    };
    return localeMap[language] || 'en-US';
  };

  /**
   * Format token count with appropriate units
   *
   * @param num - Token count to format
   * @returns Formatted token string (e.g., "1.2K", "500")
   */
  const formatTokens = (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return formatNumber(num);
  };

  /**
   * Get display name for a model
   *
   * @param model - Model identifier
   * @returns Human-readable model name
   */
  const getModelDisplayName = (model: string): string => {
    const modelMap: Record<string, string> = {
      "claude-4-opus": "Opus 4",
      "claude-opus-4-1-20250805": "Opus 4.1",
      "claude-4-sonnet": "Sonnet 4",
      "claude-3.5-sonnet": "Sonnet 3.5",
      "claude-3-opus": "Opus 3",
    };
    return modelMap[model] || model;
  };

  /**
   * Get color for a model in charts
   *
   * @param model - Model identifier
   * @returns CSS color class or hex color
   */
  const getModelColor = (model: string): string => {
    if (model.includes("opus")) return "text-purple-500";
    if (model.includes("sonnet")) return "text-blue-500";
    return "text-gray-500";
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
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{t.usage.title}</h1>
              <p className="text-xs text-muted-foreground">{t.usage.trackUsageAndCosts}</p>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex space-x-1">
              {(["all", "30d", "7d"] as const).map((range) => (
                <Button
                  key={range}
                  variant={selectedDateRange === range ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedDateRange(range)}
                  className="text-xs"
                >
                  {range === "all"
                    ? t.usage.allTime
                    : range === "7d"
                      ? t.usage.last7Days
                      : t.usage.last30Days}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">{t.usage.loadingStats}</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button onClick={loadUsageStats} size="sm">
                {t.usage.tryAgain}
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
                    <p className="text-xs text-muted-foreground">{t.usage.totalCost}</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(stats.total_cost)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Total Sessions Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.usage.totalSessions}</p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(stats.total_sessions)}</p>
                  </div>
                  <FileText className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Total Tokens Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.usage.totalTokens}</p>
                    <p className="text-2xl font-bold mt-1">{formatTokens(stats.total_tokens)}</p>
                  </div>
                  <Activity className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Average Cost per Session Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.usage.avgCostPerSession}</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(
                        stats.total_sessions > 0 ? stats.total_cost / stats.total_sessions : 0
                      )}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>
            </div>

            {/* Tabs for different views */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">{t.usage.overview}</TabsTrigger>
                <TabsTrigger value="models">{t.usage.byModel}</TabsTrigger>
                <TabsTrigger value="projects">{t.usage.byProject}</TabsTrigger>
                <TabsTrigger value="sessions">{t.usage.bySessions}</TabsTrigger>
                <TabsTrigger value="timeline">{t.usage.timeline}</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">{t.usage.tokenBreakdownTitle}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t.usage.inputTokens}</p>
                      <p className="text-lg font-semibold">
                        {formatTokens(stats.total_input_tokens)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.usage.outputTokens}</p>
                      <p className="text-lg font-semibold">
                        {formatTokens(stats.total_output_tokens)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.usage.cacheWrite}</p>
                      <p className="text-lg font-semibold">
                        {formatTokens(stats.total_cache_creation_tokens)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.usage.cacheRead}</p>
                      <p className="text-lg font-semibold">
                        {formatTokens(stats.total_cache_read_tokens)}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-4">{t.usage.mostUsedModels}</h3>
                    <div className="space-y-3">
                      {stats.by_model.slice(0, 3).map((model) => (
                        <div key={model.model} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant="outline"
                              className={cn("text-xs", getModelColor(model.model))}
                            >
                              {getModelDisplayName(model.model)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {model.session_count} {t.usage.sessions}
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {formatCurrency(model.total_cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-4">{t.usage.topProjects}</h3>
                    <div className="space-y-3">
                      {stats.by_project.slice(0, 3).map((project) => (
                        <div
                          key={project.project_path}
                          className="flex items-center justify-between"
                        >
                          <div className="flex flex-col">
                            <span
                              className="text-sm font-medium truncate max-w-[200px]"
                              title={project.project_path}
                            >
                              {project.project_path}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {project.session_count} {t.usage.sessions}
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {formatCurrency(project.total_cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* Models Tab */}
              <TabsContent value="models">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">{t.usage.usageByModel}</h3>
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
                              {model.session_count} {t.usage.sessions}
                            </span>
                          </div>
                          <span className="text-sm font-semibold">
                            {formatCurrency(model.total_cost)}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">{t.usage.input}: </span>
                            <span className="font-medium">{formatTokens(model.input_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t.usage.output}: </span>
                            <span className="font-medium">{formatTokens(model.output_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              {t.usage.cacheWriteShort}:{" "}
                            </span>
                            <span className="font-medium">
                              {formatTokens(model.cache_creation_tokens)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              {t.usage.cacheReadShort}:{" "}
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
              <TabsContent value="projects">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">{t.usage.usageByProject}</h3>
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
                            <span className="text-xs text-muted-foreground">
                              {project.session_count} {t.usage.sessions}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTokens(project.total_tokens)} {t.usage.tokens}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {formatCurrency(project.total_cost)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(project.total_cost / project.session_count)}/
                            {t.sessions.sessionName.toLowerCase()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Sessions Tab */}
              <TabsContent value="sessions">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">{t.usage.usageBySession}</h3>
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
                              {session.project_path.split("/").slice(-2).join("/")}
                            </span>
                          </div>
                          <span className="text-sm font-medium mt-1">{session.project_name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {formatCurrency(session.total_cost)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatUnixTimestamp(
                              Math.floor(new Date(session.last_used).getTime() / 1000),
                              getLocaleFromLanguage(language),
                              { yesterday: t.time.yesterday }
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-6 flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>{t.usage.dailyUsage}</span>
                  </h3>
                  {stats.by_date.length > 0 ? (
                    (() => {
                      const maxCost = Math.max(...stats.by_date.map((d) => d.total_cost), 0);
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
                                  maxCost > 0 ? (day.total_cost / maxCost) * 100 : 0;
                                const date = new Date(day.date.replace(/-/g, "/"));
                                const locale = getLocaleFromLanguage(language);
                                const formattedDate = date.toLocaleDateString(locale, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                });

                                return (
                                  <div
                                    key={day.date}
                                    className="flex-1 h-full flex flex-col items-center justify-end group relative"
                                  >
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                      <div className="bg-background border border-border rounded-lg shadow-lg p-3 whitespace-nowrap">
                                        <p className="text-sm font-semibold">{formattedDate}</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {t.usage.totalCost}: {formatCurrency(day.total_cost)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatTokens(day.total_tokens)} {t.usage.tokens}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {day.models_used.length}{" "}
                                          {day.models_used.length !== 1
                                            ? t.usage.models
                                            : t.usage.model}
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
                                      {date.toLocaleDateString(locale, {
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
                            {t.usage.dailyUsageOverTime}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {t.usage.noUsageDataForPeriod}
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};
