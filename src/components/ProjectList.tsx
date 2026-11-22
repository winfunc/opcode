import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  X,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HighlightedText } from "@/components/HighlightedText";
import type { Project, SessionSearchResult } from "@/lib/api";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { truncateText, getFirstLine } from "@/lib/date-utils";
import { useDebounce } from "@/hooks/useDebounce";

interface ProjectListProps {
  /**
   * Array of projects to display
   */
  projects: Project[];
  /**
   * Callback when a project is clicked
   */
  onProjectClick: (project: Project) => void;
  /**
   * Callback when open project is clicked
   */
  onOpenProject?: () => void | Promise<void>;
  /**
   * Whether the list is currently loading
   */
  loading?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Extracts the project name from the full path
 */
const getProjectName = (path: string): string => {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
};

/**
 * Formats path to be more readable - shows full path relative to home
 * Truncates long paths with ellipsis in the middle
 */
const getDisplayPath = (path: string, maxLength: number = 30): string => {
  // Try to make path home-relative
  let displayPath = path;
  const homeIndicators = ['/Users/', '/home/'];
  for (const indicator of homeIndicators) {
    if (path.includes(indicator)) {
      const parts = path.split('/');
      const userIndex = parts.findIndex((_part, i) =>
        i > 0 && parts[i - 1] === indicator.split('/')[1]
      );
      if (userIndex > 0) {
        const relativePath = parts.slice(userIndex + 1).join('/');
        displayPath = `~/${relativePath}`;
        break;
      }
    }
  }

  // Truncate if too long
  if (displayPath.length > maxLength) {
    const start = displayPath.substring(0, Math.floor(maxLength / 2) - 2);
    const end = displayPath.substring(displayPath.length - Math.floor(maxLength / 2) + 2);
    return `${start}...${end}`;
  }

  return displayPath;
};

function formatResultDate(result: SessionSearchResult) {
  const date = result.message_timestamp
    ? new Date(result.message_timestamp)
    : new Date(result.created_at * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onProjectClick,
  onOpenProject,
  className,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalResults, setGlobalResults] = useState<SessionSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);
  const normalizedQuery = debouncedQuery.trim();
  const searchRequestId = useRef(0);

  // Client-side project name filtering
  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => {
      const name = getProjectName(p.path).toLowerCase();
      const path = p.path.toLowerCase();
      return name.includes(q) || path.includes(q);
    });
  }, [projects, searchQuery]);

  // Global session search
  useEffect(() => {
    searchRequestId.current += 1;
    if (normalizedQuery.length < 2) {
      setGlobalResults(null);
      setSearchError(null);
      setSearching(false);
      setExpandedSessions(new Set());
      return;
    }

    const requestId = searchRequestId.current;
    setSearching(true);
    setSearchError(null);

    api.searchAllSessions(normalizedQuery)
      .then((results) => {
        if (searchRequestId.current === requestId) {
          setGlobalResults(results);
          setExpandedSessions(new Set());
        }
      })
      .catch((err) => {
        console.error("Global search failed:", err);
        if (searchRequestId.current === requestId) {
          setGlobalResults(null);
          setSearchError("Search failed. Please try again.");
        }
      })
      .finally(() => {
        if (searchRequestId.current === requestId) {
          setSearching(false);
        }
      });
  }, [normalizedQuery]);

  // Group global results by project
  const groupedResults = useMemo(() => {
    if (!globalResults) return null;
    const groups: Map<string, { projectPath: string; results: SessionSearchResult[] }> = new Map();
    for (const result of globalResults) {
      const key = result.project_id;
      if (!groups.has(key)) {
        groups.set(key, { projectPath: result.project_path, results: [] });
      }
      groups.get(key)!.results.push(result);
    }
    return groups;
  }, [globalResults]);

  // Determine how many projects to show
  const projectsPerPage = showAll ? 10 : 5;
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);

  // Calculate which projects to display
  const startIndex = showAll ? (currentPage - 1) * projectsPerPage : 0;
  const endIndex = startIndex + projectsPerPage;
  const displayedProjects = filteredProjects.slice(startIndex, endIndex);

  const handleViewAll = () => {
    setShowAll(true);
    setCurrentPage(1);
  };

  const handleViewLess = () => {
    setShowAll(false);
    setCurrentPage(1);
  };

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setGlobalResults(null);
    setSearchError(null);
    setExpandedSessions(new Set());
  }, []);

  const toggleExpanded = useCallback((sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const copyResumeCommand = useCallback((sessionId: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(`claude --resume ${sessionId}`)
      .then(() => {
        setCopiedId(sessionId);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch((err) => console.error("Failed to copy:", err));
  }, []);

  const handleOpenSession = useCallback((result: SessionSearchResult) => {
    // Find the matching project and navigate into it, then select the session
    const project = projects.find(p => p.id === result.project_id);
    if (project) {
      onProjectClick(project);
      // After navigating to the project, select the session via CustomEvent
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('claude-session-selected', {
          detail: {
            session: {
              id: result.id,
              project_id: result.project_id,
              project_path: result.project_path,
              created_at: result.created_at,
              first_message: result.first_message,
              message_timestamp: result.message_timestamp,
              todo_data: result.todo_data,
            },
            projectPath: result.project_path,
          }
        }));
      }, 100);
    }
  }, [projects, onProjectClick]);

  const isSearchActive = searchQuery.trim().length > 0;
  const hasGlobalResults = globalResults !== null && globalResults.length > 0;

  return (
    <div className={cn("h-full overflow-y-auto", className)}>
      <div className="max-w-6xl mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Projects</h1>
              <p className="mt-1 text-body-small text-muted-foreground">
                Select a project to start working with Claude Code
              </p>
            </div>
            <motion.div
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                onClick={onOpenProject}
                size="default"
                className="flex items-center gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                Open Project
              </Button>
            </motion.div>
          </div>

          {/* Search bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects and sessions..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Search projects and sessions"
              className="pl-9 pr-9 h-9"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Projects section */}
          {displayedProjects.length > 0 ? (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-heading-4">
                  {isSearchActive ? `Projects matching "${searchQuery.trim()}"` : "Recent Projects"}
                </h2>
                {!isSearchActive && (
                  !showAll ? (
                    <button
                      onClick={handleViewAll}
                      className="text-caption text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View all ({projects.length})
                    </button>
                  ) : (
                    <button
                      onClick={handleViewLess}
                      className="text-caption text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View less
                    </button>
                  )
                )}
              </div>

              <div className="space-y-1">
                {displayedProjects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.15,
                      delay: index * 0.02,
                    }}
                    className="group"
                  >
                    <motion.button
                      onClick={() => onProjectClick(project)}
                      whileTap={{ scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/50 transition-colors flex items-center justify-between"
                    >
                      <span className="text-body-small font-medium">
                        {getProjectName(project.path)}
                      </span>
                      <span className="text-caption text-muted-foreground font-mono text-right" style={{ minWidth: '200px' }}>
                        {getDisplayPath(project.path, 35)}
                      </span>
                    </motion.button>
                  </motion.div>
                ))}
              </div>

              {/* Pagination controls */}
              {!isSearchActive && showAll && totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <motion.div
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </motion.div>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>

                  <motion.div
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </motion.div>
                </div>
              )}
            </Card>
          ) : isSearchActive ? (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">No projects matching "{searchQuery.trim()}"</p>
            </Card>
          ) : (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <FolderOpen className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-heading-3 mb-2">No recent projects</h3>
                <p className="text-body-small text-muted-foreground mb-6">
                  Open a project to get started with Claude Code
                </p>
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    onClick={onOpenProject}
                    size="default"
                    className="flex items-center gap-2"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Open Your First Project
                  </Button>
                </motion.div>
              </div>
            </Card>
          )}

          {/* Global session search results */}
          {isSearchActive && (
            <div>
              <div aria-live="polite" aria-atomic="true" className="mb-3">
                {searching && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching sessions across all projects...
                  </div>
                )}
                {searchError && !searching && (
                  <p className="text-sm text-destructive">{searchError}</p>
                )}
                {globalResults !== null && !searching && !searchError && (
                  <p className="text-sm text-muted-foreground">
                    {globalResults.length === 0
                      ? "No sessions found across projects"
                      : `Sessions matching "${normalizedQuery}" — ${globalResults.length} result${globalResults.length !== 1 ? 's' : ''}`}
                  </p>
                )}
              </div>

              {hasGlobalResults && groupedResults && (
                <div className="space-y-4">
                  {Array.from(groupedResults.entries()).map(([projectId, group]) => (
                    <Card key={projectId} className="p-4">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <FolderOpen className="h-3.5 w-3.5" />
                        {getProjectName(group.projectPath)}
                        <span className="text-caption font-mono">{getDisplayPath(group.projectPath, 40)}</span>
                      </h3>
                      <div className="space-y-2">
                        {group.results.map((result) => {
                          const snippets = result.snippets || [];
                          const isExpanded = expandedSessions.has(result.id);

                          return (
                            <div key={result.id} className="border rounded-lg">
                              {/* Accordion header */}
                              <div className="flex items-center gap-3 p-3 hover:bg-accent/50 rounded-t-lg">
                                <button
                                  type="button"
                                  className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                                  onClick={() => toggleExpanded(result.id)}
                                  aria-expanded={isExpanded}
                                  aria-controls={`global-snippets-${result.id}`}
                                >
                                  <ChevronDown className={cn(
                                    "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                                    isExpanded && "rotate-180"
                                  )} />
                                  <Clock className="h-4 w-4 text-primary shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-body-small font-medium">
                                        Session on {formatResultDate(result)}
                                      </p>
                                      <span className="text-caption text-muted-foreground font-mono ml-auto">
                                        {result.id.slice(-8)}
                                      </span>
                                    </div>
                                    {result.first_message && (
                                      <p className="text-caption text-muted-foreground line-clamp-1 mt-0.5">
                                        {truncateText(getFirstLine(result.first_message), 120)}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-caption text-muted-foreground shrink-0">
                                    {snippets.length} match{snippets.length !== 1 ? 'es' : ''}
                                  </span>
                                </button>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    title="Open session"
                                    aria-label="Open session"
                                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => handleOpenSession(result)}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Copy resume command"
                                    aria-label="Copy resume command"
                                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => copyResumeCommand(result.id)}
                                  >
                                    {copiedId === result.id
                                      ? <Check className="h-3.5 w-3.5 text-green-500" />
                                      : <Copy className="h-3.5 w-3.5" />
                                    }
                                  </button>
                                </div>
                              </div>

                              {/* Accordion content */}
                              <AnimatePresence>
                                {isExpanded && snippets.length > 0 && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div id={`global-snippets-${result.id}`} className="border-t px-3 pb-3">
                                      <div className="max-h-60 overflow-y-auto mt-2 space-y-2">
                                        {snippets.map((snippet, i) => (
                                          <div
                                            key={i}
                                            className="text-xs text-muted-foreground bg-muted/50 rounded p-2 leading-relaxed"
                                          >
                                            <HighlightedText text={snippet} terms={result.highlight_terms ?? [normalizedQuery]} />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
