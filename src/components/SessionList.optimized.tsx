import React, { useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ArrowLeft, Calendar, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ClaudeMemoriesDropdown } from "@/components/ClaudeMemoriesDropdown";
import { cn } from "@/lib/utils";
import { formatUnixTimestamp, formatISOTimestamp } from "@/lib/date-utils";
import { usePagination } from "@/hooks/usePagination";
import type { Session, ClaudeMdFile } from "@/lib/api";

interface SessionListProps {
  sessions: Session[];
  projectPath: string;
  onBack: () => void;
  onSessionClick?: (session: Session) => void;
  onEditClaudeFile?: (file: ClaudeMdFile) => void;
  className?: string;
}

// Memoized session card component to prevent unnecessary re-renders
const SessionCard = React.memo<{
  session: Session;
  projectPath: string;
  onClick?: () => void;
  onEditClaudeFile?: (file: ClaudeMdFile) => void;
}>(({ session, projectPath, onClick, onEditClaudeFile }) => {
  const formatTime = useCallback((timestamp: string | number | undefined) => {
    if (!timestamp) return "Unknown time";
    
    if (typeof timestamp === "string") {
      return formatISOTimestamp(timestamp);
    } else {
      return formatUnixTimestamp(timestamp);
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <Card 
        className={cn(
          "cursor-pointer transition-all",
          "hover:shadow-lg hover:border-primary/20",
          "bg-card/50 backdrop-blur-sm"
        )}
        onClick={onClick}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              {/* Session title */}
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">
                    {`Session ${session.id.slice(0, 8)}`}
                  </h3>
                </div>
              </div>

              {/* Session metadata */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatTime(session.created_at)}</span>
                </div>
                {session.message_timestamp && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatTime(session.message_timestamp)}</span>
                  </div>
                )}
              </div>

              {/* Session ID */}
              <div className="text-xs text-muted-foreground/60 font-mono">
                ID: {session.id}
              </div>
            </div>

            {/* Claude memories dropdown */}
            <div className="ml-4">
              <ClaudeMemoriesDropdown
                projectPath={projectPath}
                onEditFile={onEditClaudeFile || (() => {})}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

SessionCard.displayName = 'SessionCard';

export const SessionList: React.FC<SessionListProps> = React.memo(({
  sessions,
  projectPath,
  onBack,
  onSessionClick,
  onEditClaudeFile,
  className
}) => {
  // Sort sessions by created_at in descending order
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const timeA = a.created_at || 0;
      const timeB = b.created_at || 0;
      return timeB > timeA ? 1 : -1;
    });
  }, [sessions]);

  // Use custom pagination hook
  const {
    currentPage,
    totalPages,
    paginatedData,
    goToPage,
    canGoNext: _canGoNext,
    canGoPrevious: _canGoPrevious
  } = usePagination(sortedSessions, {
    initialPage: 1,
    initialPageSize: 5
  });

  const handleSessionClick = useCallback((session: Session) => {
    onSessionClick?.(session);
  }, [onSessionClick]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Sessions</h2>
            <p className="text-sm text-muted-foreground">
              {projectPath}
            </p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </div>
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <Card className="bg-muted/20">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No sessions found for this project
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {paginatedData.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  projectPath={projectPath}
                  onClick={() => handleSessionClick(session)}
                  onEditClaudeFile={onEditClaudeFile}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
});