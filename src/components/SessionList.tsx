import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ArrowLeft, Calendar, Clock, MessageSquare, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ClaudeMemoriesDropdown } from "@/components/ClaudeMemoriesDropdown";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatUnixTimestamp, formatISOTimestamp, truncateText, getFirstLine } from "@/lib/date-utils";
import type { Session, ClaudeMdFile } from "@/lib/api";

interface SessionListProps {
  /**
   * Array of sessions to display
   */
  sessions: Session[];
  /**
   * The current project path being viewed
   */
  projectPath: string;
  /**
   * Callback to go back to project list
   */
  onBack: () => void;
  /**
   * Callback when a session is clicked
   */
  onSessionClick?: (session: Session) => void;
  /**
   * Callback when a CLAUDE.md file should be edited
   */
  onEditClaudeFile?: (file: ClaudeMdFile) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

const ITEMS_PER_PAGE = 12;

/**
 * SessionList component - Displays paginated sessions for a specific project
 * 
 * @example
 * <SessionList
 *   sessions={sessions}
 *   projectPath="/Users/example/project"
 *   onBack={() => setSelectedProject(null)}
 *   onSessionClick={(session) => console.log('Selected session:', session)}
 * />
 */
export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  projectPath,
  onBack,
  onSessionClick,
  onEditClaudeFile,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  // Calculate pagination
  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSessions = sessions.slice(startIndex, endIndex);
  
  // Reset to page 1 if sessions change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [sessions.length]);
  
  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center space-x-3"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-medium">
                {projectPath.split('/').pop() || 'Project'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-sm">
                <p className="font-mono text-xs">{projectPath}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </motion.div>

      {/* CLAUDE.md Memories Dropdown */}
      {onEditClaudeFile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <ClaudeMemoriesDropdown
            projectPath={projectPath}
            onEditFile={onEditClaudeFile}
          />
        </motion.div>
      )}

      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {currentSessions.map((session, index) => (
            <motion.div
              key={session.id}
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
                  "p-3 hover:bg-accent/50 transition-all duration-200 cursor-pointer group h-full",
                  session.todo_data && "bg-primary/5"
                )}
                onClick={() => {
                  // Emit a special event for Claude Code session navigation
                  const event = new CustomEvent('claude-session-selected', { 
                    detail: { session, projectPath } 
                  });
                  window.dispatchEvent(event);
                  onSessionClick?.(session);
                }}
              >
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    {/* Session header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            Session on {session.message_timestamp 
                              ? new Date(session.message_timestamp).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                              : new Date(session.created_at * 1000).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                            }
                          </p>
                        </div>
                      </div>
                      {session.todo_data && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          Todo
                        </span>
                      )}
                    </div>
                    
                    {/* First message preview */}
                    {session.first_message ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {truncateText(getFirstLine(session.first_message), 120)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic mb-2">
                        No messages yet
                      </p>
                    )}
                  </div>
                  
                  {/* Metadata footer */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-xs text-muted-foreground font-mono">
                      {session.id.slice(-8)}
                    </p>
                    {session.todo_data && (
                      <MessageSquare className="h-3 w-3 text-primary" />
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
      
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </TooltipProvider>
  );
}; 