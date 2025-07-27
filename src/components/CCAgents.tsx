import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit,
  Trash2,
  Play,
  Bot,
  ArrowLeft,
  History,
  Download,
  Upload,
  Globe,
  FileJson,
  ChevronDown,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, type Agent, type AgentRunWithMetrics } from "@/lib/api";
import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { CreateAgent } from "./CreateAgent";
import { AgentExecution } from "./AgentExecution";
import { AgentRunsList } from "./AgentRunsList";
import { GitHubAgentBrowser } from "./GitHubAgentBrowser";
import { AGENT_ICONS } from "@/constants/agentIcons";
import { handleError } from "@/lib/errorHandler";
interface CCAgentsProps {
  /**
   * Callback to go back to the main view
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Type for valid agent icon names
 */
export type AgentIconName = keyof typeof AGENT_ICONS;

/**
 * CCAgents component for managing Claude Code agents
 *
 * A comprehensive agent management interface that provides functionality for
 * creating, editing, deleting, and executing Claude Code agents. Features include
 * agent browsing from GitHub, import/export capabilities, and execution history.
 *
 * @param onBack - Callback to return to the main view
 * @param className - Additional CSS classes for styling
 *
 * @example
 * ```tsx
 * <CCAgents onBack={() => setView('home')} />
 * ```
 */
export const CCAgents: React.FC<CCAgentsProps> = ({ onBack, className }) => {
  const { t } = useI18n();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AgentRunWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState<"list" | "create" | "edit" | "execute">("list");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  // const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [showGitHubBrowser, setShowGitHubBrowser] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const AGENTS_PER_PAGE = 9; // 3x3 grid

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const agentsList = await api.listAgents();
      setAgents(agentsList);
    } catch (err) {
      await handleError("Failed to load agents:", { context: err });
      setError(t.agents.failedToLoadAgents);
      setToast({ message: t.agents.failedToLoadAgents, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [t.agents.failedToLoadAgents]);

  useEffect(() => {
    loadAgents();
    loadRuns();
  }, [loadAgents]);

  const loadRuns = async () => {
    try {
      setRunsLoading(true);
      const runsList = await api.listAgentRuns();
      setRuns(runsList);
    } catch (err) {
      await handleError("Failed to load runs:", { context: err });
    } finally {
      setRunsLoading(false);
    }
  };

  /**
   * Initiates the delete agent process by showing the confirmation dialog
   * @param agent - The agent to be deleted
   */
  const handleDeleteAgent = (agent: Agent) => {
    setAgentToDelete(agent);
    setShowDeleteDialog(true);
  };

  /**
   * Confirms and executes the agent deletion
   * Only called when user explicitly confirms the deletion
   */
  const confirmDeleteAgent = async () => {
    if (!agentToDelete?.id) return;

    try {
      setIsDeleting(true);
      await api.deleteAgent(agentToDelete.id);
      setToast({ message: t.agents.agentDeletedSuccessfully, type: "success" });
      await loadAgents();
      await loadRuns(); // Reload runs as they might be affected
    } catch (err) {
      await handleError("Failed to delete agent:", { context: err });
      setToast({ message: t.agents.failedToDeleteAgent, type: "error" });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setAgentToDelete(null);
    }
  };

  /**
   * Cancels the delete operation and closes the dialog
   */
  const cancelDeleteAgent = () => {
    setShowDeleteDialog(false);
    setAgentToDelete(null);
  };

  const handleEditAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setView("edit");
  };

  const handleExecuteAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setView("execute");
  };

  const handleAgentCreated = async () => {
    setView("list");
    await loadAgents();
    setToast({ message: t.agents.agentCreatedSuccessfully, type: "success" });
  };

  const handleAgentUpdated = async () => {
    setView("list");
    await loadAgents();
    setToast({ message: t.agents.agentUpdatedSuccessfully, type: "success" });
  };

  // const handleRunClick = (run: AgentRunWithMetrics) => {
  //   if (run.id) {
  //     setSelectedRunId(run.id);
  //     setView("viewRun");
  //   }
  // };

  const handleExecutionComplete = async () => {
    // Reload runs when returning from execution
    await loadRuns();
  };

  const handleExportAgent = async (agent: Agent) => {
    try {
      // Show native save dialog
      const filePath = await save({
        defaultPath: `${agent.name.toLowerCase().replace(/\s+/g, "-")}.claudia.json`,
        filters: [
          {
            name: "Claudia Agent",
            extensions: ["claudia.json"],
          },
        ],
      });

      if (!filePath) {
        // User cancelled the dialog
        return;
      }

      // Export the agent to the selected file
      await invoke("export_agent_to_file", {
        id: agent.id ?? 0,
        filePath,
      });

      setToast({ message: t.agents.agentExportedSuccessfully, type: "success" });
    } catch (err) {
      await handleError("Failed to export agent:", { context: err });
      setToast({ message: t.agents.failedToExportAgent, type: "error" });
    }
  };

  const handleImportAgent = async () => {
    try {
      // Show native open dialog
      const filePath = await open({
        multiple: false,
        filters: [
          {
            name: "Claudia Agent",
            extensions: ["claudia.json", "json"],
          },
        ],
      });

      if (!filePath) {
        // User cancelled the dialog
        return;
      }

      // Import the agent from the selected file (default to claudia)
      await api.importAgentFromFile(filePath as string, 'claudia');

      setToast({ message: t.agents.agentImportedSuccessfully, type: "success" });
      await loadAgents();
    } catch (err) {
      await handleError("Failed to import agent:", { context: err });
      const errorMessage = err instanceof Error ? err.message : t.agents.failedToImportAgent;
      setToast({ message: errorMessage, type: "error" });
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(agents.length / AGENTS_PER_PAGE);
  const startIndex = (currentPage - 1) * AGENTS_PER_PAGE;
  const paginatedAgents = agents.slice(startIndex, startIndex + AGENTS_PER_PAGE);

  /**
   * Render agent icon component
   *
   * @param iconName - Name of the icon to render
   * @returns React icon component
   */
  const renderIcon = (iconName: string) => {
    const Icon = AGENT_ICONS[iconName as AgentIconName] || AGENT_ICONS.bot;
    return <Icon className="h-12 w-12" />;
  };

  if (view === "create") {
    return <CreateAgent onBack={() => setView("list")} onAgentCreated={handleAgentCreated} />;
  }

  if (view === "edit" && selectedAgent) {
    return (
      <CreateAgent
        agent={selectedAgent}
        onBack={() => setView("list")}
        onAgentCreated={handleAgentUpdated}
      />
    );
  }

  if (view === "execute" && selectedAgent) {
    return (
      <AgentExecution
        agent={selectedAgent}
        onBack={() => {
          setView("list");
          handleExecutionComplete();
        }}
      />
    );
  }

  // Removed viewRun case - now using modal preview in AgentRunsList

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="w-full max-w-6xl mx-auto flex flex-col h-full p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{t.agents.title}</h1>
                <p className="text-sm text-muted-foreground">{t.agents.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="default" variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    {t.common.import}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleImportAgent}>
                    <FileJson className="h-4 w-4 mr-2" />
                    {t.agents.fromFile}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowGitHubBrowser(true)}>
                    <Globe className="h-4 w-4 mr-2" />
                    {t.agents.fromGitHub}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={() => setView("create")}
                size="default"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t.agents.createCCAgentButton}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </motion.div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key="agents"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="pt-6 space-y-8"
            >
              {/* Agents Grid */}
              <div>
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : agents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Bot className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">{t.agents.noAgentsYet}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t.agents.createFirstAgentDesc}
                    </p>
                    <Button onClick={() => setView("create")} size="default">
                      <Plus className="h-4 w-4 mr-2" />
                      {t.agents.createCCAgentButton}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AnimatePresence mode="popLayout">
                        {paginatedAgents.map((agent, index) => (
                          <motion.div
                            key={agent.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                          >
                            <Card className="h-full hover:shadow-lg transition-shadow">
                              <CardContent className="p-6 flex flex-col items-center text-center">
                                <div className="mb-4 p-4 rounded-full bg-primary/10 text-primary">
                                  {renderIcon(agent.icon)}
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{agent.name}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {t.agents.created}:{" "}
                                  {new Date(agent.created_at).toLocaleDateString()}
                                </p>
                              </CardContent>
                              <CardFooter className="p-4 pt-0 flex justify-center gap-1 flex-wrap">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleExecuteAgent(agent)}
                                  className="flex items-center gap-1"
                                  title={t.agents.executeAgent}
                                >
                                  <Play className="h-3 w-3" />
                                  {t.agents.execute}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditAgent(agent)}
                                  className="flex items-center gap-1"
                                  title={t.agents.editAgent}
                                >
                                  <Edit className="h-3 w-3" />
                                  {t.agents.edit}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleExportAgent(agent)}
                                  className="flex items-center gap-1"
                                  title={t.agents.exportAgentToFile}
                                >
                                  <Upload className="h-3 w-3" />
                                  {t.agents.export}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteAgent(agent)}
                                  className="flex items-center gap-1 text-destructive hover:text-destructive"
                                  title={t.agents.deleteAgent}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  {t.common.delete}
                                </Button>
                              </CardFooter>
                            </Card>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-6 flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          {t.common.previous}
                        </Button>
                        <span className="flex items-center px-3 text-sm">
                          {t.agents.page} {currentPage} {t.agents.of} {totalPages}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          {t.common.next}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Execution History */}
              {!loading && agents.length > 0 && (
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">{t.agents.recentExecutions}</h2>
                  </div>
                  {runsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <AgentRunsList runs={runs} />
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
        )}
      </ToastContainer>

      {/* GitHub Agent Browser */}
      <GitHubAgentBrowser
        isOpen={showGitHubBrowser}
        onClose={() => setShowGitHubBrowser(false)}
        onImportSuccess={async () => {
          setShowGitHubBrowser(false);
          await loadAgents();
          setToast({ message: t.agents.agentImportedFromGitHub, type: "success" });
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              {t.agents.deleteAgentTitle}
            </DialogTitle>
            <DialogDescription>
              {t.agents.deleteAgentConfirmation.replace("{name}", agentToDelete?.name || "")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={cancelDeleteAgent}
              disabled={isDeleting}
              className="w-full sm:w-auto"
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteAgent}
              disabled={isDeleting}
              className="w-full sm:w-auto"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {t.agents.deleting}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t.agents.deleteAgentButton}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
