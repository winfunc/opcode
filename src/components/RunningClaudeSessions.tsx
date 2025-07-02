import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Loader2, Terminal, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type ProcessInfo, type Session } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatISOTimestamp } from "@/lib/date-utils";

interface RunningClaudeSessionsProps {
  /**
   * Callback when a running session is clicked to resume
   */
  onSessionClick?: (session: Session) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Component to display currently running Claude sessions
 */
export const RunningClaudeSessions: React.FC<RunningClaudeSessionsProps> = ({
  onSessionClick,
  className,
}) => {
  const [runningSessions, setRunningSessions] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRunningSessions();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(loadRunningSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadRunningSessions = async () => {
    try {
      const sessions = await api.listRunningClaudeSessions();
      setRunningSessions(sessions);
      setError(null);
    } catch (err) {
      console.error("Failed to load running sessions:", err);
      setError("Failed to load running sessions");
    } finally {
      setLoading(false);
    }
  };

  const handleResumeSession = (processInfo: ProcessInfo) => {
    // Extract session ID from process type
    if ('ClaudeSession' in processInfo.process_type) {
      const sessionId = processInfo.process_type.ClaudeSession.session_id;
      
      // Create a minimal session object for resumption
      const session: Session = {
        id: sessionId,
        project_id: processInfo.project_path.replace(/[^a-zA-Z0-9]/g, '-'),
        project_path: processInfo.project_path,
        created_at: new Date(processInfo.started_at).getTime() / 1000,
      };
      
      // Emit event to navigate to the session
      const event = new CustomEvent('claude-session-selected', { 
        detail: { session, projectPath: processInfo.project_path } 
      });
      window.dispatchEvent(event);
      
      onSessionClick?.(session);
    }
  };

  if (loading && runningSessions.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-destructive text-sm", className)}>
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  if (runningSessions.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <h3 className="text-sm font-medium">Active Claude Sessions</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          ({runningSessions.length} running)
        </span>
      </div>

      <div className="space-y-2">
        {runningSessions.map((session) => {
          const sessionId = 'ClaudeSession' in session.process_type 
            ? session.process_type.ClaudeSession.session_id 
            : null;
          
          if (!sessionId) return null;

          return (
            <motion.div
              key={session.run_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer">
                <CardContent 
                  className="p-3"
                  onClick={() => handleResumeSession(session)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Terminal className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-xs text-muted-foreground truncate">
                            {sessionId.substring(0, 20)}...
                          </p>
                          <span className="text-xs text-green-600 font-medium">
                            Running
                          </span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground truncate">
                          {session.project_path}
                        </p>
                        
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Started: {formatISOTimestamp(session.started_at)}</span>
                          <span>Model: {session.model}</span>
                          {session.task && (
                            <span className="truncate max-w-[200px]" title={session.task}>
                              Task: {session.task}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-shrink-0"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Resume
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}; 