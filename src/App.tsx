import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, Bot, FolderCode } from "lucide-react";
import { api, type Project, type Session, type ClaudeMdFile } from "@/lib/api";
import { OutputCacheProvider } from "@/lib/outputCache";
import { useI18n } from "@/lib/i18n";
import { TabProvider } from "@/contexts/TabContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProjectList } from "@/components/ProjectList";
import { SessionList } from "@/components/SessionList";
import { RunningClaudeSessions } from "@/components/RunningClaudeSessions";
import { Topbar } from "@/components/Topbar";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { ClaudeFileEditor } from "@/components/ClaudeFileEditor";
import { Settings } from "@/components/Settings";
import { CCAgents } from "@/components/CCAgents";
import { UsageDashboard } from "@/components/UsageDashboard";
import { MCPManager } from "@/components/MCPManager";
import { NFOCredits } from "@/components/NFOCredits";
import { ClaudeBinaryDialog } from "@/components/ClaudeBinaryDialog";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { ProjectSettings } from "@/components/ProjectSettings";
import { TabManager } from "@/components/TabManager";
import { TabContent } from "@/components/TabContent";
import { AgentsModal } from "@/components/AgentsModal";
import { useTabState } from "@/hooks/useTabState";
import { ToastProvider } from "@/contexts/ToastContext";
import { handleApiError } from "@/lib/errorHandler";
import { logger } from "@/lib/logger";
import { audioNotificationManager, loadAudioConfigFromLocalStorage } from "@/lib/audioNotification";
import { AnalyticsConsentBanner } from "@/components/AnalyticsConsent";
import { useAppLifecycle, useTrackEvent } from "@/hooks";

type View =
  | "welcome"
  | "projects"
  | "editor"
  | "claude-file-editor"
  | "settings"
  | "cc-agents"
  | "create-agent"
  | "github-agents"
  | "agent-execution"
  | "agent-run-view"
  | "mcp"
  | "usage-dashboard"
  | "project-settings"
  | "tabs"; // New view for tab-based interface

/**
 * AppContent component - Contains the main app logic, wrapped by providers
 *
 * The main application component that manages global state, routing, and
 * provides the core user interface. Handles project management, session
 * navigation, settings, and various application views with comprehensive
 * error handling and loading states.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ToastProvider>
 *       <OutputCacheProvider>
 *         <TabProvider>
 *           <AppContent />
 *         </TabProvider>
 *       </OutputCacheProvider>
 *     </ToastProvider>
 *   );
 * }
 * ```
 */
function AppContent() {
  const { t } = useI18n();
  const [view, setView] = useState<View>("tabs");
  const { createClaudeMdTab, createSettingsTab, createUsageTab, createMCPTab } = useTabState();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editingClaudeFile, setEditingClaudeFile] = useState<ClaudeMdFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNFO, setShowNFO] = useState(false);
  const [showClaudeBinaryDialog, setShowClaudeBinaryDialog] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [projectForSettings, setProjectForSettings] = useState<Project | null>(null);
  const [previousView] = useState<View>("welcome");
  const [showAgentsModal, setShowAgentsModal] = useState(false);

  // Initialize analytics lifecycle tracking
  useAppLifecycle();
  const trackEvent = useTrackEvent();

  // Track user journey milestones
  const [hasTrackedFirstChat] = useState(false);
  // const [hasTrackedFirstAgent] = useState(false);

  // Track when user reaches different journey stages
  useEffect(() => {
    if (view === "projects" && projects.length > 0 && !hasTrackedFirstChat) {
      // User has projects - they're past onboarding
      trackEvent.journeyMilestone({
        journey_stage: 'onboarding',
        milestone_reached: 'projects_created',
        time_to_milestone_ms: Date.now() - performance.timing.navigationStart
      });
    }
  }, [view, projects.length, hasTrackedFirstChat, trackEvent]);

  // Initialize audio notification manager on app start
  useEffect(() => {
    const initializeAudioNotifications = () => {
      try {
        // Load audio config from localStorage (independent of Claude settings)
        const audioConfig = loadAudioConfigFromLocalStorage();
        audioNotificationManager.setConfig(audioConfig);
        logger.debug("Audio notifications initialized:", audioConfig);
      } catch (error) {
        // Silently fail if config can't be loaded - use default config
        logger.warn("Failed to load audio notification settings:", error);
      }
    };

    initializeAudioNotifications();
  }, []);

  // Load projects on mount when in projects view
  /**
   * Loads all projects from the ~/.claude/projects directory
   */
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await api.listProjects();
      setProjects(projectList);
    } catch (err) {
      await handleApiError(err as Error, { operation: "loadProjects", component: "App" });
      setError(t.messages.failedToLoadProjects);
    } finally {
      setLoading(false);
    }
  }, [t.messages.failedToLoadProjects]);

  useEffect(() => {
    if (view === "projects") {
      loadProjects();
    } else if (view === "welcome") {
      // Reset loading state for welcome view
      setLoading(false);
    }
  }, [view, loadProjects]);

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    if (view !== "tabs") return;

    /**
     * Handle global keyboard shortcuts
     *
     * @param e - Keyboard event
     */
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey) {
        switch (e.key) {
          case "t":
            e.preventDefault();
            window.dispatchEvent(new globalThis.CustomEvent("create-chat-tab"));
            break;
          case "w":
            e.preventDefault();
            window.dispatchEvent(new globalThis.CustomEvent("close-current-tab"));
            break;
          case "Tab":
            e.preventDefault();
            if (e.shiftKey) {
              window.dispatchEvent(new globalThis.CustomEvent("switch-to-previous-tab"));
            } else {
              window.dispatchEvent(new globalThis.CustomEvent("switch-to-next-tab"));
            }
            break;
          default:
            // Handle number keys 1-9
            if (e.key >= "1" && e.key <= "9") {
              e.preventDefault();
              const index = parseInt(e.key) - 1;
              window.dispatchEvent(
                new globalThis.CustomEvent("switch-to-tab-by-index", { detail: { index } })
              );
            }
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view]);

  // Listen for Claude not found events
  useEffect(() => {
    /**
     * Handle Claude binary not found scenario
     */
    const handleClaudeNotFound = () => {
      setShowClaudeBinaryDialog(true);
    };

    window.addEventListener("claude-not-found", handleClaudeNotFound as globalThis.EventListener);
    return () => {
      window.removeEventListener(
        "claude-not-found",
        handleClaudeNotFound as globalThis.EventListener
      );
    };
  }, []);

  /**
   * Handles project selection and loads its sessions
   */
  const handleProjectClick = async (project: Project) => {
    try {
      setLoading(true);
      setError(null);
      const sessionList = await api.getProjectSessions(project.id);
      setSessions(sessionList);
      setSelectedProject(project);
    } catch (err) {
      await handleApiError(err as Error, { operation: "loadSessions", component: "App" });
      setError(t.messages.failedToLoadSessions);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Opens a new Claude Code session in the interactive UI
   */
  const handleNewSession = async () => {
    handleViewChange("tabs");
    // The tab system will handle creating a new chat tab
  };

  /**
   * Returns to project list view
   */
  /**
   * Handle back navigation to main view
   */
  const handleBack = () => {
    setSelectedProject(null);
    setSessions([]);
  };

  /**
   * Handles editing a CLAUDE.md file from a project
   */
  /**
   * Handle editing a CLAUDE.md file
   *
   * @param file - Claude markdown file to edit
   */
  const handleEditClaudeFile = (file: ClaudeMdFile) => {
    setEditingClaudeFile(file);
    handleViewChange("claude-file-editor");
  };

  /**
   * Returns from CLAUDE.md file editor to projects view
   */
  /**
   * Handle back navigation from Claude file editor
   */
  const handleBackFromClaudeFileEditor = () => {
    setEditingClaudeFile(null);
    handleViewChange("projects");
  };

  /**
   * Handles view changes with navigation protection
   */
  /**
   * Handle view change navigation
   *
   * @param newView - New view to navigate to
   */
  const handleViewChange = (newView: View) => {
    // No need for navigation protection with tabs since sessions stay open
    setView(newView);
  };

  /**
   * Handles navigating to hooks configuration
   */
  const handleProjectSettings = (project: Project) => {
    setProjectForSettings(project);
    handleViewChange("project-settings");
  };

  /**
   * Render the main application content based on current view state
   *
   * @returns JSX element for the current view
   */
  const renderContent = () => {
    switch (view) {
      case "welcome":
        return (
          <div className="flex items-center justify-center p-4" style={{ height: "100%" }}>
            <div className="w-full max-w-4xl">
              {/* Welcome Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-12 text-center"
              >
                <h1 className="text-4xl font-bold tracking-tight">
                  <span className="rotating-symbol"></span>
                  {t.app.welcomeTitle}
                </h1>
              </motion.div>

              {/* Navigation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                {/* CC Agents Card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <Card
                    className="h-64 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg border border-border/50 shimmer-hover trailing-border"
                    onClick={() => handleViewChange("cc-agents")}
                  >
                    <div className="h-full flex flex-col items-center justify-center p-8">
                      <Bot className="h-16 w-16 mb-4 text-primary" />
                      <h2 className="text-xl font-semibold">{t.app.ccAgents}</h2>
                    </div>
                  </Card>
                </motion.div>

                {/* CC Projects Card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Card
                    className="h-64 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg border border-border/50 shimmer-hover trailing-border"
                    onClick={() => handleViewChange("projects")}
                  >
                    <div className="h-full flex flex-col items-center justify-center p-8">
                      <FolderCode className="h-16 w-16 mb-4 text-primary" />
                      <h2 className="text-xl font-semibold">{t.app.ccProjects}</h2>
                    </div>
                  </Card>
                </motion.div>
              </div>
            </div>
          </div>
        );

      case "cc-agents":
        return <CCAgents onBack={() => handleViewChange("welcome")} />;

      case "editor":
        return (
          <div className="flex-1 overflow-hidden">
            <MarkdownEditor onBack={() => handleViewChange("welcome")} />
          </div>
        );

      case "settings":
        return (
          <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            <Settings onBack={() => handleViewChange("welcome")} />
          </div>
        );

      case "projects":
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6">
              {/* Header with back button */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-6"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewChange("welcome")}
                  className="mb-4"
                >
                  ← {t.app.backToHome}
                </Button>
                <div className="mb-4">
                  <h1 className="text-3xl font-bold tracking-tight">{t.projects.title}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{t.projects.subtitle}</p>
                </div>
              </motion.div>

              {/* Error display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive max-w-2xl"
                >
                  {error}
                </motion.div>
              )}

              {/* Loading state */}
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Content */}
              {!loading && (
                <AnimatePresence mode="wait">
                  {selectedProject ? (
                    <motion.div
                      key="sessions"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <SessionList
                        sessions={sessions}
                        projectPath={selectedProject.path}
                        projectId={selectedProject.id}
                        onBack={handleBack}
                        onEditClaudeFile={handleEditClaudeFile}
                        onSessionDeleted={async (sessionId) => {
                          // Remove the deleted session from the local state
                          setSessions(prev => prev.filter(s => s.id !== sessionId));
                          
                          // Check if this was the last session in the project
                          const remainingSessions = sessions.filter(s => s.id !== sessionId);
                          if (remainingSessions.length === 0) {
                            // If no sessions remain, remove the project from the projects list
                            setProjects(prev => prev.filter(p => p.id !== selectedProject.id));
                            // Go back to projects view
                            handleBack();
                          }
                        }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="projects"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* New session button at the top */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-4"
                      >
                        <Button
                          onClick={handleNewSession}
                          size="default"
                          className="w-full max-w-md"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {t.projects.newClaudeCodeSession}
                        </Button>
                      </motion.div>

                      {/* Running Claude Sessions */}
                      <RunningClaudeSessions />

                      {/* Project list */}
                      {projects.length > 0 ? (
                        <ProjectList
                          projects={projects}
                          onProjectClick={handleProjectClick}
                          onProjectSettings={handleProjectSettings}
                          loading={loading}
                          className="animate-fade-in"
                        />
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-sm text-muted-foreground">{t.projects.noProjects}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>
        );

      case "claude-file-editor":
        return editingClaudeFile ? (
          <ClaudeFileEditor file={editingClaudeFile} onBack={handleBackFromClaudeFileEditor} />
        ) : null;

      case "tabs":
        return (
          <div className="h-full flex flex-col">
            <TabManager className="flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
              <TabContent />
            </div>
          </div>
        );

      case "usage-dashboard":
        return <UsageDashboard onBack={() => handleViewChange("welcome")} />;

      case "mcp":
        return <MCPManager onBack={() => handleViewChange("welcome")} />;

      case "project-settings":
        if (projectForSettings) {
          return (
            <ProjectSettings
              project={projectForSettings}
              onBack={() => {
                setProjectForSettings(null);
                handleViewChange(previousView || "projects");
              }}
            />
          );
        }
        break;

      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Topbar */}
      <Topbar
        onClaudeClick={() => createClaudeMdTab()}
        onSettingsClick={() => createSettingsTab()}
        onUsageClick={() => createUsageTab()}
        onMCPClick={() => createMCPTab()}
        onInfoClick={() => setShowNFO(true)}
        onAgentsClick={() => setShowAgentsModal(true)}
      />

      {/* Analytics Consent Banner */}
      <AnalyticsConsentBanner />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>

      {/* NFO Credits Modal */}
      {showNFO && <NFOCredits onClose={() => setShowNFO(false)} />}

      {/* Agents Modal */}
      <AgentsModal open={showAgentsModal} onOpenChange={setShowAgentsModal} />

      {/* Claude Binary Dialog */}
      <ClaudeBinaryDialog
        open={showClaudeBinaryDialog}
        onOpenChange={setShowClaudeBinaryDialog}
        onSuccess={() => {
          setToast({ message: "Claude binary path saved successfully", type: "success" });
          // Trigger a refresh of the Claude version check
          window.location.reload();
        }}
        onError={(message) => setToast({ message, type: "error" })}
      />

      {/* Toast Container */}
      <ToastContainer>
        {toast && (
          <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
        )}
      </ToastContainer>
    </div>
  );
}

/**
 * Main App component - Wraps the app with providers
 */
/**
 * Main App component with all necessary providers
 *
 * The root application component that wraps the main app content with
 * all necessary context providers including toast notifications,
 * output caching, and tab management.
 *
 * @returns The complete application with all providers
 */
function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <OutputCacheProvider>
          <TabProvider>
            <AppContent />
          </TabProvider>
        </OutputCacheProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
