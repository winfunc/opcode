import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Play,
  Bot,
  Brain,
  Code,
  Sparkles,
  Zap,
  Cpu,
  Rocket,
  Shield,
  Terminal,
  ArrowLeft,
  History,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { api, type Agent, type AgentRunWithMetrics } from "@/lib/api";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { CreateAgent } from "./CreateAgent";
import { AgentExecution } from "./AgentExecution";
import { AgentRunsList } from "./AgentRunsList";
import { AgentRunView } from "./AgentRunView";
import { RunningSessionsView } from "./RunningSessionsView";

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

// Available icons for agents
export const AGENT_ICONS = {
  bot: Bot,
  brain: Brain,
  code: Code,
  sparkles: Sparkles,
  zap: Zap,
  cpu: Cpu,
  rocket: Rocket,
  shield: Shield,
  terminal: Terminal,
};

export type AgentIconName = keyof typeof AGENT_ICONS;

/**
 * CCAgents component for managing Claude Code agents
 * 
 * @example
 * <CCAgents onBack={() => setView('home')} />
 */
export const CCAgents: React.FC<CCAgentsProps> = ({ onBack, className }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AgentRunWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState<"list" | "create" | "edit" | "execute" | "viewRun">("list");
  const [activeTab, setActiveTab] = useState<"agents" | "running">("agents");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const AGENTS_PER_PAGE = 9; // 3x3 grid

  useEffect(() => {
    loadAgents();
    loadRuns();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const agentsList = await api.listAgents();
      setAgents(agentsList);
    } catch (err) {
      console.error("Failed to load agents:", err);
      setError("Failed to load agents");
      setToast({ message: "Failed to load agents", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadRuns = async () => {
    try {
      setRunsLoading(true);
      const runsList = await api.listAgentRuns();
      setRuns(runsList);
    } catch (err) {
      console.error("Failed to load runs:", err);
    } finally {
      setRunsLoading(false);
    }
  };

  const handleDeleteAgent = async (id: number) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;

    try {
      await api.deleteAgent(id);
      setToast({ message: "Agent deleted successfully", type: "success" });
      await loadAgents();
      await loadRuns(); // Reload runs as they might be affected
    } catch (err) {
      console.error("Failed to delete agent:", err);
      setToast({ message: "Failed to delete agent", type: "error" });
    }
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
    setToast({ message: "Agent created successfully", type: "success" });
  };

  const handleAgentUpdated = async () => {
    setView("list");
    await loadAgents();
    setToast({ message: "Agent updated successfully", type: "success" });
  };

  const handleRunClick = (run: AgentRunWithMetrics) => {
    if (run.id) {
      setSelectedRunId(run.id);
      setView("viewRun");
    }
  };

  const handleExecutionComplete = async () => {
    // Reload runs when returning from execution
    await loadRuns();
  };

  const handleExportAgent = async (agent: Agent) => {
    try {
      // Show native save dialog
      const filePath = await save({
        defaultPath: `${agent.name.toLowerCase().replace(/\s+/g, '-')}.claudia.json`,
        filters: [{
          name: 'Claudia Agent',
          extensions: ['claudia.json']
        }]
      });
      
      if (!filePath) {
        // User cancelled the dialog
        return;
      }
      
      // Export the agent to the selected file
      await invoke('export_agent_to_file', { 
        id: agent.id!,
        filePath 
      });
      
      setToast({ message: `Agent "${agent.name}" exported successfully`, type: "success" });
    } catch (err) {
      console.error("Failed to export agent:", err);
      setToast({ message: "Failed to export agent", type: "error" });
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(agents.length / AGENTS_PER_PAGE);
  const startIndex = (currentPage - 1) * AGENTS_PER_PAGE;
  const paginatedAgents = agents.slice(startIndex, startIndex + AGENTS_PER_PAGE);

  const renderIcon = (iconName: string) => {
    const Icon = AGENT_ICONS[iconName as AgentIconName] || Bot;
    return <Icon className="h-12 w-12" />;
  };

  if (view === "create") {
    return (
      <CreateAgent
        onBack={() => setView("list")}
        onAgentCreated={handleAgentCreated}
      />
    );
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

  if (view === "viewRun" && selectedRunId) {
    return (
      <AgentRunView
        runId={selectedRunId}
        onBack={() => setView("list")}
      />
    );
  }

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
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">CC Agents</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your Claude Code agents
                </p>
              </div>
            </div>
            <Button
              onClick={() => setView("create")}
              size="default"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create CC Agent
            </Button>
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

        {/* Tab Navigation */}
        <div className="border-b border-border">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("agents")}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                activeTab === "agents"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Agents
              </div>
            </button>
            <button
              onClick={() => setActiveTab("running")}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                activeTab === "running"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Running Sessions
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === "agents" && (
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
                      <h3 className="text-lg font-medium mb-2">No agents yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create your first CC Agent to get started
                      </p>
                      <Button onClick={() => setView("create")} size="default">
                        <Plus className="h-4 w-4 mr-2" />
                        Create CC Agent
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
                                  <h3 className="text-lg font-semibold mb-2">
                                    {agent.name}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">
                                    Created: {new Date(agent.created_at).toLocaleDateString()}
                                  </p>
                                </CardContent>
                                <CardFooter className="p-4 pt-0 flex justify-center gap-1 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleExecuteAgent(agent)}
                                    className="flex items-center gap-1"
                                    title="Execute agent"
                                  >
                                    <Play className="h-3 w-3" />
                                    Execute
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditAgent(agent)}
                                    className="flex items-center gap-1"
                                    title="Edit agent"
                                  >
                                    <Edit className="h-3 w-3" />
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleExportAgent(agent)}
                                    className="flex items-center gap-1"
                                    title="Export agent to .claudia.json"
                                  >
                                    <Download className="h-3 w-3" />
                                    Export
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteAgent(agent.id!)}
                                    className="flex items-center gap-1 text-destructive hover:text-destructive"
                                    title="Delete agent"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Delete
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
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="flex items-center px-3 text-sm">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Next
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
                      <h2 className="text-lg font-semibold">Recent Executions</h2>
                    </div>
                    {runsLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <AgentRunsList runs={runs} onRunClick={handleRunClick} />
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "running" && (
              <motion.div
                key="running"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="pt-6"
              >
                <RunningSessionsView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </div>
  );
};
