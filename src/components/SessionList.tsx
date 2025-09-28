import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, MessageSquare, Trash2, CheckSquare, Square, Trash, ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { ClaudeMemoriesDropdown } from "@/components/ClaudeMemoriesDropdown";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { truncateText, getFirstLine } from "@/lib/date-utils";
import { api } from "@/lib/api";
import type { Session, ClaudeMdFile } from "@/lib/api";
import { SessionPersistenceService } from "@/services/sessionPersistence";

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
   * Optional callback to go back to project list (deprecated - use tabs instead)
   */
  onBack?: () => void;
  /**
   * Callback when a session is clicked
   */
  onSessionClick?: (session: Session) => void;
  /**
   * Callback when a session is deleted
   */
  onSessionDelete?: (sessionId: string) => void;
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

interface HierarchicalSession {
  session: Session;
  children: Session[];
  isPrimary: boolean;
  isExpanded?: boolean;
}

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
  onSessionClick,
  onSessionDelete,
  onEditClaudeFile,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  // Process sessions into hierarchical structure
  const hierarchicalSessions = useMemo(() => {
    const sessionMap = new Map<string, Session>();
    const primarySessions: HierarchicalSession[] = [];
    const childSessionsMap = new Map<string, Session[]>();

    // Create session map and identify primary sessions
    sessions.forEach(session => {
      sessionMap.set(session.id, session);

      // Try to get persistence data to identify primary vs child
      const persistenceData = SessionPersistenceService.loadSession(session.id);

      if (persistenceData?.isConversationRoot || !persistenceData?.primaryConversationId) {
        // This is a primary session
        const hierarchicalSession: HierarchicalSession = {
          session,
          children: [],
          isPrimary: true,
          isExpanded: expandedSessions.has(session.id)
        };
        primarySessions.push(hierarchicalSession);
        childSessionsMap.set(session.id, []);
      }
    });

    // Group child sessions under their primary sessions
    sessions.forEach(session => {
      const persistenceData = SessionPersistenceService.loadSession(session.id);

      if (persistenceData?.primaryConversationId && !persistenceData.isConversationRoot) {
        // This is a child session
        const primaryId = persistenceData.primaryConversationId;
        const children = childSessionsMap.get(primaryId);
        if (children) {
          children.push(session);
        }
      }
    });

    // Add children to their primary sessions and sort by timestamp
    primarySessions.forEach(primarySession => {
      const children = childSessionsMap.get(primarySession.session.id) || [];
      primarySession.children = children.sort((a, b) => {
        const timeA = a.message_timestamp ? new Date(a.message_timestamp).getTime() : a.created_at * 1000;
        const timeB = b.message_timestamp ? new Date(b.message_timestamp).getTime() : b.created_at * 1000;
        return timeB - timeA; // Sort descending (latest first)
      });
    });

    // Sort primary sessions by most recent activity (primary or child)
    return primarySessions.sort((a, b) => {
      const getLatestTime = (hs: HierarchicalSession) => {
        const primaryTime = hs.session.message_timestamp ? new Date(hs.session.message_timestamp).getTime() : hs.session.created_at * 1000;
        const childTimes = hs.children.map(child => child.message_timestamp ? new Date(child.message_timestamp).getTime() : child.created_at * 1000);
        return Math.max(primaryTime, ...childTimes);
      };

      return getLatestTime(b) - getLatestTime(a); // Sort descending (most recent first)
    });
  }, [sessions, expandedSessions]);

  // Calculate pagination based on hierarchical sessions
  const totalPages = Math.ceil(hierarchicalSessions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentHierarchicalSessions = hierarchicalSessions.slice(startIndex, endIndex);

  // Function to toggle expand/collapse for primary sessions
  const toggleSessionExpansion = (sessionId: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };
  
  // Reset to page 1 if sessions change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [hierarchicalSessions.length]);

  // Multi-select helper functions
  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const selectAllSessions = () => {
    const allSessionIds: string[] = [];
    currentHierarchicalSessions.forEach(hs => {
      allSessionIds.push(hs.session.id);
      allSessionIds.push(...hs.children.map(child => child.id));
    });
    setSelectedSessions(new Set(allSessionIds));
  };

  const clearAllSelections = () => {
    setSelectedSessions(new Set());
  };

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedSessions(new Set());
  };

  // Check if all current sessions are selected
  const allCurrentSessionsSelected = (() => {
    const allSessionIds: string[] = [];
    currentHierarchicalSessions.forEach(hs => {
      allSessionIds.push(hs.session.id);
      allSessionIds.push(...hs.children.map(child => child.id));
    });
    return allSessionIds.length > 0 && allSessionIds.every(id => selectedSessions.has(id));
  })();

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedSessions.size === 0) return;

    const sessionIds = Array.from(selectedSessions);
    const projectId = currentHierarchicalSessions[0]?.session.project_id;

    if (!projectId) {
      alert('Unable to determine project ID');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${sessionIds.length} session${sessionIds.length > 1 ? 's' : ''}?\n\nThis action cannot be undone.`;

    if (!(await window.confirm(confirmMessage))) {
      return;
    }

    try {
      await api.deleteSessionsBulk(sessionIds, projectId);

      // Clean up session persistence data for each deleted session
      sessionIds.forEach(sessionId => {
        SessionPersistenceService.removeSession(sessionId);
        onSessionDelete?.(sessionId);
      });

      // Clear selections and exit multi-select mode
      setSelectedSessions(new Set());
      setIsMultiSelectMode(false);
    } catch (error) {
      console.error('Failed to bulk delete sessions:', error);
      alert('Failed to delete sessions. Please try again.');
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, session: Session) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent session click when delete button is clicked

    // Add a small delay to ensure the UI is stable
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if this is a primary session with children
    const persistenceData = SessionPersistenceService.loadSession(session.id);
    const isPrimary = persistenceData?.isConversationRoot;
    const children = isPrimary ? SessionPersistenceService.getConversationSessions(session.id).filter(id => id !== session.id) : [];

    let confirmMessage = `Are you sure you want to delete this session?\n\nSession: ${session.id.slice(-8)}\nDate: ${session.message_timestamp
      ? new Date(session.message_timestamp).toLocaleDateString()
      : new Date(session.created_at * 1000).toLocaleDateString()}`;

    if (isPrimary && children.length > 0) {
      confirmMessage += `\n\nThis is a primary session with ${children.length} child session${children.length > 1 ? 's' : ''}. Deleting it will also delete all child sessions.`;
    }

    confirmMessage += `\n\nThis action cannot be undone.`;

    // Use a more explicit confirmation approach
    const confirmed = await window.confirm(confirmMessage);
    console.log('Delete confirmation result:', confirmed);

    if (!confirmed) {
      console.log('User cancelled deletion');
      return;
    }

    console.log('Proceeding with deletion of session:', session.id);

    try {
      // If primary session, delete all child sessions first
      if (isPrimary && children.length > 0) {
        for (const childId of children) {
          await api.deleteSession(childId, session.project_id);
          SessionPersistenceService.removeSession(childId);
          onSessionDelete?.(childId);
        }
      }

      // Delete the main session
      await api.deleteSession(session.id, session.project_id);

      // Clean up session persistence data
      SessionPersistenceService.removeSession(session.id);

      onSessionDelete?.(session.id);
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session. Please try again.');
    }
  };
  
  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
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

      {/* Multi-select toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant={isMultiSelectMode ? "default" : "outline"}
            size="sm"
            onClick={toggleMultiSelectMode}
          >
            {isMultiSelectMode ? "Exit Select" : "Select Multiple"}
          </Button>

          {isMultiSelectMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={allCurrentSessionsSelected ? clearAllSelections : selectAllSessions}
              >
                {allCurrentSessionsSelected ? (
                  <>
                    <Square className="h-3 w-3 mr-1" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3 w-3 mr-1" />
                    Select All
                  </>
                )}
              </Button>

              {selectedSessions.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash className="h-3 w-3 mr-1" />
                  Delete Selected ({selectedSessions.size})
                </Button>
              )}
            </>
          )}
        </div>

        {isMultiSelectMode && selectedSessions.size > 0 && (
          <span className="text-sm text-muted-foreground">
            {selectedSessions.size} session{selectedSessions.size > 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        <div className="space-y-4">
          {currentHierarchicalSessions.map((hierarchicalSession, index) => {
            const { session, children } = hierarchicalSession;
            const isExpanded = expandedSessions.has(session.id);
            const hasChildren = children.length > 0;

            return (
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
                className="space-y-2"
              >
                {/* Primary Session Card */}
                <Card
                  className={cn(
                    "p-3 hover:bg-accent/50 transition-all duration-200 cursor-pointer group",
                    session.todo_data && "bg-primary/5",
                    isMultiSelectMode && selectedSessions.has(session.id) && "bg-primary/10 border-primary",
                    hasChildren && "border-l-4 border-l-blue-500/30"
                  )}
                  onClick={() => {
                    if (isMultiSelectMode) {
                      toggleSessionSelection(session.id);
                    } else if (hasChildren) {
                      // Primary sessions with children expand/collapse on click
                      toggleSessionExpansion(session.id);
                    } else {
                      // Primary sessions without children open directly
                      const event = new CustomEvent('claude-session-selected', {
                        detail: { session, projectPath }
                      });
                      window.dispatchEvent(event);
                      onSessionClick?.(session);
                    }
                  }}
                >
                  <div className="flex flex-col">
                    {/* Primary Session Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {/* Folder icon and expand/collapse for sessions with children */}
                        {hasChildren ? (
                          <div className="flex items-center gap-1">
                            {isExpanded ? (
                              <>
                                <FolderOpen className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                              </>
                            ) : (
                              <>
                                <Folder className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                              </>
                            )}
                          </div>
                        ) : (
                          <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-body-small font-medium">
                              {hasChildren ? 'Conversation' : 'Session'} on {session.message_timestamp
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
                            {hasChildren && (
                              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {children.length + 1} session{children.length + 1 > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {session.todo_data && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-caption font-medium bg-primary/10 text-primary">
                            Todo
                          </span>
                        )}

                        {/* Multi-select checkbox */}
                        {isMultiSelectMode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-100 hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSessionSelection(session.id);
                            }}
                            title={selectedSessions.has(session.id) ? "Deselect session" : "Select session"}
                          >
                            {selectedSessions.has(session.id) ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </Button>
                        )}

                        {/* Delete button (hidden in multi-select mode) */}
                        {!isMultiSelectMode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => handleDeleteSession(e, session)}
                            title="Delete session"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* First message preview */}
                    {session.first_message ? (
                      <p className="text-caption text-muted-foreground line-clamp-2 mb-2">
                        {truncateText(getFirstLine(session.first_message), 120)}
                      </p>
                    ) : (
                      <p className="text-caption text-muted-foreground/60 italic mb-2">
                        No messages yet
                      </p>
                    )}

                    {/* Metadata footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <p className="text-caption text-muted-foreground font-mono">
                        {session.id.slice(-8)}
                      </p>
                      {session.todo_data && (
                        <MessageSquare className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </div>
                </Card>

                {/* Child Sessions */}
                {hasChildren && isExpanded && (
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="ml-8 space-y-2"
                    >
                      {children.map((childSession, childIndex) => (
                        <motion.div
                          key={childSession.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: childIndex * 0.05 }}
                        >
                          <Card
                            className={cn(
                              "p-3 hover:bg-accent/30 transition-all duration-200 cursor-pointer group border-l-2 border-l-muted-foreground/20",
                              childSession.todo_data && "bg-primary/5",
                              isMultiSelectMode && selectedSessions.has(childSession.id) && "bg-primary/10 border-primary"
                            )}
                            onClick={() => {
                              if (isMultiSelectMode) {
                                toggleSessionSelection(childSession.id);
                              } else {
                                const event = new CustomEvent('claude-session-selected', {
                                  detail: { session: childSession, projectPath }
                                });
                                window.dispatchEvent(event);
                                onSessionClick?.(childSession);
                              }
                            }}
                          >
                            <div className="flex flex-col">
                              {/* Child Session Header */}
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground text-xs">└─</span>
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">
                                      {childSession.message_timestamp
                                        ? new Date(childSession.message_timestamp).toLocaleTimeString('en-US', {
                                            hour: 'numeric',
                                            minute: '2-digit'
                                          })
                                        : new Date(childSession.created_at * 1000).toLocaleTimeString('en-US', {
                                            hour: 'numeric',
                                            minute: '2-digit'
                                          })
                                      }
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Latest session indicator */}
                                  {childIndex === 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/20">
                                      Latest
                                    </span>
                                  )}

                                  {childSession.todo_data && (
                                    <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                                      Todo
                                    </span>
                                  )}

                                  {/* Multi-select checkbox */}
                                  {isMultiSelectMode && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 opacity-100 hover:bg-primary/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSessionSelection(childSession.id);
                                      }}
                                      title={selectedSessions.has(childSession.id) ? "Deselect session" : "Select session"}
                                    >
                                      {selectedSessions.has(childSession.id) ? (
                                        <CheckSquare className="h-3.5 w-3.5 text-primary" />
                                      ) : (
                                        <Square className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  )}

                                  {/* Delete button (hidden in multi-select mode) */}
                                  {!isMultiSelectMode && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                                      onClick={(e) => handleDeleteSession(e, childSession)}
                                      title="Delete session"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Child Session Message Preview */}
                              {childSession.first_message && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                                  {truncateText(getFirstLine(childSession.first_message), 100)}
                                </p>
                              )}

                              {/* Child Session Footer */}
                              <div className="flex items-center justify-between pt-1 border-t border-muted-foreground/10">
                                <p className="text-xs text-muted-foreground font-mono">
                                  {childSession.id.slice(-8)}
                                </p>
                                {childSession.todo_data && (
                                  <MessageSquare className="h-3 w-3 text-primary" />
                                )}
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                )}
              </motion.div>
            );
          })}
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