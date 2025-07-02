import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Download,
  Loader2,
  AlertCircle,
  Eye,
  Check,
  Globe,
  FileJson,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, type GitHubAgentFile, type AgentExport, type Agent } from "@/lib/api";
import { type AgentIconName } from "./CCAgents";
import { ICON_MAP } from "./IconPicker";
import { open } from "@tauri-apps/plugin-shell";

interface GitHubAgentBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

interface AgentPreview {
  file: GitHubAgentFile;
  data: AgentExport | null;
  loading: boolean;
  error: string | null;
}

export const GitHubAgentBrowser: React.FC<GitHubAgentBrowserProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [agents, setAgents] = useState<GitHubAgentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [existingAgents, setExistingAgents] = useState<Agent[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchAgents();
      fetchExistingAgents();
    }
  }, [isOpen]);

  const fetchExistingAgents = async () => {
    try {
      const agents = await api.listAgents();
      setExistingAgents(agents);
    } catch (err) {
      console.error("Failed to fetch existing agents:", err);
    }
  };

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const agentFiles = await api.fetchGitHubAgents();
      setAgents(agentFiles);
    } catch (err) {
      console.error("Failed to fetch GitHub agents:", err);
      setError("Failed to fetch agents from GitHub. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewAgent = async (file: GitHubAgentFile) => {
    setSelectedAgent({
      file,
      data: null,
      loading: true,
      error: null,
    });

    try {
      const agentData = await api.fetchGitHubAgentContent(file.download_url);
      setSelectedAgent({
        file,
        data: agentData,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("Failed to fetch agent content:", err);
      setSelectedAgent({
        file,
        data: null,
        loading: false,
        error: "Failed to load agent details",
      });
    }
  };

  const isAgentImported = (fileName: string) => {
    const agentName = getAgentDisplayName(fileName);
    return existingAgents.some(agent => 
      agent.name.toLowerCase() === agentName.toLowerCase()
    );
  };

  const handleImportAgent = async () => {
    if (!selectedAgent?.file) return;

    try {
      setImporting(true);
      await api.importAgentFromGitHub(selectedAgent.file.download_url);
      
      // Refresh existing agents list
      await fetchExistingAgents();
      
      // Close preview
      setSelectedAgent(null);
      
      // Notify parent
      onImportSuccess();
    } catch (err) {
      console.error("Failed to import agent:", err);
      alert(`Failed to import agent: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setImporting(false);
    }
  };

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAgentDisplayName = (fileName: string) => {
    return fileName.replace(".claudia.json", "").replace(/-/g, " ")
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const renderIcon = (iconName: string) => {
    const Icon = ICON_MAP[iconName as AgentIconName] || ICON_MAP.bot;
    return <Icon className="h-8 w-8" />;
  };

  const handleGitHubLinkClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await open("https://github.com/getAsterisk/claudia/tree/main/cc_agents");
    } catch (error) {
      console.error('Failed to open GitHub link:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Import Agent from GitHub
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Repository Info */}
          <div className="px-4 py-3 bg-muted/50 rounded-lg mb-4">
            <p className="text-sm text-muted-foreground">
              Agents are fetched from{" "}
              <button
                onClick={handleGitHubLinkClick}
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                github.com/getAsterisk/claudia/cc_agents
                <Globe className="h-3 w-3" />
              </button>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              You can contribute your custom agents to the repository!
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={fetchAgents} variant="outline" size="sm">
                  Try Again
                </Button>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <FileJson className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "No agents found matching your search" : "No agents available"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                <AnimatePresence mode="popLayout">
                  {filteredAgents.map((agent, index) => (
                    <motion.div
                      key={agent.sha}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => handlePreviewAgent(agent)}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                                {/* Default to bot icon for now, will be loaded from preview */}
                                {(() => {
                                  const Icon = ICON_MAP.bot;
                                  return <Icon className="h-6 w-6" />;
                                })()}
                              </div>
                              <h3 className="text-sm font-semibold line-clamp-2">
                                {getAgentDisplayName(agent.name)}
                              </h3>
                            </div>
                            {isAgentImported(agent.name) && (
                              <Badge variant="secondary" className="ml-2 flex-shrink-0">
                                <Check className="h-3 w-3 mr-1" />
                                Imported
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {(agent.size / 1024).toFixed(1)} KB
                          </p>
                        </CardContent>
                        <CardFooter className="p-4 pt-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewAgent(agent);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-2" />
                            Preview
                          </Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Agent Preview Dialog */}
      <AnimatePresence>
        {selectedAgent && (
          <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Agent Preview</DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto">
                {selectedAgent.loading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : selectedAgent.error ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                    <p className="text-sm text-muted-foreground">{selectedAgent.error}</p>
                  </div>
                ) : selectedAgent.data ? (
                  <div className="space-y-4">
                    {/* Agent Info */}
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10 text-primary">
                        {renderIcon(selectedAgent.data.agent.icon)}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">
                          {selectedAgent.data.agent.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{selectedAgent.data.agent.model}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* System Prompt */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">System Prompt</h4>
                      <div className="bg-muted rounded-lg p-3 max-h-48 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {selectedAgent.data.agent.system_prompt}
                        </pre>
                      </div>
                    </div>

                    {/* Default Task */}
                    {selectedAgent.data.agent.default_task && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Default Task</h4>
                        <div className="bg-muted rounded-lg p-3">
                          <p className="text-sm">{selectedAgent.data.agent.default_task}</p>
                        </div>
                      </div>
                    )}



                    {/* Metadata */}
                    <div className="text-xs text-muted-foreground">
                      <p>Version: {selectedAgent.data.version}</p>
                      <p>Exported: {new Date(selectedAgent.data.exported_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              {selectedAgent.data && (
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedAgent(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImportAgent}
                    disabled={importing || isAgentImported(selectedAgent.file.name)}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : isAgentImported(selectedAgent.file.name) ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Already Imported
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Import Agent
                      </>
                    )}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </Dialog>
  );
};
