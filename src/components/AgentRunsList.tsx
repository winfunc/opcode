import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Clock, Hash, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { formatISOTimestamp } from "@/lib/date-utils";
import type { AgentRunWithMetrics } from "@/lib/api";
import { AGENT_ICONS } from "./CCAgents";
import { useTabState } from "@/hooks/useTabState";

interface AgentRunsListProps {
  /**
   * Array of agent runs to display
   */
  runs: AgentRunWithMetrics[];
  /**
   * Callback when a run is clicked
   */
  onRunClick?: (run: AgentRunWithMetrics) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

const ITEMS_PER_PAGE = 5;

/**
 * AgentRunsList component - Displays a paginated list of agent execution runs
 * 
 * @example
 * <AgentRunsList
 *   runs={runs}
 *   onRunClick={(run) => console.log('Selected:', run)}
 * />
 */
export const AgentRunsList: React.FC<AgentRunsListProps> = ({
  runs,
  onRunClick,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const { createAgentTab } = useTabState();
  
  // Calculate pagination
  const totalPages = Math.ceil(runs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentRuns = runs.slice(startIndex, endIndex);
  
  // Reset to page 1 if runs change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [runs.length]);
  
  const renderIcon = (iconName: string) => {
    const Icon = AGENT_ICONS[iconName as keyof typeof AGENT_ICONS] || Bot;
    return <Icon className="h-4 w-4" />;
  };
  
  const formatDuration = (ms?: number) => {
    if (!ms) return "N/A";
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  const formatTokens = (tokens?: number) => {
    if (!tokens) return "0";
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };
  
  const handleRunClick = (run: AgentRunWithMetrics) => {
    // If there's a callback, use it (for full-page navigation)
    if (onRunClick) {
      onRunClick(run);
    } else if (run.id) {
      // Otherwise, open in new tab
      createAgentTab(run.id.toString(), run.agent_name);
    }
  };
  
  if (runs.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No execution history yet</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn("space-y-2", className)}>
        <AnimatePresence mode="popLayout">
          {currentRuns.map((run, index) => (
            <motion.div
              key={run.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05,
                ease: [0.4, 0, 0.2, 1],
              }}
            >
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
                  run.status === "running" && "border-green-500/50"
                )}
                onClick={() => handleRunClick(run)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {renderIcon(run.agent_icon)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium truncate">
                          {run.agent_name}
                        </h4>
                        {run.status === "running" && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-600 font-medium">Running</span>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground truncate mb-1">
                        {run.task}
                      </p>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatISOTimestamp(run.created_at)}</span>
                        </div>
                        
                        {run.metrics?.duration_ms && (
                          <span>{formatDuration(run.metrics.duration_ms)}</span>
                        )}
                        
                        {run.metrics?.total_tokens && (
                          <div className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            <span>{formatTokens(run.metrics.total_tokens)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0">
                      <Badge 
                        variant={
                          run.status === "completed" ? "default" :
                          run.status === "running" ? "secondary" :
                          run.status === "failed" ? "destructive" :
                          "outline"
                        }
                        className="text-xs"
                      >
                        {run.status === "completed" ? "Completed" :
                         run.status === "running" ? "Running" :
                         run.status === "failed" ? "Failed" :
                         "Pending"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pt-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

    </>
  );
}; 