# MCP Server API

The MCP (Model Context Protocol) Server API provides functionality to manage MCP servers that extend Claude's capabilities with custom tools and integrations. This API handles server configuration, connection testing, and integration with Claude Code sessions.

## Table of Contents
- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Server Management](#server-management)
- [Configuration Scopes](#configuration-scopes)
- [Import/Export Operations](#importexport-operations)
- [Connection Testing](#connection-testing)
- [Project Integration](#project-integration)
- [Examples](#examples)

## Overview

Model Context Protocol (MCP) allows Claude to access external tools and data sources through standardized server interfaces. Claudia provides comprehensive MCP server management including:

- **Server Registration** - Add and configure MCP servers
- **Multiple Scopes** - Global, user, and project-specific configurations
- **Transport Types** - Support for stdio and SSE (Server-Sent Events)
- **Claude Desktop Import** - Import existing configurations
- **Connection Testing** - Verify server availability and functionality
- **Project Integration** - Per-project server configurations

### MCP Architecture
```
Claude Code Session ←→ Claudia MCP Manager ←→ MCP Servers
                              ↓
                     Configuration Storage
                       (Global/Project)
```

## Core Concepts

### Server Types
- **stdio**: Servers that communicate via standard input/output
- **sse**: Servers that use Server-Sent Events over HTTP

### Configuration Scopes
- **local**: System-wide configuration
- **user**: User-specific configuration  
- **project**: Project-specific configuration (stored in `.mcp.json`)

### Server Structure
```typescript
interface MCPServer {
  name: string;                    // Unique server identifier
  transport: string;               // "stdio" or "sse"
  command?: string;                // Executable command (stdio)
  args: string[];                  // Command arguments
  env: Record<string, string>;     // Environment variables
  url?: string;                    // Server URL (sse)
  scope: string;                   // Configuration scope
  is_active: boolean;              // Whether server is enabled
  status: ServerStatus;            // Current server status
}
```

## Server Management

### `mcpList()`

Lists all configured MCP servers across all scopes.

```typescript
async mcpList(): Promise<MCPServer[]>
```

**Returns**: Array of all configured MCP servers

**Example**:
```typescript
const servers = await api.mcpList();

servers.forEach(server => {
  console.log(`🖥️ ${server.name} (${server.transport})`);
  console.log(`   Scope: ${server.scope}`);
  console.log(`   Active: ${server.is_active}`);
  console.log(`   Status: ${server.status.running ? '✅ Running' : '❌ Stopped'}`);
  
  if (server.transport === 'stdio') {
    console.log(`   Command: ${server.command} ${server.args.join(' ')}`);
  } else {
    console.log(`   URL: ${server.url}`);
  }
});
```

### `mcpAdd(name, transport, command?, args, env, url?, scope)`

Adds a new MCP server configuration.

```typescript
async mcpAdd(
  name: string,
  transport: string,
  command?: string,
  args: string[] = [],
  env: Record<string, string> = {},
  url?: string,
  scope: string = "local"
): Promise<AddServerResult>
```

**Parameters**:
- `name` - Unique identifier for the server
- `transport` - "stdio" or "sse"
- `command` - Executable path (required for stdio)
- `args` - Command line arguments
- `env` - Environment variables
- `url` - Server URL (required for sse)
- `scope` - Configuration scope ("local", "user", "project")

**Returns**: Result indicating success/failure and details

**Example - stdio Server**:
```typescript
const result = await api.mcpAdd(
  'filesystem-server',
  'stdio',
  'node',
  ['./servers/filesystem/index.js'],
  { 
    'NODE_ENV': 'production',
    'FS_ROOT': '/allowed/path'
  },
  undefined,
  'local'
);

if (result.success) {
  console.log(`✅ Added server: ${result.server_name}`);
} else {
  console.error(`❌ Failed to add server: ${result.message}`);
}
```

**Example - SSE Server**:
```typescript
const result = await api.mcpAdd(
  'weather-api',
  'sse',
  undefined,
  [],
  {
    'API_KEY': 'your-weather-api-key'
  },
  'https://weather-mcp.example.com/sse',
  'user'
);
```

### `mcpGet(name)`

Retrieves details for a specific MCP server.

```typescript
async mcpGet(name: string): Promise<MCPServer>
```

**Parameters**:
- `name` - Server name to retrieve

**Returns**: Complete server configuration

**Example**:
```typescript
const server = await api.mcpGet('filesystem-server');
console.log(`Server: ${server.name}`);
console.log(`Transport: ${server.transport}`);
console.log(`Command: ${server.command} ${server.args.join(' ')}`);
console.log(`Environment:`, server.env);
```

### `mcpRemove(name)`

Removes an MCP server configuration.

```typescript
async mcpRemove(name: string): Promise<string>
```

**Parameters**:
- `name` - Server name to remove

**Returns**: Success message

**Example**:
```typescript
const message = await api.mcpRemove('old-server');
console.log(message); // "Server 'old-server' removed successfully"
```

## Configuration Scopes

### Local/System Scope
```typescript
// Add system-wide server available to all users
await api.mcpAdd(
  'system-tools',
  'stdio',
  '/usr/local/bin/mcp-tools',
  ['--mode', 'system'],
  {},
  undefined,
  'local'
);
```

### User Scope
```typescript
// Add user-specific server
await api.mcpAdd(
  'personal-assistant',
  'stdio',
  'python',
  ['/home/user/mcp/assistant.py'],
  { 'USER_DATA': '/home/user/data' },
  undefined,
  'user'
);
```

### Project Scope
```typescript
// Add project-specific server
await api.mcpAdd(
  'project-analyzer',
  'stdio',
  'node',
  ['./tools/analyzer.js'],
  { 'PROJECT_ROOT': process.cwd() },
  undefined,
  'project'
);
```

## Import/Export Operations

### `mcpAddJson(name, jsonConfig, scope)`

Adds a server from JSON configuration.

```typescript
async mcpAddJson(
  name: string, 
  jsonConfig: string, 
  scope: string = "local"
): Promise<AddServerResult>
```

**Parameters**:
- `name` - Server name
- `jsonConfig` - JSON configuration string
- `scope` - Configuration scope

**Example**:
```typescript
const serverConfig = JSON.stringify({
  command: "python",
  args: ["-m", "my_mcp_server"],
  env: {
    "PYTHONPATH": "/path/to/server",
    "SERVER_MODE": "production"
  }
});

const result = await api.mcpAddJson('python-server', serverConfig, 'user');
```

### `mcpAddFromClaudeDesktop(scope)`

Imports MCP servers from Claude Desktop configuration.

```typescript
async mcpAddFromClaudeDesktop(scope: string = "local"): Promise<ImportResult>
```

**Parameters**:
- `scope` - Target scope for imported servers

**Returns**: Import results with success/failure details

**Example**:
```typescript
const importResult = await api.mcpAddFromClaudeDesktop('user');

console.log(`✅ Imported: ${importResult.imported_count} servers`);
console.log(`❌ Failed: ${importResult.failed_count} servers`);

importResult.servers.forEach(server => {
  if (server.success) {
    console.log(`  ✅ ${server.name}`);
  } else {
    console.log(`  ❌ ${server.name}: ${server.error}`);
  }
});
```

**Claude Desktop Config Location**:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## Connection Testing

### `mcpTestConnection(name)`

Tests connectivity and functionality of an MCP server.

```typescript
async mcpTestConnection(name: string): Promise<string>
```

**Parameters**:
- `name` - Server name to test

**Returns**: Test result message

**Example**:
```typescript
try {
  const result = await api.mcpTestConnection('filesystem-server');
  console.log(`✅ Connection test passed: ${result}`);
} catch (error) {
  console.error(`❌ Connection test failed: ${error}`);
}
```

**Test Process**:
1. Validates server configuration
2. Attempts to start server process (stdio) or connect (sse)
3. Sends test messages to verify protocol compliance
4. Reports available tools/resources
5. Cleanly shuts down test connection

### `mcpGetServerStatus()`

Gets the current status of all MCP servers.

```typescript
async mcpGetServerStatus(): Promise<Record<string, ServerStatus>>
```

**Returns**: Map of server names to their current status

**Example**:
```typescript
const statuses = await api.mcpGetServerStatus();

Object.entries(statuses).forEach(([name, status]) => {
  console.log(`${name}: ${status.running ? '🟢' : '🔴'}`);
  
  if (status.error) {
    console.log(`  Error: ${status.error}`);
  }
  
  if (status.last_checked) {
    console.log(`  Last checked: ${new Date(status.last_checked)}`);
  }
});
```

**ServerStatus Structure**:
```typescript
interface ServerStatus {
  running: boolean;        // Whether server is currently running
  error?: string;         // Last error message if any
  last_checked?: number;  // Timestamp of last status check
}
```

## Project Integration

### `mcpReadProjectConfig(projectPath)`

Reads MCP configuration from a project's `.mcp.json` file.

```typescript
async mcpReadProjectConfig(projectPath: string): Promise<MCPProjectConfig>
```

**Parameters**:
- `projectPath` - Absolute path to project directory

**Returns**: Project MCP configuration

**Example**:
```typescript
const projectConfig = await api.mcpReadProjectConfig('/path/to/project');

console.log('Project MCP servers:');
Object.entries(projectConfig.mcpServers).forEach(([name, config]) => {
  console.log(`  ${name}: ${config.command} ${config.args.join(' ')}`);
});
```

### `mcpSaveProjectConfig(projectPath, config)`

Saves MCP configuration to a project's `.mcp.json` file.

```typescript
async mcpSaveProjectConfig(
  projectPath: string, 
  config: MCPProjectConfig
): Promise<string>
```

**Parameters**:
- `projectPath` - Project directory path
- `config` - MCP configuration to save

**Returns**: Success message

**Example**:
```typescript
const projectConfig: MCPProjectConfig = {
  mcpServers: {
    'project-linter': {
      command: 'node',
      args: ['./tools/linter-mcp.js'],
      env: {
        'PROJECT_ROOT': '/path/to/project',
        'LINT_CONFIG': './eslintrc.json'
      }
    },
    'test-runner': {
      command: 'python',
      args: ['-m', 'pytest_mcp'],
      env: {
        'PYTEST_ROOT': './tests'
      }
    }
  }
};

await api.mcpSaveProjectConfig('/path/to/project', projectConfig);
console.log('✅ Project MCP configuration saved');
```

**Project .mcp.json Format**:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "executable",
      "args": ["arg1", "arg2"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

### `mcpResetProjectChoices()`

Resets project-scoped server approval choices.

```typescript
async mcpResetProjectChoices(): Promise<string>
```

**Returns**: Success message

**Example**:
```typescript
const result = await api.mcpResetProjectChoices();
console.log(result); // "Project server choices reset"
```

### `mcpServe()`

Starts Claude Code as an MCP server for other applications.

```typescript
async mcpServe(): Promise<string>
```

**Returns**: Server startup message

**Example**:
```typescript
const message = await api.mcpServe();
console.log(`🖥️ MCP server started: ${message}`);
```

## Examples

### MCP Server Manager

```typescript
class MCPServerManager {
  async setupDevelopmentServers(projectPath: string): Promise<void> {
    console.log(`🔧 Setting up MCP servers for ${projectPath}`);

    // Add filesystem server for file operations
    await api.mcpAdd(
      'dev-filesystem',
      'stdio',
      'node',
      ['./mcp-servers/filesystem.js'],
      {
        'ALLOWED_PATHS': projectPath,
        'READ_ONLY': 'false'
      },
      undefined,
      'project'
    );

    // Add database server for development
    await api.mcpAdd(
      'dev-database',
      'stdio',
      'python',
      ['-m', 'mcp_database_server'],
      {
        'DB_URL': 'postgresql://localhost:5432/dev_db',
        'DB_SCHEMA': 'public'
      },
      undefined,
      'project'
    );

    // Add git server for version control operations
    await api.mcpAdd(
      'git-operations',
      'stdio',
      'node',
      ['./mcp-servers/git.js'],
      {
        'GIT_REPO': projectPath,
        'ALLOWED_OPERATIONS': 'read,status,diff'
      },
      undefined,
      'project'
    );

    console.log('✅ Development servers configured');
  }

  async testAllServers(): Promise<TestResults> {
    const servers = await api.mcpList();
    const results: TestResults = {
      total: servers.length,
      passed: 0,
      failed: 0,
      results: []
    };

    console.log(`🧪 Testing ${servers.length} MCP servers...`);

    for (const server of servers) {
      try {
        const result = await api.mcpTestConnection(server.name);
        console.log(`✅ ${server.name}: ${result}`);
        results.passed++;
        results.results.push({ name: server.name, success: true, message: result });
      } catch (error) {
        console.log(`❌ ${server.name}: ${error}`);
        results.failed++;
        results.results.push({ 
          name: server.name, 
          success: false, 
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log(`\n📊 Test Results: ${results.passed}/${results.total} passed`);
    return results;
  }

  async importFromClaudeDesktop(): Promise<void> {
    console.log('📥 Importing servers from Claude Desktop...');

    try {
      const importResult = await api.mcpAddFromClaudeDesktop('user');
      
      if (importResult.imported_count > 0) {
        console.log(`✅ Successfully imported ${importResult.imported_count} servers`);
        
        // Test imported servers
        const testResults = await this.testAllServers();
        console.log(`🧪 ${testResults.passed}/${testResults.total} imported servers working`);
      } else {
        console.log('ℹ️ No servers found in Claude Desktop configuration');
      }

      if (importResult.failed_count > 0) {
        console.log(`⚠️ Failed to import ${importResult.failed_count} servers:`);
        importResult.servers
          .filter(s => !s.success)
          .forEach(s => console.log(`  ❌ ${s.name}: ${s.error}`));
      }
    } catch (error) {
      console.error(`❌ Import failed: ${error}`);
    }
  }

  async exportServerConfig(serverName: string): Promise<string> {
    const server = await api.mcpGet(serverName);
    
    const config = {
      name: server.name,
      transport: server.transport,
      command: server.command,
      args: server.args,
      env: server.env,
      url: server.url
    };

    return JSON.stringify(config, null, 2);
  }

  async cloneServerConfig(sourceName: string, newName: string, modifications: Partial<MCPServer> = {}): Promise<void> {
    const source = await api.mcpGet(sourceName);
    
    await api.mcpAdd(
      newName,
      source.transport,
      modifications.command || source.command,
      modifications.args || source.args,
      { ...source.env, ...modifications.env },
      modifications.url || source.url,
      modifications.scope || source.scope
    );

    console.log(`✅ Cloned ${sourceName} → ${newName}`);
  }
}
```

### Project MCP Setup Wizard

```typescript
class ProjectMCPWizard {
  async setupProject(projectPath: string, projectType: string): Promise<void> {
    console.log(`🧙 Setting up MCP for ${projectType} project at ${projectPath}`);

    const serverConfigs = this.getServerConfigsForProjectType(projectType);
    
    for (const config of serverConfigs) {
      console.log(`📦 Adding ${config.name} server...`);
      
      const result = await api.mcpAdd(
        config.name,
        config.transport,
        config.command,
        config.args.map(arg => arg.replace('{{PROJECT_PATH}}', projectPath)),
        this.interpolateEnv(config.env, projectPath),
        config.url,
        'project'
      );

      if (result.success) {
        console.log(`  ✅ ${config.name} added successfully`);
        
        // Test the server
        try {
          await api.mcpTestConnection(config.name);
          console.log(`  🧪 ${config.name} test passed`);
        } catch (error) {
          console.log(`  ⚠️ ${config.name} test failed: ${error}`);
        }
      } else {
        console.log(`  ❌ Failed to add ${config.name}: ${result.message}`);
      }
    }

    // Save project configuration
    await this.saveProjectConfig(projectPath, serverConfigs);
    console.log('✅ Project MCP setup complete');
  }

  private getServerConfigsForProjectType(projectType: string): ServerConfig[] {
    const configs: Record<string, ServerConfig[]> = {
      'javascript': [
        {
          name: 'js-package-manager',
          transport: 'stdio',
          command: 'node',
          args: ['./mcp-servers/npm.js'],
          env: { 'PROJECT_ROOT': '{{PROJECT_PATH}}' }
        },
        {
          name: 'js-linter',
          transport: 'stdio', 
          command: 'node',
          args: ['./mcp-servers/eslint.js'],
          env: { 'PROJECT_ROOT': '{{PROJECT_PATH}}' }
        }
      ],
      'python': [
        {
          name: 'python-env',
          transport: 'stdio',
          command: 'python',
          args: ['-m', 'mcp_python_env'],
          env: { 'PROJECT_ROOT': '{{PROJECT_PATH}}' }
        },
        {
          name: 'python-linter',
          transport: 'stdio',
          command: 'python',
          args: ['-m', 'mcp_pylint'],
          env: { 'PROJECT_ROOT': '{{PROJECT_PATH}}' }
        }
      ],
      'rust': [
        {
          name: 'cargo-manager',
          transport: 'stdio',
          command: 'cargo',
          args: ['mcp-server'],
          env: { 'CARGO_MANIFEST_DIR': '{{PROJECT_PATH}}' }
        }
      ]
    };

    return configs[projectType] || [];
  }

  private interpolateEnv(env: Record<string, string>, projectPath: string): Record<string, string> {
    const interpolated: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(env)) {
      interpolated[key] = value.replace('{{PROJECT_PATH}}', projectPath);
    }
    
    return interpolated;
  }

  private async saveProjectConfig(projectPath: string, serverConfigs: ServerConfig[]): Promise<void> {
    const mcpConfig: MCPProjectConfig = {
      mcpServers: {}
    };

    for (const config of serverConfigs) {
      mcpConfig.mcpServers[config.name] = {
        command: config.command!,
        args: config.args,
        env: this.interpolateEnv(config.env, projectPath)
      };
    }

    await api.mcpSaveProjectConfig(projectPath, mcpConfig);
  }
}

// Usage
const wizard = new ProjectMCPWizard();
await wizard.setupProject('/path/to/my/project', 'javascript');
```

### MCP Health Monitor

```typescript
class MCPHealthMonitor {
  private monitorInterval?: NodeJS.Timeout;

  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    console.log(`🔍 Starting MCP server health monitoring (every ${intervalMs}ms)`);
    
    this.monitorInterval = setInterval(async () => {
      await this.checkServerHealth();
    }, intervalMs);

    // Initial check
    await this.checkServerHealth();
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
      console.log('🛑 Stopped MCP server monitoring');
    }
  }

  private async checkServerHealth(): Promise<void> {
    const servers = await api.mcpList();
    const statuses = await api.mcpGetServerStatus();
    
    const healthReport = {
      timestamp: new Date(),
      totalServers: servers.length,
      runningServers: 0,
      failedServers: 0,
      issues: [] as string[]
    };

    for (const server of servers) {
      const status = statuses[server.name];
      
      if (!status) {
        healthReport.issues.push(`${server.name}: No status information`);
        continue;
      }

      if (status.running) {
        healthReport.runningServers++;
      } else {
        healthReport.failedServers++;
        
        if (status.error) {
          healthReport.issues.push(`${server.name}: ${status.error}`);
        } else {
          healthReport.issues.push(`${server.name}: Not running`);
        }
      }
    }

    this.reportHealth(healthReport);
    
    // Auto-restart failed critical servers
    await this.autoRestart(healthReport);
  }

  private reportHealth(report: any): void {
    const healthPercentage = report.totalServers > 0 
      ? Math.round((report.runningServers / report.totalServers) * 100)
      : 100;

    console.log(`\n🏥 MCP Health Report - ${report.timestamp.toLocaleTimeString()}`);
    console.log(`📊 ${report.runningServers}/${report.totalServers} servers running (${healthPercentage}%)`);
    
    if (report.issues.length > 0) {
      console.log('⚠️ Issues:');
      report.issues.forEach(issue => console.log(`  ❌ ${issue}`));
    } else {
      console.log('✅ All servers healthy');
    }
  }

  private async autoRestart(report: any): Promise<void> {
    // Define critical servers that should auto-restart
    const criticalServers = ['filesystem-server', 'git-operations'];
    
    for (const issue of report.issues) {
      const serverName = issue.split(':')[0];
      
      if (criticalServers.includes(serverName)) {
        console.log(`🔄 Auto-restarting critical server: ${serverName}`);
        
        try {
          await api.mcpTestConnection(serverName);
          console.log(`✅ ${serverName} restarted successfully`);
        } catch (error) {
          console.log(`❌ Failed to restart ${serverName}: ${error}`);
        }
      }
    }
  }
}

// Usage
const monitor = new MCPHealthMonitor();
await monitor.startMonitoring(30000); // Check every 30 seconds

// Stop monitoring later
// monitor.stopMonitoring();
```

---

**Next**: Learn about [Usage Analytics API](./usage-analytics-api.md) for tracking token usage and costs.