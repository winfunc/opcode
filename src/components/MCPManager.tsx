import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Network, Plus, Download, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { api, type MCPServer } from "@/lib/api";
import { MCPServerList } from "./MCPServerList";
import { MCPAddServer } from "./MCPAddServer";
import { MCPImportExport } from "./MCPImportExport";
import { useTranslations } from "@/lib/i18n/useI18n";

interface MCPManagerProps {
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
 * Main component for managing MCP (Model Context Protocol) servers
 * Provides a comprehensive UI for adding, configuring, and managing MCP servers
 */
export const MCPManager: React.FC<MCPManagerProps> = ({
  onBack,
  className,
}) => {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState("servers");
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load servers on mount
  useEffect(() => {
    loadServers();
  }, []);

  /**
   * Loads all MCP servers
   */
  const loadServers = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("MCPManager: Loading servers...");
      const serverList = await api.mcpList();
      console.log("MCPManager: Received server list:", serverList);
      console.log("MCPManager: Server count:", serverList.length);
      setServers(serverList);
    } catch (err) {
      console.error("MCPManager: Failed to load MCP servers:", err);
      setError(t('mcp.failedToLoadServers', 'Failed to load MCP servers. Make sure Claude Code is installed.'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles server added event
   */
  const handleServerAdded = () => {
    loadServers();
    setToast({ message: t('mcp.serverAdded', 'MCP server added successfully!'), type: 'success' });
    setActiveTab("servers");
  };

  /**
   * Handles server removed event
   */
  const handleServerRemoved = (name: string) => {
    setServers(prev => prev.filter(s => s.name !== name));
    setToast({ message: t('mcp.serverRemoved', 'Server "{name}" removed successfully!').replace('{name}', name), type: 'success' });
  };

  /**
   * Handles import completed event
   */
  const handleImportCompleted = (imported: number, failed: number) => {
    loadServers();
    if (failed === 0) {
      setToast({
        message: t('mcp.importSuccess', 'Successfully imported {count} server{plural}!')
          .replace('{count}', String(imported))
          .replace('{plural}', imported > 1 ? 's' : ''),
        type: 'success',
      });
    } else {
      setToast({
        message: t('mcp.importMixed', 'Imported {count} server{plural}, {failed} failed')
          .replace('{count}', String(imported))
          .replace('{plural}', imported > 1 ? 's' : '')
          .replace('{failed}', String(failed)),
        type: 'error',
      });
    }
  };

  return (
    <div className={`flex flex-col h-full bg-background text-foreground ${className || ""}`}>
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between p-4 border-b border-border"
        >
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
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Network className="h-5 w-5 text-blue-500" />
                {t('mcp.servers')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('mcp.manageServers')}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-4 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 flex items-center gap-2 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="servers" className="gap-2">
                  <Network className="h-4 w-4 text-blue-500" />
                  {t('mcp.servers')}
                </TabsTrigger>
                <TabsTrigger value="add" className="gap-2">
                  <Plus className="h-4 w-4 text-green-500" />
                  {t('mcp.addServer')}
                </TabsTrigger>
                <TabsTrigger value="import" className="gap-2">
                  <Download className="h-4 w-4 text-purple-500" />
                  {t('mcp.importExport')}
                </TabsTrigger>
              </TabsList>

              {/* Servers Tab */}
              <TabsContent value="servers" className="mt-6">
                <Card>
                  <MCPServerList
                    servers={servers}
                    loading={false}
                    onServerRemoved={handleServerRemoved}
                    onRefresh={loadServers}
                  />
                </Card>
              </TabsContent>

              {/* Add Server Tab */}
              <TabsContent value="add" className="mt-6">
                <Card>
                  <MCPAddServer
                    onServerAdded={handleServerAdded}
                    onError={(message: string) => setToast({ message, type: "error" })}
                  />
                </Card>
              </TabsContent>

              {/* Import/Export Tab */}
              <TabsContent value="import" className="mt-6">
                <Card className="overflow-hidden">
                  <MCPImportExport
                    onImportCompleted={handleImportCompleted}
                    onError={(message: string) => setToast({ message, type: "error" })}
                  />
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
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