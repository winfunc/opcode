import React, { useState } from "react";
import { Plus, Terminal, Globe, Trash2, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SelectComponent } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { handleError } from "@/lib/errorHandler";
import { useTrackEvent } from "@/hooks";
interface MCPAddServerProps {
  /**
   * Callback when a server is successfully added
   */
  onServerAdded: () => void;
  /**
   * Callback for error messages
   */
  onError: (message: string) => void;
}

interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
}

/**
 * Component for adding new MCP servers
 * Supports both stdio and SSE transport types
 */
export const MCPAddServer: React.FC<MCPAddServerProps> = ({ onServerAdded, onError }) => {
  const { t } = useI18n();
  const [transport, setTransport] = useState<"stdio" | "sse">("stdio");
  const [saving, setSaving] = useState(false);

  // Analytics tracking
  const trackEvent = useTrackEvent();
  // Stdio server state
  const [stdioName, setStdioName] = useState("");
  const [stdioCommand, setStdioCommand] = useState("");
  const [stdioArgs, setStdioArgs] = useState("");
  const [stdioScope, setStdioScope] = useState("local");
  const [stdioEnvVars, setStdioEnvVars] = useState<EnvironmentVariable[]>([]);

  // SSE server state
  const [sseName, setSseName] = useState("");
  const [sseUrl, setSseUrl] = useState("");
  const [sseScope, setSseScope] = useState("local");
  const [sseEnvVars, setSseEnvVars] = useState<EnvironmentVariable[]>([]);

  /**
   * Adds a new environment variable
   */
  const addEnvVar = (type: "stdio" | "sse") => {
    const newVar: EnvironmentVariable = {
      id: `env-${Date.now()}`,
      key: "",
      value: "",
    };

    if (type === "stdio") {
      setStdioEnvVars((prev) => [...prev, newVar]);
    } else {
      setSseEnvVars((prev) => [...prev, newVar]);
    }
  };

  /**
   * Updates an environment variable
   */
  const updateEnvVar = (
    type: "stdio" | "sse",
    id: string,
    field: "key" | "value",
    value: string
  ) => {
    if (type === "stdio") {
      setStdioEnvVars((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
    } else {
      setSseEnvVars((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
    }
  };

  /**
   * Removes an environment variable
   */
  const removeEnvVar = (type: "stdio" | "sse", id: string) => {
    if (type === "stdio") {
      setStdioEnvVars((prev) => prev.filter((v) => v.id !== id));
    } else {
      setSseEnvVars((prev) => prev.filter((v) => v.id !== id));
    }
  };

  /**
   * Validates and adds a stdio server
   */
  const handleAddStdioServer = async () => {
    if (!stdioName.trim()) {
      onError(t.mcp.serverNameRequired);
      return;
    }

    if (!stdioCommand.trim()) {
      onError(t.mcp.commandRequired);
      return;
    }

    try {
      setSaving(true);

      // Parse arguments
      const args = stdioArgs.trim() ? stdioArgs.split(/\s+/) : [];

      // Convert env vars to object
      const env = stdioEnvVars.reduce(
        (acc, { key, value }) => {
          if (key.trim() && value.trim()) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, string>
      );

      const result = await api.mcpAdd(
        stdioName,
        "stdio",
        stdioCommand,
        args,
        env,
        undefined,
        stdioScope
      );

      if (result.success) {
        // Track server added
        trackEvent.mcpServerAdded({
          server_type: "stdio",
          configuration_method: "manual"
        });

        // Reset form
        setStdioName("");
        setStdioCommand("");
        setStdioArgs("");
        setStdioEnvVars([]);
        setStdioScope("local");
        onServerAdded();
      } else {
        onError(result.message);
      }
    } catch (error) {
      onError(t.messages.saveError);
      await handleError("Failed to add stdio server:", { context: error });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Validates and adds an SSE server
   */
  const handleAddSseServer = async () => {
    if (!sseName.trim()) {
      onError(t.mcp.serverNameRequired);
      return;
    }

    if (!sseUrl.trim()) {
      onError(t.mcp.urlRequired);
      return;
    }

    try {
      setSaving(true);

      // Convert env vars to object
      const env = sseEnvVars.reduce(
        (acc, { key, value }) => {
          if (key.trim() && value.trim()) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, string>
      );

      const result = await api.mcpAdd(sseName, "sse", undefined, [], env, sseUrl, sseScope);

      if (result.success) {
        // Track server added
        trackEvent.mcpServerAdded({
          server_type: "sse",
          configuration_method: "manual"
        });

        // Reset form
        setSseName("");
        setSseUrl("");
        setSseEnvVars([]);
        setSseScope("local");
        onServerAdded();
      } else {
        onError(result.message);
      }
    } catch (error) {
      onError(t.messages.saveError);
      await handleError("Failed to add SSE server:", { context: error });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Renders environment variable inputs
   */
  const renderEnvVars = (type: "stdio" | "sse", envVars: EnvironmentVariable[]) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{t.mcp.environmentVariables}</Label>
          <Button variant="outline" size="sm" onClick={() => addEnvVar(type)} className="gap-2">
            <Plus className="h-3 w-3" />
            {t.mcp.addVariable}
          </Button>
        </div>

        {envVars.length > 0 && (
          <div className="space-y-2">
            {envVars.map((envVar) => (
              <div key={envVar.id} className="flex items-center gap-2">
                <Input
                  placeholder="KEY"
                  value={envVar.key}
                  onChange={(e) => updateEnvVar(type, envVar.id, "key", e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
                <span className="text-muted-foreground">=</span>
                <Input
                  placeholder="value"
                  value={envVar.value}
                  onChange={(e) => updateEnvVar(type, envVar.id, "value", e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEnvVar(type, envVar.id)}
                  className="h-8 w-8 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold">{t.mcp.addMcpServer}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t.mcp.configureMcpServer}</p>
      </div>

      <Tabs value={transport} onValueChange={(v) => setTransport(v as "stdio" | "sse")}>
        <TabsList className="grid w-full grid-cols-2 max-w-sm mb-6">
          <TabsTrigger value="stdio" className="gap-2">
            <Terminal className="h-4 w-4 text-amber-500" />
            {t.mcp.stdio}
          </TabsTrigger>
          <TabsTrigger value="sse" className="gap-2">
            <Globe className="h-4 w-4 text-emerald-500" />
            {t.mcp.sse}
          </TabsTrigger>
        </TabsList>

        {/* Stdio Server */}
        <TabsContent value="stdio" className="space-y-6">
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stdio-name">{t.mcp.serverName}</Label>
                <Input
                  id="stdio-name"
                  placeholder="my-server"
                  value={stdioName}
                  onChange={(e) => setStdioName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.mcp.uniqueServerName}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stdio-command">{t.mcp.command}</Label>
                <Input
                  id="stdio-command"
                  placeholder="/path/to/server"
                  value={stdioCommand}
                  onChange={(e) => setStdioCommand(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">{t.mcp.commandToExecute}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stdio-args">{t.mcp.commandArguments}</Label>
                <Input
                  id="stdio-args"
                  placeholder="arg1 arg2 arg3"
                  value={stdioArgs}
                  onChange={(e) => setStdioArgs(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">{t.mcp.spaceSeparatedArgs}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stdio-scope">{t.mcp.scope}</Label>
                <SelectComponent
                  value={stdioScope}
                  onValueChange={(value: string) => setStdioScope(value)}
                  options={[
                    { value: "local", label: t.mcp.localProjectOnly },
                    { value: "project", label: t.mcp.projectSharedMcp },
                    { value: "user", label: t.mcp.userAllProjects },
                  ]}
                />
              </div>

              {renderEnvVars("stdio", stdioEnvVars)}
            </div>

            <div className="pt-2">
              <Button
                onClick={handleAddStdioServer}
                disabled={saving}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.mcp.addingServer}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t.mcp.addStdioServer}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* SSE Server */}
        <TabsContent value="sse" className="space-y-6">
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sse-name">{t.mcp.serverName}</Label>
                <Input
                  id="sse-name"
                  placeholder="sse-server"
                  value={sseName}
                  onChange={(e) => setSseName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.mcp.uniqueServerName}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sse-url">{t.mcp.url}</Label>
                <Input
                  id="sse-url"
                  placeholder="https://example.com/sse-endpoint"
                  value={sseUrl}
                  onChange={(e) => setSseUrl(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">{t.mcp.sseEndpointUrl}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sse-scope">{t.mcp.scope}</Label>
                <SelectComponent
                  value={sseScope}
                  onValueChange={(value: string) => setSseScope(value)}
                  options={[
                    { value: "local", label: t.mcp.localProjectOnly },
                    { value: "project", label: t.mcp.projectSharedMcp },
                    { value: "user", label: t.mcp.userAllProjects },
                  ]}
                />
              </div>

              {renderEnvVars("sse", sseEnvVars)}
            </div>

            <div className="pt-2">
              <Button
                onClick={handleAddSseServer}
                disabled={saving}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.mcp.addingServer}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t.mcp.addSseServer}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Example */}
      <Card className="p-4 bg-muted/30">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 text-primary" />
            <span>{t.mcp.exampleCommands}</span>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="font-mono bg-background p-2 rounded">
              <p>• Postgres: /path/to/postgres-mcp-server --connection-string "postgresql://..."</p>
              <p>• Weather API: /usr/local/bin/weather-cli --api-key ABC123</p>
              <p>• SSE Server: https://api.example.com/mcp/stream</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
