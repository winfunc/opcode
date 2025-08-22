import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ArrowLeft, Calendar, Clock, MessageSquare, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ClaudeMemoriesDropdown } from "@/components/ClaudeMemoriesDropdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  formatUnixTimestamp,
  formatISOTimestamp,
  truncateText,
  getFirstLine,
} from "@/lib/date-utils";
import { useI18n } from "@/lib/i18n";
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
   * The current project ID
   */
  projectId: string;
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
   * Callback when a session is deleted
   */
  onSessionDeleted?: (sessionId: string) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

const ITEMS_PER_PAGE = 5;

/**
 * SessionList component - Displays paginated sessions for a specific project
 *
 * A comprehensive session listing interface with pagination, animations, and
 * session management features. Shows session metadata including timestamps,
 * first message previews, and todo indicators with smooth hover effects.
 *
 * @param sessions - Array of sessions to display
 * @param projectPath - The current project path being viewed
 * @param onBack - Callback to go back to project list
 * @param onSessionClick - Callback when a session is clicked
 * @param onEditClaudeFile - Callback when a CLAUDE.md file should be edited
 * @param className - Optional className for styling
 *
 * @example
 * ```tsx
 * <SessionList
 *   sessions={projectSessions}
 *   projectPath="/Users/example/project"
 *   onBack={() => setSelectedProject(null)}
 *   onSessionClick={(session) => {
 *     console.log('Opening session:', session.id);
 *     openSession(session);
 *   }}
 *   onEditClaudeFile={(file) => {
 *     setEditingFile(file);
 *     setShowEditor(true);
 *   }}
 * />
 * ```
 */
export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  projectPath,
  projectId,
  onBack,
  onSessionClick,
  onEditClaudeFile,
  onSessionDeleted,
  className,
}) => {
  const { t } = useI18n();
  const [currentPage, setCurrentPage] = useState(1);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Calculate pagination
  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSessions = sessions.slice(startIndex, endIndex);

  // Reset to page 1 if sessions change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [sessions.length]);

  // Handle session deletion
  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;

    setIsDeleting(true);
    try {
      // Import the API to use deleteSession
      const { api } = await import("@/lib/api");
      
      // Check if the session is currently running and stop it if needed
      try {
        const runningSessions = await api.listRunningClaudeSessions();
        const runningSession = runningSessions.find((s: any) => s.session_id === sessionToDelete.id);
        
        if (runningSession) {
          // Cancel the running session first
          await api.cancelClaudeExecution(sessionToDelete.id);
          // Wait a bit for the cancellation to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (runningCheckError) {
        console.warn("Could not check/stop running session:", runningCheckError);
        // Continue with deletion anyway
      }
      
      // Delete the session
      await api.deleteSession(sessionToDelete.id, projectId);
      onSessionDeleted?.(sessionToDelete.id);
    } catch (error) {
      console.error("Failed to delete session:", error);
      // You might want to show a toast notification here
    } finally {
      setIsDeleting(false);
      setSessionToDelete(null);
    }
  };

  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent, session: Session) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent session click
    setSessionToDelete(session);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center space-x-3"
      >
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-medium truncate">{projectPath}</h2>
          <p className="text-xs text-muted-foreground">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
      </motion.div>

      {/* CLAUDE.md Memories Dropdown */}
      {onEditClaudeFile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <ClaudeMemoriesDropdown projectPath={projectPath} onEditFile={onEditClaudeFile} />
        </motion.div>
      )}

      <AnimatePresence mode="popLayout">
        <div className="space-y-2">
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
                  "transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer",
                  session.todo_data ? "border-l-4 border-l-primary" : ""
                )}
                onClick={(e) => {
                  // Check if the click target is within the delete button area
                  const target = e.target as HTMLElement;
                  const deleteButton = target.closest('[data-delete-button="true"]');
                  
                  // If clicked on delete button area, don't trigger session click
                  if (deleteButton) {
                    return;
                  }
                  
                  // Only call the onSessionClick callback, don't emit the event
                  // The event is used by RunningClaudeSessions, not SessionList
                  onSessionClick?.(session);
                }}
              >
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="font-mono text-xs text-muted-foreground">{session.id}</p>

                          {/* First message preview */}
                          {session.first_message && (
                            <div className="space-y-1">
                              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                <MessageSquare className="h-3 w-3" />
                                <span>First message:</span>
                              </div>
                              <p className="text-xs line-clamp-2 text-foreground/80">
                                {truncateText(getFirstLine(session.first_message), 100)}
                              </p>
                            </div>
                          )}

                          {/* Metadata */}
                          <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                            {/* Message timestamp if available, otherwise file creation time */}
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {session.message_timestamp
                                  ? formatISOTimestamp(session.message_timestamp)
                                  : formatUnixTimestamp(session.created_at)}
                              </span>
                            </div>

                            {session.todo_data ? (
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>Has todo</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      
                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10 relative"
                        onClick={(e) => handleDeleteClick(e, session)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        data-delete-button="true"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!sessionToDelete} onOpenChange={(open) => {
        if (!open) {
          setSessionToDelete(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.sessions.deleteSessionConfirm}</DialogTitle>
            <DialogDescription className="space-y-2">
              <div>
                {t.sessions.deleteSessionDesc.replace("{sessionId}", sessionToDelete?.id || "")}
              </div>
              {sessionToDelete?.first_message && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  <span className="font-medium">First message:</span> {truncateText(getFirstLine(sessionToDelete.first_message), 80)}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionToDelete(null)} disabled={isDeleting}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDeleteSession} disabled={isDeleting}>
              {isDeleting ? t.sessions.deletingSession : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
