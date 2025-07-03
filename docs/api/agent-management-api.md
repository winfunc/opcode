# Agent Management API

The Agent Management API provides comprehensive functionality for creating, managing, and executing custom AI agents. Agents are specialized AI assistants with custom system prompts, configurable models, and execution tracking capabilities.

## Table of Contents
- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Agent CRUD Operations](#agent-crud-operations)
- [Agent Execution](#agent-execution)
- [Run Management](#run-management)
- [Import/Export System](#importexport-system)
- [GitHub Integration](#github-integration)
- [Real-time Monitoring](#real-time-monitoring)
- [Examples](#examples)

## Overview

Agents in Claudia are custom AI assistants that can be:
- **Created with specialized prompts** for specific tasks
- **Configured with different models** (Sonnet, Haiku, Opus)
- **Executed on any project** with custom tasks
- **Tracked with detailed metrics** and performance data
- **Shared via GitHub** for community collaboration
- **Imported/exported** as JSON files

### Agent Lifecycle
```
Create → Configure → Execute → Monitor → Complete → Analyze
   ↓        ↓          ↓         ↓         ↓         ↓
Database  Settings   Process   Metrics   Cleanup   History
```

## Core Concepts

### Agent Structure
```typescript
interface Agent {
  id?: number;               // Unique agent identifier
  name: string;             // Display name
  icon: string;             // Icon identifier ('bot', 'shield', etc.)
  system_prompt: string;    // Custom system instructions
  default_task?: string;    // Default task description
  model: string;           // Claude model ('sonnet', 'haiku', 'opus')
  created_at: string;      // Creation timestamp
  updated_at: string;      // Last modification timestamp
}
```

### Agent Run Tracking
Each agent execution creates an `AgentRun` record with:
- **Execution metadata** (agent, project, task)
- **Process information** (PID, status, timing)
- **Performance metrics** (tokens, cost, duration)
- **Real-time output** (JSONL session data)

### Available Icons
- `bot` - 🤖 General purpose
- `shield` - 🛡️ Security related  
- `code` - 💻 Development
- `terminal` - 🖥️ System/CLI
- `database` - 🗄️ Data operations
- `globe` - 🌐 Network/Web
- `file-text` - 📄 Documentation
- `git-branch` - 🌿 Version control

## Agent CRUD Operations

### `listAgents()`

Retrieves all created agents from the local database.

```typescript
async listAgents(): Promise<Agent[]>
```

**Returns**: Array of all agents with their configurations

**Example**:
```typescript
const agents = await api.listAgents();

agents.forEach(agent => {
  console.log(`🤖 ${agent.name} (${agent.model})`);
  console.log(`   Icon: ${agent.icon}`);
  console.log(`   Created: ${agent.created_at}`);
  console.log(`   Prompt: ${agent.system_prompt.slice(0, 100)}...`);
});
```

### `createAgent(name, icon, systemPrompt, defaultTask?, model?)`

Creates a new agent with the specified configuration.

```typescript
async createAgent(
  name: string,
  icon: string,
  system_prompt: string,
  default_task?: string,
  model?: string
): Promise<Agent>
```

**Parameters**:
- `name` - Display name for the agent
- `icon` - Icon identifier (see available icons above)
- `system_prompt` - Custom system instructions for the agent
- `default_task` - Optional default task description
- `model` - Optional model override (defaults to 'sonnet')

**Returns**: Created agent with assigned ID

**Example**:
```typescript
const codeReviewer = await api.createAgent(
  'Code Security Reviewer',
  'shield',
  `You are an expert security-focused code reviewer. Your role is to:

1. Identify potential security vulnerabilities
2. Check for common coding mistakes  
3. Suggest improvements for code quality
4. Ensure best practices are followed

Focus on:
- Input validation and sanitization
- Authentication and authorization issues
- SQL injection and XSS vulnerabilities
- Error handling and information disclosure
- Dependency security concerns

Provide specific, actionable feedback with code examples.`,
  'Review the codebase for security vulnerabilities and code quality issues',
  'opus'
);

console.log(`Created agent: ${codeReviewer.name} (ID: ${codeReviewer.id})`);
```

### `updateAgent(id, name, icon, systemPrompt, defaultTask?, model?)`

Updates an existing agent's configuration.

```typescript
async updateAgent(
  id: number,
  name: string,
  icon: string,
  system_prompt: string,
  default_task?: string,
  model?: string
): Promise<Agent>
```

**Parameters**: Same as `createAgent` plus the agent `id`

**Example**:
```typescript
const updatedAgent = await api.updateAgent(
  codeReviewer.id!,
  'Advanced Security Reviewer',
  'shield',
  codeReviewer.system_prompt + '\n\nAlso check for performance issues.',
  'Comprehensive security and performance review',
  'opus'
);
```

### `getAgent(id)`

Retrieves a specific agent by ID.

```typescript
async getAgent(id: number): Promise<Agent>
```

**Parameters**:
- `id` - Agent ID to retrieve

**Returns**: Agent configuration

### `deleteAgent(id)`

Deletes an agent from the database.

```typescript
async deleteAgent(id: number): Promise<void>
```

**Parameters**:
- `id` - Agent ID to delete

**Example**:
```typescript
await api.deleteAgent(oldAgent.id!);
console.log('Agent deleted successfully');
```

**Note**: Deleting an agent does not affect historical runs, which are preserved for analytics.

## Agent Execution

### `executeAgent(agentId, projectPath, task, model?)`

Executes an agent on a specific project with a given task.

```typescript
async executeAgent(
  agentId: number,
  projectPath: string,
  task: string,
  model?: string
): Promise<number>
```

**Parameters**:
- `agentId` - ID of the agent to execute
- `projectPath` - Absolute path to the project directory
- `task` - Specific task description for this execution
- `model` - Optional model override for this execution

**Returns**: Run ID for tracking the execution

**Example**:
```typescript
const runId = await api.executeAgent(
  codeReviewer.id!,
  '/path/to/my/project',
  'Review the authentication module for security issues',
  'opus' // Override to use Opus for this critical review
);

console.log(`Started execution with run ID: ${runId}`);
```

**Execution Process**:
1. Creates new `AgentRun` record in database
2. Spawns Claude Code process with agent's system prompt
3. Runs in background with real-time output streaming
4. Updates run status and metrics as execution progresses
5. Completes with final metrics and output

### Execution Status Flow
```
pending → running → completed
   ↓         ↓         ↓
created   executing  finished
   ↓         ↓         ↓
database  process   metrics
```

## Run Management

### `listAgentRuns(agentId?)`

Lists agent execution runs with detailed metrics.

```typescript
async listAgentRuns(agentId?: number): Promise<AgentRunWithMetrics[]>
```

**Parameters**:
- `agentId` - Optional filter to show runs for specific agent only

**Returns**: Array of agent runs with performance metrics

**Example**:
```typescript
// Get all runs
const allRuns = await api.listAgentRuns();

// Get runs for specific agent
const agentRuns = await api.listAgentRuns(codeReviewer.id!);

agentRuns.forEach(run => {
  console.log(`🏃 Run ${run.id}: ${run.status}`);
  console.log(`   Task: ${run.task}`);
  console.log(`   Project: ${run.project_path}`);
  console.log(`   Started: ${run.created_at}`);
  
  if (run.metrics) {
    console.log(`   Duration: ${run.metrics.duration_ms}ms`);
    console.log(`   Tokens: ${run.metrics.total_tokens}`);
    console.log(`   Cost: $${run.metrics.cost_usd}`);
  }
});
```

### `getAgentRun(id)`

Retrieves detailed information about a specific agent run.

```typescript
async getAgentRun(id: number): Promise<AgentRunWithMetrics>
```

**Parameters**:
- `id` - Run ID to retrieve

**Returns**: Complete run information with metrics

### `getAgentRunWithRealTimeMetrics(id)`

Gets agent run information with live metrics calculated from JSONL output.

```typescript
async getAgentRunWithRealTimeMetrics(id: number): Promise<AgentRunWithMetrics>
```

**Parameters**:
- `id` - Run ID to retrieve

**Returns**: Run information with real-time calculated metrics

**Example**:
```typescript
const run = await api.getAgentRunWithRealTimeMetrics(runId);

console.log(`Agent: ${run.agent_name}`);
console.log(`Status: ${run.status}`);
console.log(`Project: ${run.project_path}`);

if (run.metrics) {
  console.log(`Real-time metrics:`);
  console.log(`  Messages: ${run.metrics.message_count}`);
  console.log(`  Tokens: ${run.metrics.total_tokens}`);
  console.log(`  Cost: $${run.metrics.cost_usd?.toFixed(4)}`);
  console.log(`  Duration: ${run.metrics.duration_ms}ms`);
}

if (run.output) {
  console.log(`Latest output preview:`);
  const lines = run.output.split('\n').filter(line => line.trim());
  const lastLine = lines[lines.length - 1];
  if (lastLine) {
    try {
      const lastMessage = JSON.parse(lastLine);
      console.log(`  ${lastMessage.role}: ${lastMessage.content.slice(0, 100)}...`);
    } catch (e) {
      console.log(`  Raw: ${lastLine.slice(0, 100)}...`);
    }
  }
}
```

## Import/Export System

### `exportAgent(id)`

Exports an agent to JSON format for sharing or backup.

```typescript
async exportAgent(id: number): Promise<string>
```

**Parameters**:
- `id` - Agent ID to export

**Returns**: JSON string containing agent configuration

**Example**:
```typescript
const agentJson = await api.exportAgent(codeReviewer.id!);
console.log('Exported agent:', agentJson);

// Save to file (using Tauri file operations)
await writeTextFile('security-reviewer.claudia.json', agentJson);
```

**Export Format**:
```json
{
  "version": 1,
  "exported_at": "2024-01-01T10:00:00.000Z",
  "agent": {
    "name": "Code Security Reviewer",
    "icon": "shield",
    "system_prompt": "You are an expert security-focused code reviewer...",
    "default_task": "Review the codebase for security vulnerabilities",
    "model": "opus"
  }
}
```

### `importAgent(jsonData)`

Imports an agent from JSON data.

```typescript
async importAgent(jsonData: string): Promise<Agent>
```

**Parameters**:
- `jsonData` - JSON string containing agent export data

**Returns**: Imported agent with new assigned ID

**Example**:
```typescript
const agentJson = await readTextFile('shared-agent.claudia.json');
const importedAgent = await api.importAgent(agentJson);

console.log(`Imported agent: ${importedAgent.name} (ID: ${importedAgent.id})`);
```

### `importAgentFromFile(filePath)`

Imports an agent directly from a file path.

```typescript
async importAgentFromFile(filePath: string): Promise<Agent>
```

**Parameters**:
- `filePath` - Path to the `.claudia.json` file

**Returns**: Imported agent

**Example**:
```typescript
const agent = await api.importAgentFromFile('/downloads/awesome-agent.claudia.json');
```

## GitHub Integration

### `fetchGitHubAgents()`

Fetches the list of available agents from the official GitHub repository.

```typescript
async fetchGitHubAgents(): Promise<GitHubAgentFile[]>
```

**Returns**: Array of available agents on GitHub

**Example**:
```typescript
const githubAgents = await api.fetchGitHubAgents();

githubAgents.forEach(agent => {
  console.log(`📦 ${agent.name}`);
  console.log(`   Size: ${agent.size} bytes`);
  console.log(`   Download: ${agent.download_url}`);
});
```

### `fetchGitHubAgentContent(downloadUrl)`

Previews an agent from GitHub before importing.

```typescript
async fetchGitHubAgentContent(downloadUrl: string): Promise<AgentExport>
```

**Parameters**:
- `downloadUrl` - Download URL from GitHub API

**Returns**: Agent export data for preview

**Example**:
```typescript
const agentData = await api.fetchGitHubAgentContent(
  'https://raw.githubusercontent.com/getAsterisk/claudia/main/cc_agents/security-scanner.claudia.json'
);

console.log(`Preview: ${agentData.agent.name}`);
console.log(`Model: ${agentData.agent.model}`);
console.log(`Description: ${agentData.agent.system_prompt.slice(0, 200)}...`);
```

### `importAgentFromGitHub(downloadUrl)`

Imports an agent directly from GitHub.

```typescript
async importAgentFromGitHub(downloadUrl: string): Promise<Agent>
```

**Parameters**:
- `downloadUrl` - GitHub raw file URL

**Returns**: Imported agent with assigned ID

**Example**:
```typescript
const securityScanner = await api.importAgentFromGitHub(
  'https://raw.githubusercontent.com/getAsterisk/claudia/main/cc_agents/security-scanner.claudia.json'
);

console.log(`Imported from GitHub: ${securityScanner.name}`);
```

## Real-time Monitoring

### Running Session Management

```typescript
// List all running agent sessions
const runningAgents = await api.listRunningAgentSessions();

runningAgents.forEach(session => {
  console.log(`🏃 Agent: ${session.agent_name}`);
  console.log(`   Status: ${session.status}`);
  console.log(`   PID: ${session.pid}`);
  console.log(`   Started: ${session.process_started_at}`);
});
```

### Session Control

```typescript
// Kill a specific agent session
const killed = await api.killAgentSession(runId);
if (killed) {
  console.log('✅ Agent session terminated successfully');
} else {
  console.log('❌ Failed to terminate session');
}

// Check session status
const status = await api.getSessionStatus(runId);
console.log(`Session status: ${status}`);
```

### Live Output Monitoring

```typescript
// Get current session output
const output = await api.getSessionOutput(runId);
console.log('Current output:', output);

// Get live output buffer
const liveOutput = await api.getLiveSessionOutput(runId);
console.log('Live buffer:', liveOutput);

// Start streaming output
await api.streamSessionOutput(runId);
// Output will be streamed via events
```

### Process Cleanup

```typescript
// Clean up finished processes
const cleanedIds = await api.cleanupFinishedProcesses();
console.log(`Cleaned up ${cleanedIds.length} finished processes`);
```

## Examples

### Agent Factory

```typescript
class AgentFactory {
  static async createCodeReviewer(): Promise<Agent> {
    return await api.createAgent(
      'Code Reviewer',
      'code',
      `You are an expert code reviewer. Analyze code for:
      - Code quality and maintainability
      - Performance issues
      - Security vulnerabilities  
      - Best practice adherence
      - Documentation completeness
      
      Provide specific, actionable feedback.`,
      'Review the codebase for quality and best practices',
      'sonnet'
    );
  }

  static async createTestGenerator(): Promise<Agent> {
    return await api.createAgent(
      'Test Generator',
      'terminal',
      `You are a testing expert. Generate comprehensive test suites:
      - Unit tests for individual functions
      - Integration tests for components
      - Edge case testing
      - Mock implementations
      - Test documentation
      
      Follow testing best practices and use appropriate frameworks.`,
      'Generate comprehensive tests for the codebase',
      'sonnet'
    );
  }

  static async createDocumentationBot(): Promise<Agent> {
    return await api.createAgent(
      'Documentation Bot',
      'file-text',
      `You are a technical writing expert. Create clear documentation:
      - API documentation
      - Code comments
      - README files
      - User guides
      - Architecture documentation
      
      Write for clarity and include practical examples.`,
      'Create comprehensive documentation for the project',
      'haiku'
    );
  }
}

// Create a suite of development agents
const codeReviewer = await AgentFactory.createCodeReviewer();
const testGenerator = await AgentFactory.createTestGenerator();
const docBot = await AgentFactory.createDocumentationBot();
```

### Automated Code Review Pipeline

```typescript
class CodeReviewPipeline {
  private agents: Agent[] = [];

  async initialize() {
    // Load or create review agents
    const allAgents = await api.listAgents();
    
    this.agents = [
      this.findOrCreateAgent(allAgents, 'Security Reviewer', 'shield'),
      this.findOrCreateAgent(allAgents, 'Performance Reviewer', 'terminal'),
      this.findOrCreateAgent(allAgents, 'Quality Reviewer', 'code')
    ];
  }

  private async findOrCreateAgent(existing: Agent[], name: string, icon: string): Promise<Agent> {
    const found = existing.find(a => a.name === name);
    if (found) return found;

    // Create if not found
    return await api.createAgent(
      name,
      icon,
      this.getSystemPromptFor(name),
      `Review code for ${name.toLowerCase().replace(' reviewer', '')} issues`,
      'sonnet'
    );
  }

  private getSystemPromptFor(agentType: string): string {
    const prompts = {
      'Security Reviewer': 'Focus on security vulnerabilities, input validation, and auth issues.',
      'Performance Reviewer': 'Analyze for performance bottlenecks and optimization opportunities.',
      'Quality Reviewer': 'Review code quality, maintainability, and best practices.'
    };
    return prompts[agentType] || 'General code review assistant.';
  }

  async reviewProject(projectPath: string): Promise<ReviewResults> {
    console.log(`🔍 Starting comprehensive review of ${projectPath}`);
    
    const results: ReviewResults = {
      projectPath,
      reviews: [],
      startTime: new Date(),
      endTime: null
    };

    // Execute all agents in parallel
    const runPromises = this.agents.map(async (agent) => {
      console.log(`🚀 Starting ${agent.name}...`);
      
      const runId = await api.executeAgent(
        agent.id!,
        projectPath,
        `Perform a thorough ${agent.name.toLowerCase()} of this codebase`
      );

      return this.monitorAgentRun(agent, runId);
    });

    // Wait for all reviews to complete
    const agentResults = await Promise.all(runPromises);
    
    results.reviews = agentResults;
    results.endTime = new Date();
    
    console.log(`✅ Review completed in ${this.getDuration(results)}ms`);
    return results;
  }

  private async monitorAgentRun(agent: Agent, runId: number): Promise<AgentReviewResult> {
    console.log(`📊 Monitoring ${agent.name} (Run ID: ${runId})`);
    
    let run: AgentRunWithMetrics;
    
    // Poll until completion
    do {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      run = await api.getAgentRunWithRealTimeMetrics(runId);
      
      if (run.status === 'running' && run.metrics) {
        console.log(`   💭 ${agent.name}: ${run.metrics.total_tokens} tokens, ${run.metrics.message_count} messages`);
      }
    } while (run.status === 'running' || run.status === 'pending');

    console.log(`✅ ${agent.name} completed with status: ${run.status}`);
    
    return {
      agent: agent.name,
      runId,
      status: run.status,
      metrics: run.metrics,
      output: run.output,
      findings: this.extractFindings(run.output)
    };
  }

  private extractFindings(output?: string): string[] {
    if (!output) return [];
    
    // Parse JSONL and extract assistant messages
    const findings: string[] = [];
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        if (message.role === 'assistant' && message.content) {
          findings.push(message.content);
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
    
    return findings;
  }

  private getDuration(results: ReviewResults): number {
    if (!results.endTime) return 0;
    return results.endTime.getTime() - results.startTime.getTime();
  }
}

// Usage
const pipeline = new CodeReviewPipeline();
await pipeline.initialize();

const results = await pipeline.reviewProject('/path/to/my/project');
console.log('Review Results:', results);
```

### Agent Performance Analytics

```typescript
class AgentAnalytics {
  async getAgentPerformanceReport(agentId?: number): Promise<PerformanceReport> {
    const runs = await api.listAgentRuns(agentId);
    
    const report: PerformanceReport = {
      totalRuns: runs.length,
      successfulRuns: runs.filter(r => r.status === 'completed').length,
      failedRuns: runs.filter(r => r.status === 'failed').length,
      averageTokens: 0,
      averageCost: 0,
      averageDuration: 0,
      totalCost: 0,
      recentRuns: runs.slice(-10)
    };

    // Calculate averages from completed runs
    const completedRuns = runs.filter(r => r.status === 'completed' && r.metrics);
    
    if (completedRuns.length > 0) {
      report.averageTokens = this.average(completedRuns.map(r => r.metrics!.total_tokens || 0));
      report.averageCost = this.average(completedRuns.map(r => r.metrics!.cost_usd || 0));
      report.averageDuration = this.average(completedRuns.map(r => r.metrics!.duration_ms || 0));
      report.totalCost = completedRuns.reduce((sum, r) => sum + (r.metrics!.cost_usd || 0), 0);
    }

    return report;
  }

  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  async printAgentSummary(): Promise<void> {
    const agents = await api.listAgents();
    
    console.log('\n📊 Agent Performance Summary\n');
    console.log('Agent Name'.padEnd(25) + 'Runs'.padEnd(8) + 'Success%'.padEnd(10) + 'Avg Cost'.padEnd(12) + 'Total Cost');
    console.log('-'.repeat(70));
    
    for (const agent of agents) {
      const report = await this.getAgentPerformanceReport(agent.id!);
      const successRate = report.totalRuns > 0 ? (report.successfulRuns / report.totalRuns * 100).toFixed(1) : '0.0';
      
      console.log(
        agent.name.padEnd(25) +
        report.totalRuns.toString().padEnd(8) +
        `${successRate}%`.padEnd(10) +
        `$${report.averageCost.toFixed(4)}`.padEnd(12) +
        `$${report.totalCost.toFixed(4)}`
      );
    }
    
    console.log('-'.repeat(70));
  }
}

// Usage
const analytics = new AgentAnalytics();
await analytics.printAgentSummary();
```

---

**Next**: Learn about [MCP Server API](./mcp-server-api.md) for Model Context Protocol integration.