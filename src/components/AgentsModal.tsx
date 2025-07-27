import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Plus,
  Loader2,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  Import,
  ChevronDown,
  FileJson,
  Globe,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toast } from "@/components/ui/toast";
import { api, type Agent, type AgentRunWithMetrics } from "@/lib/api";
import { useTabState } from "@/hooks/useTabState";
import { formatISOTimestamp } from "@/lib/date-utils";
import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { GitHubAgentBrowser } from "@/components/GitHubAgentBrowser";
import { useI18n } from "@/lib/i18n";

import { handleError } from "@/lib/errorHandler";
/**
 * Props interface for the AgentsModal component
 */
interface AgentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * AgentsModal component for managing Claude Code agents
 *
 * A comprehensive modal interface for agent management including viewing,
 * creating, importing, exporting, and executing agents. Features tabbed
 * navigation between local agents and GitHub browser with full CRUD operations.
 *
 * @param open - Whether the modal is currently open
 * @param onOpenChange - Callback when modal open state changes
 *
 * @example
 * ```tsx
 * <AgentsModal
 *   open={showAgentsModal}
 *   onOpenChange={setShowAgentsModal}
 * />
 * ```
 */
export const AgentsModal: React.FC<AgentsModalProps> = ({ open, onOpenChange }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("all");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [nativeAgents, setNativeAgents] = useState<Agent[]>([]);
  const [runningAgents, setRunningAgents] = useState<AgentRunWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showGitHubBrowser, setShowGitHubBrowser] = useState(false);
  const { createAgentTab } = useTabState();

  // Load agents when modal opens
  useEffect(() => {
    if (open) {
      loadAgents();
      loadRunningAgents();
    }
  }, [open]);

  // Refresh running agents periodically
  useEffect(() => {
    if (!open) return;

    const interval = globalThis.setInterval(() => {
      loadRunningAgents();
    }, 3000); // Refresh every 3 seconds

    return () => globalThis.clearInterval(interval);
  }, [open]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      // Load both database agents and native agents
      const [dbAgents, nativeAgentsList] = await Promise.all([
        api.listAgents(),
        api.listNativeAgents()
      ]);

      // Database agents (Claudia agents)
      setAgents(dbAgents);

      // Native agents from .claude/agents folder
      setNativeAgents(nativeAgentsList);
    } catch (error) {
      await handleError("Failed to load agents:", { context: error });
    } finally {
      setLoading(false);
    }
  };

  const loadRunningAgents = async () => {
    try {
      const runs = await api.listRunningAgentSessions();
      const agentRuns = runs.map(
        (run) =>
          ({
            id: run.id,
            agent_id: run.agent_id,
            agent_name: run.agent_name,
            task: run.task,
            model: run.model,
            status: "running" as const,
            created_at: run.created_at,
            project_path: run.project_path,
          }) as AgentRunWithMetrics
      );

      setRunningAgents(agentRuns);
    } catch (error) {
      await handleError("Failed to load running agents:", { context: error });
    }
  };

  const handleRunAgent = async (agent: Agent) => {
    // Create a new agent execution tab
    const tabId = `agent-exec-${agent.id}-${Date.now()}`;

    // Close modal
    onOpenChange(false);

    // Dispatch event to open agent execution in the new tab
    window.dispatchEvent(
      new globalThis.CustomEvent("open-agent-execution", {
        detail: { agent, tabId },
      })
    );
  };

  const handleDeleteAgent = async (agent: Agent) => {
    setAgentToDelete(agent);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!agentToDelete?.id) return;
    try {
      await api.deleteAgent(agentToDelete.id);
      loadAgents(); // Refresh the list
      setShowDeleteDialog(false);
      setAgentToDelete(null);
    } catch (error) {
      await handleError("Failed to delete agent:", { context: error });
    }
  };

  const handleOpenAgentRun = (run: AgentRunWithMetrics) => {
    // Create new tab for this agent run
    createAgentTab((run.id ?? 0).toString(), run.agent_name);
    onOpenChange(false);
  };

  const handleCreateAgent = () => {
    // Close modal and create new tab with prepopulated agent type based on current tab
    const agentType = activeTab === 'native' ? 'native' : activeTab === 'claudia' ? 'claudia' : 'claudia'; // default to claudia
    onOpenChange(false);

    // Dispatch event with agent type preference
    window.dispatchEvent(new globalThis.CustomEvent('open-create-agent-tab', {
      detail: { defaultAgentType: agentType }
    }));
  };

  const handleImportFromFile = async () => {
    try {
      const filePath = await openDialog({
        multiple: false,
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
      });

      if (filePath) {
        // Import with agent type based on current tab selection
        const agentType = activeTab === 'native' ? 'native' : 'claudia';
        await api.importAgentFromFile(filePath as string, agentType);
        loadAgents(); // Refresh list
        setToast({ message: t.agents.agentImportedSuccessfully, type: "success" });
      }
    } catch (error) {
      await handleError("Failed to import agent:", { context: error });
      setToast({ message: t.agents.failedToImportAgent, type: "error" });
    }
  };

  const handleImportFromGitHub = () => {
    setShowGitHubBrowser(true);
  };

  const handleImportNativeAgents = async () => {
    try {
      const count = await api.importNativeAgents();

      if (count === 0) {
        setToast({ message: "未找到要导入的原生智能体", type: "error" });
      } else {
        setToast({ message: `成功导入了 ${count} 个原生智能体`, type: "success" });
      }

      await loadAgents(); // Refresh both lists
    } catch (error) {
      await handleError("Failed to import native agents:", { context: error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setToast({ message: `导入原生智能体失败: ${errorMessage}`, type: "error" });
    }
  };

  const handleDeleteNativeAgents = async () => {
    if (!confirm('确定要从数据库中删除所有原生智能体吗？这不会删除 .claude/agents 文件，但会将它们从数据库中移除，以便它们正确显示为原生智能体。')) {
      return;
    }

    try {

      const count = await api.deleteNativeAgents();


      if (count === 0) {
        setToast({ message: "数据库中未找到要删除的原生智能体", type: "success" });
      } else {
        setToast({ message: `成功从数据库删除了 ${count} 个原生智能体`, type: "success" });
      }

      await loadAgents(); // Refresh both lists
    } catch (error) {
      await handleError("Failed to delete native agents:", { context: error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setToast({ message: `删除原生智能体失败: ${errorMessage}`, type: "error" });
    }
  };

  // Filter agents based on active tab
  const getFilteredAgents = () => {
    if (activeTab === 'all') return [...agents, ...nativeAgents];
    if (activeTab === 'native') return nativeAgents;
    if (activeTab === 'claudia') return agents.filter(agent => !agent.source || agent.source === 'claudia' || agent.source === 'user');
    return agents;
  };

  const filteredAgents = getFilteredAgents();

  const handleExportAgent = async (agent: Agent) => {
    try {
      const exportData = await api.exportAgent(agent.id ?? 0);
      const filePath = await save({
        defaultPath: `${agent.name.toLowerCase().replace(/\s+/g, "-")}.json`,
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
      });

      if (filePath) {
        await invoke("write_file", {
          path: filePath,
          content: JSON.stringify(exportData, null, 2),
        });
        setToast({ message: t.agents.agentExportedSuccessfully, type: "success" });
      }
    } catch (error) {
      await handleError("Failed to export agent:", { context: error });
      setToast({ message: t.agents.failedToExportAgent, type: "error" });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[600px] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {t.agents.agentManagement}
            </DialogTitle>
            <DialogDescription>{t.agents.createNewAgentsOrManage}</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="mx-6 mb-4">
              <TabsTrigger value="all">{t.agents.allAgents}</TabsTrigger>
              <TabsTrigger value="claudia">{t.agents.claudia}</TabsTrigger>
              <TabsTrigger value="native">{t.agents.native}</TabsTrigger>
              <TabsTrigger value="running" className="relative">
                {t.agents.running}
                {runningAgents.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {runningAgents.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              {/* All Agents Tab */}
              <TabsContent value="all" className="h-full m-0">
                {/* Action buttons at the top */}
                <div className="flex gap-2 mb-4 px-6 pt-4">
                  <Button onClick={handleCreateAgent} className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />
                    {t.agents.createAgent}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <Import className="w-4 h-4 mr-2" />
                        {t.agents.importAgent}
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={handleImportFromFile}>
                        <FileJson className="w-4 h-4 mr-2" />
                        {t.agents.fromFile}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleImportFromGitHub}>
                        <Globe className="w-4 h-4 mr-2" />
                        {t.agents.fromGitHub}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Scrollable content area */}
                <ScrollArea className="h-[400px]">
                    <div className="px-6 pb-6">
                      {loading ? (
                        <div className="flex items-center justify-center h-64">
                          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : filteredAgents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                          <Bot className="w-12 h-12 text-muted-foreground mb-4" />
                          <p className="text-lg font-medium mb-2">{t.agents.noAgentsAvailable}</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t.agents.createFirstAgentToGetStarted}
                          </p>
                          <Button onClick={() => {
                            onOpenChange(false);
                            window.dispatchEvent(new globalThis.CustomEvent('open-create-agent-tab'));
                          }}>
                            <Plus className="w-4 h-4 mr-2" />
                            {t.agents.createAgent}
                          </Button>
                        </div>
                      ) : (
                        <div className="grid gap-4 py-4">
                          {filteredAgents.map((agent) => (
                            <motion.div
                              key={agent.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-medium flex items-center gap-2">
                                    <Bot className="w-4 h-4" />
                                    {agent.name}
                                    {agent.source === 'native' && (
                                      <Badge variant="outline" className="text-xs">{t.agents.native}</Badge>
                                    )}
                                  </h3>
                                  {agent.default_task && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {agent.default_task}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleExportAgent(agent)}
                                  >
                                    <Download className="w-3 h-3 mr-1" />
                                    {t.agents.export}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteAgent(agent)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    {t.common.delete}
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleRunAgent(agent)}
                                  >
                                    <Play className="w-3 h-3 mr-1" />
                                    {t.agents.runAgent}
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
              </TabsContent>

              {/* Claudia Agents Tab */}
              <TabsContent value="claudia" className="h-full m-0">
                {/* Action buttons at the top */}
                <div className="flex gap-2 mb-4 px-6 pt-4">
                  <Button onClick={handleCreateAgent} className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />
                    {t.agents.createClaudiaAgent}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <Import className="w-4 h-4 mr-2" />
                        {t.agents.importAgent}
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={handleImportFromFile}>
                        <FileJson className="w-4 h-4 mr-2" />
                        {t.agents.fromFile}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleImportFromGitHub}>
                        <Globe className="w-4 h-4 mr-2" />
                        {t.agents.fromGitHub}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Scrollable content area */}
                <ScrollArea className="h-[400px]">
                    <div className="px-6 pb-6">
                      {loading ? (
                        <div className="flex items-center justify-center h-64">
                          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : filteredAgents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                          <Bot className="w-12 h-12 text-muted-foreground mb-4" />
                          <p className="text-lg font-medium mb-2">{t.agents.noClaudiaAgents}</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t.agents.createFirstClaudiaAgent}
                          </p>
                          <Button onClick={handleCreateAgent}>
                            <Plus className="w-4 h-4 mr-2" />
                            {t.agents.createClaudiaAgent}
                          </Button>
                        </div>
                      ) : (
                        <div className="grid gap-4 py-4">
                          {filteredAgents.map((agent) => (
                            <motion.div
                              key={agent.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-medium flex items-center gap-2">
                                    <Bot className="w-4 h-4" />
                                    {agent.name}
                                    <Badge variant="outline" className="text-xs text-blue-600">{t.agents.claudia}</Badge>
                                  </h3>
                                  {agent.default_task && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {agent.default_task}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleExportAgent(agent)}
                                  >
                                    <Download className="w-3 h-3 mr-1" />
                                    {t.agents.export}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteAgent(agent)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    {t.common.delete}
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleRunAgent(agent)}
                                  >
                                    <Play className="w-3 h-3 mr-1" />
                                    {t.agents.runAgent}
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
              </TabsContent>

              {/* Native Agents Tab */}
              <TabsContent value="native" className="h-full m-0">
                {/* Info message about native agents */}
                <div className="px-6 pt-4 pb-2">
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {t.agents.nativeAgentsInfo}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleImportNativeAgents}
                          className="text-xs"
                        >
                          {t.agents.importNativeAgents}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDeleteNativeAgents}
                          className="text-xs"
                        >
                          {t.agents.cleanDatabase}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scrollable content area */}
                <ScrollArea className="h-[400px]">
                    <div className="px-6 pb-6">
                      {loading ? (
                        <div className="flex items-center justify-center h-64">
                          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : filteredAgents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                          <Bot className="w-12 h-12 text-muted-foreground mb-4" />
                          <p className="text-lg font-medium mb-2">{t.agents.noNativeAgentsFound}</p>
                          <p className="text-sm text-muted-foreground">
                            {t.agents.nativeAgentsDesc}
                          </p>
                        </div>
                      ) : (
                        <div className="grid gap-4 py-4">
                          {filteredAgents.map((agent) => (
                            <motion.div
                              key={agent.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-medium flex items-center gap-2">
                                    <Bot className="w-4 h-4" />
                                    {agent.name}
                                    <Badge variant="outline" className="text-xs text-green-600">{t.agents.native}</Badge>
                                  </h3>
                                  {agent.default_task && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {agent.default_task}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleExportAgent(agent)}
                                  >
                                    <Download className="w-3 h-3 mr-1" />
                                    {t.agents.export}
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleRunAgent(agent)}
                                  >
                                    <Play className="w-3 h-3 mr-1" />
                                    {t.agents.runAgent}
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
              </TabsContent>

              <TabsContent value="running" className="h-full m-0">
                <ScrollArea className="h-full px-6 pb-6">
                  {runningAgents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Clock className="w-12 h-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-2">{t.agents.noRunningAgents}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.agents.agentExecutionsWillAppear}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 py-4">
                      <AnimatePresence mode="popLayout">
                        {runningAgents.map((run) => (
                          <motion.div
                            key={run.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => handleOpenAgentRun(run)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium flex items-center gap-2">
                                  {getStatusIcon(run.status)}
                                  {run.agent_name}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">{run.task}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>{t.agents.started}: {formatISOTimestamp(run.created_at)}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {run.model === "opus" ? "Claude 4 Opus" : "Claude 4 Sonnet"}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAgentRun(run);
                                }}
                              >
                                {t.agents.view}
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.agents.deleteAgentTitle}</DialogTitle>
            <DialogDescription>
              {t.agents.deleteAgentConfirmation.replace("{name}", agentToDelete?.name || "")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setAgentToDelete(null);
              }}
            >
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t.common.delete}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* GitHub Agent Browser */}
      <GitHubAgentBrowser
        isOpen={showGitHubBrowser}
        onClose={() => setShowGitHubBrowser(false)}
        onImportSuccess={() => {
          setShowGitHubBrowser(false);
          loadAgents(); // Refresh the agents list
          setToast({ message: "Agent imported successfully", type: "success" });
        }}
      />

      {/* Toast notifications */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </>
  );
};

export default AgentsModal;
