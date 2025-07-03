# Error Handling

This guide covers error handling patterns, common error types, and best practices for robust error management when working with the Claudia API.

## Table of Contents
- [Error Handling Philosophy](#error-handling-philosophy)
- [Common Error Types](#common-error-types)
- [Error Handling Patterns](#error-handling-patterns)
- [Retry Strategies](#retry-strategies)
- [Error Recovery](#error-recovery)
- [Logging and Debugging](#logging-and-debugging)
- [Best Practices](#best-practices)

## Error Handling Philosophy

Claudia's API follows these error handling principles:

1. **Fail Fast**: Errors are detected and reported as early as possible
2. **Meaningful Messages**: Error messages provide context and actionable information
3. **Graceful Degradation**: When possible, operations continue with reduced functionality
4. **Consistent Patterns**: Similar operations use similar error handling approaches
5. **Recovery Support**: Errors include information to help with recovery

### Error Types Overview

```typescript
// All API methods use async/await with proper error propagation
try {
  const result = await api.someOperation();
  // Handle success
} catch (error) {
  // Handle error with specific patterns
}
```

## Common Error Types

### 1. Claude Code Installation Errors

**Cause**: Claude Code CLI not found or not working properly

```typescript
// Check Claude installation
try {
  const status = await api.checkClaudeVersion();
  if (!status.is_installed) {
    throw new Error(`Claude Code not found: ${status.output}`);
  }
} catch (error) {
  console.error('Claude installation check failed:', error.message);
  
  // Recovery: Guide user to install Claude Code
  console.log('Please install Claude Code from: https://claude.ai/code');
  console.log('Make sure it\'s accessible in your PATH');
}
```

**Common Solutions**:
- Install Claude Code CLI
- Add Claude to system PATH
- Use `setClaudeBinaryPath()` to specify custom location

### 2. File System Permission Errors

**Cause**: Insufficient permissions to read/write files or directories

```typescript
try {
  await api.saveClaudeMdFile('/protected/CLAUDE.md', content);
} catch (error) {
  if (error.message.includes('Permission denied')) {
    console.error('File permission error:', error.message);
    
    // Recovery options
    console.log('Try one of these solutions:');
    console.log('1. Run with appropriate permissions');
    console.log('2. Change file ownership: sudo chown $USER /protected/CLAUDE.md');
    console.log('3. Use a different file location');
  } else {
    throw error; // Re-throw if not a permission error
  }
}
```

### 3. Process Management Errors

**Cause**: Issues with running Claude Code or agent processes

```typescript
try {
  const runId = await api.executeAgent(agentId, projectPath, task);
  // Monitor for process failures
} catch (error) {
  if (error.message.includes('Failed to execute agent')) {
    console.error('Agent execution failed:', error.message);
    
    // Check system resources
    const runningProcesses = await api.listRunningAgentSessions();
    if (runningProcesses.length > 10) {
      console.warn('Many processes running, consider cleanup');
      await api.cleanupFinishedProcesses();
    }
    
    // Retry with different model or reduced load
    console.log('Retrying with Haiku model for reduced resource usage...');
    return await api.executeAgent(agentId, projectPath, task, 'haiku');
  }
}
```

### 4. Network and MCP Errors

**Cause**: MCP server connectivity issues or network problems

```typescript
try {
  await api.mcpTestConnection('my-server');
} catch (error) {
  console.error('MCP connection failed:', error.message);
  
  // Systematic troubleshooting
  const servers = await api.mcpList();
  const targetServer = servers.find(s => s.name === 'my-server');
  
  if (targetServer) {
    console.log('Server configuration:');
    console.log(`  Transport: ${targetServer.transport}`);
    console.log(`  Command: ${targetServer.command}`);
    console.log(`  Status: ${targetServer.status.running ? 'Running' : 'Stopped'}`);
    
    if (targetServer.status.error) {
      console.log(`  Last Error: ${targetServer.status.error}`);
    }
  }
}
```

### 5. Database Errors

**Cause**: SQLite database corruption or access issues

```typescript
try {
  const agents = await api.listAgents();
} catch (error) {
  if (error.message.includes('database')) {
    console.error('Database error:', error.message);
    
    // Check if database file exists and is accessible
    console.log('Database troubleshooting:');
    console.log('1. Check if Claudia has write permissions to app data directory');
    console.log('2. Ensure sufficient disk space');
    console.log('3. Try restarting Claudia to reinitialize database');
    
    // Fallback to read-only operations if possible
    console.log('Attempting read-only mode...');
  }
}
```

### 6. Session Management Errors

**Cause**: Session conflicts or invalid session states

```typescript
try {
  await api.resumeClaudeCode(projectPath, sessionId, prompt, model);
} catch (error) {
  if (error.message.includes('session not found')) {
    console.error('Session not found:', sessionId);
    
    // List available sessions
    const projects = await api.listProjects();
    const project = projects.find(p => p.path === projectPath);
    
    if (project) {
      const sessions = await api.getProjectSessions(project.id);
      console.log('Available sessions:');
      sessions.forEach(session => {
        console.log(`  ${session.id} - ${session.first_message?.slice(0, 50)}...`);
      });
    }
    
    // Offer to create new session
    console.log('Creating new session instead...');
    await api.executeClaudeCode(projectPath, prompt, model);
  }
}
```

## Error Handling Patterns

### 1. Defensive Programming Pattern

```typescript
class RobustClaudiaClient {
  async safeExecuteAgent(
    agentId: number, 
    projectPath: string, 
    task: string,
    options: { retries?: number; fallbackModel?: string } = {}
  ): Promise<number | null> {
    const { retries = 3, fallbackModel = 'haiku' } = options;
    
    // Validate inputs
    if (!agentId || !projectPath || !task) {
      throw new Error('Missing required parameters for agent execution');
    }
    
    // Check agent exists
    try {
      await api.getAgent(agentId);
    } catch (error) {
      throw new Error(`Agent ${agentId} not found: ${error.message}`);
    }
    
    // Check project path exists
    if (!await this.pathExists(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }
    
    // Attempt execution with retries
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const model = attempt === retries ? fallbackModel : 'sonnet';
        const runId = await api.executeAgent(agentId, projectPath, task, model);
        
        console.log(`✅ Agent execution started (attempt ${attempt}): ${runId}`);
        return runId;
        
      } catch (error) {
        console.warn(`⚠️ Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === retries) {
          console.error('❌ All attempts failed');
          return null;
        }
        
        // Wait before retry
        await this.delay(1000 * attempt);
      }
    }
    
    return null;
  }
  
  private async pathExists(path: string): Promise<boolean> {
    try {
      await api.listDirectoryContents(path);
      return true;
    } catch {
      return false;
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 2. Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold = 5,
    private timeout = 60000, // 1 minute
    private resetTime = 30000 // 30 seconds
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime > this.resetTime) {
        this.state = 'half-open';
        console.log('🔄 Circuit breaker moving to half-open state');
      } else {
        throw new Error('Circuit breaker is open - operation blocked');
      }
    }
    
    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.reset();
        console.log('✅ Circuit breaker reset to closed state');
      }
      
      return result;
      
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private recordFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      console.warn(`🚨 Circuit breaker opened after ${this.failures} failures`);
    }
  }
  
  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
  }
}

// Usage
const claudeCircuitBreaker = new CircuitBreaker();

async function resilientAgentExecution(agentId: number, projectPath: string, task: string): Promise<number | null> {
  try {
    return await claudeCircuitBreaker.execute(() => 
      api.executeAgent(agentId, projectPath, task)
    );
  } catch (error) {
    console.error('Circuit breaker blocked operation:', error.message);
    return null;
  }
}
```

### 3. Graceful Degradation Pattern

```typescript
class GracefulUsageAnalytics {
  async getUsageStatsWithFallback(): Promise<Partial<UsageStats>> {
    try {
      // Try to get full stats
      return await api.getUsageStats();
      
    } catch (error) {
      console.warn('Full usage stats failed, attempting partial data:', error.message);
      
      try {
        // Fallback to session stats only
        const sessionStats = await api.getSessionStats();
        
        return {
          total_sessions: sessionStats.length,
          by_project: sessionStats,
          total_cost: sessionStats.reduce((sum, p) => sum + p.total_cost, 0),
          total_tokens: sessionStats.reduce((sum, p) => sum + p.total_tokens, 0)
        };
        
      } catch (fallbackError) {
        console.warn('Session stats also failed:', fallbackError.message);
        
        // Final fallback - minimal data
        return {
          total_sessions: 0,
          total_cost: 0,
          total_tokens: 0,
          by_model: [],
          by_date: [],
          by_project: []
        };
      }
    }
  }
}
```

## Retry Strategies

### 1. Exponential Backoff

```typescript
async function executeWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Operation failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Unexpected end of retry loop');
}

// Usage
const projects = await executeWithBackoff(() => api.listProjects());
```

### 2. Conditional Retry

```typescript
async function retryWithConditions<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: Error, attempt: number) => boolean,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
      
    } catch (error) {
      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }
      
      console.log(`Retrying operation (attempt ${attempt + 1})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('Unexpected end of retry loop');
}

// Retry only for specific error types
const shouldRetryMCPConnection = (error: Error, attempt: number): boolean => {
  const retryableErrors = [
    'connection refused',
    'timeout',
    'network error',
    'server not ready'
  ];
  
  const isRetryable = retryableErrors.some(msg => 
    error.message.toLowerCase().includes(msg)
  );
  
  return isRetryable && attempt < 3;
};

// Usage
await retryWithConditions(
  () => api.mcpTestConnection('my-server'),
  shouldRetryMCPConnection
);
```

## Error Recovery

### 1. Session Recovery

```typescript
class SessionRecoveryManager {
  async recoverSession(
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<boolean> {
    try {
      console.log(`🔄 Attempting to recover session: ${sessionId}`);
      
      // Check if session exists in history
      const sessions = await api.getProjectSessions(projectId);
      const targetSession = sessions.find(s => s.id === sessionId);
      
      if (!targetSession) {
        console.error(`❌ Session ${sessionId} not found in project history`);
        return false;
      }
      
      // Try to load session history
      try {
        const history = await api.loadSessionHistory(sessionId, projectId);
        console.log(`✅ Session history loaded: ${history.length} messages`);
        
        // Check for corruption in history
        const validMessages = history.filter(msg => 
          msg && typeof msg === 'object' && msg.role && msg.content
        );
        
        if (validMessages.length < history.length) {
          console.warn(`⚠️ Found ${history.length - validMessages.length} corrupted messages`);
        }
        
        return true;
        
      } catch (historyError) {
        console.error(`❌ Failed to load session history: ${historyError.message}`);
        
        // Try checkpoint recovery if available
        return await this.recoverFromCheckpoints(sessionId, projectId, projectPath);
      }
      
    } catch (error) {
      console.error(`❌ Session recovery failed: ${error.message}`);
      return false;
    }
  }
  
  private async recoverFromCheckpoints(
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<boolean> {
    try {
      console.log('🔄 Attempting checkpoint recovery...');
      
      const checkpoints = await api.listCheckpoints(sessionId, projectId, projectPath);
      
      if (checkpoints.length === 0) {
        console.log('❌ No checkpoints available for recovery');
        return false;
      }
      
      // Find the most recent valid checkpoint
      const latestCheckpoint = checkpoints[checkpoints.length - 1];
      
      console.log(`📍 Restoring to checkpoint: ${latestCheckpoint.id}`);
      console.log(`📅 Created: ${latestCheckpoint.timestamp}`);
      
      const result = await api.restoreCheckpoint(
        latestCheckpoint.id,
        sessionId,
        projectId,
        projectPath
      );
      
      console.log(`✅ Checkpoint recovery successful`);
      console.log(`📁 Files restored: ${result.filesProcessed}`);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Checkpoint recovery failed: ${error.message}`);
      return false;
    }
  }
}
```

### 2. Process Recovery

```typescript
class ProcessRecoveryManager {
  private recoveryAttempts = new Map<number, number>();
  
  async monitorAndRecover(): Promise<void> {
    try {
      const runningProcesses = await api.listRunningAgentSessions();
      
      for (const process of runningProcesses) {
        await this.checkProcessHealth(process);
      }
      
    } catch (error) {
      console.error('Process monitoring failed:', error.message);
    }
  }
  
  private async checkProcessHealth(process: any): Promise<void> {
    try {
      // Check if process is actually running
      const status = await api.getSessionStatus(process.id);
      
      if (!status || status === 'failed') {
        console.warn(`🚨 Unhealthy process detected: ${process.id}`);
        await this.recoverProcess(process);
      }
      
    } catch (error) {
      console.warn(`Process health check failed for ${process.id}:`, error.message);
      await this.recoverProcess(process);
    }
  }
  
  private async recoverProcess(process: any): Promise<void> {
    const attempts = this.recoveryAttempts.get(process.id) || 0;
    
    if (attempts >= 3) {
      console.error(`❌ Max recovery attempts reached for process ${process.id}`);
      return;
    }
    
    this.recoveryAttempts.set(process.id, attempts + 1);
    
    try {
      console.log(`🔄 Attempting recovery for process ${process.id} (attempt ${attempts + 1})`);
      
      // Kill the problematic process
      await api.killAgentSession(process.id);
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Restart the agent if it was an agent run
      if (process.agent_id && process.project_path && process.task) {
        console.log(`🚀 Restarting agent ${process.agent_name}...`);
        
        const newRunId = await api.executeAgent(
          process.agent_id,
          process.project_path,
          process.task,
          'haiku' // Use lighter model for recovery
        );
        
        console.log(`✅ Agent restarted with new run ID: ${newRunId}`);
        
        // Clear recovery attempts on success
        this.recoveryAttempts.delete(process.id);
      }
      
    } catch (error) {
      console.error(`❌ Process recovery failed: ${error.message}`);
    }
  }
}
```

## Logging and Debugging

### 1. Structured Logging

```typescript
enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

class ClaudiaLogger {
  constructor(private level: LogLevel = LogLevel.INFO) {}
  
  error(message: string, error?: Error, context?: any): void {
    this.log(LogLevel.ERROR, message, { error: error?.message, stack: error?.stack, ...context });
  }
  
  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  private log(level: LogLevel, message: string, context?: any): void {
    if (!this.shouldLog(level)) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context
    };
    
    console.log(JSON.stringify(logEntry, null, 2));
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    return levels.indexOf(level) <= levels.indexOf(this.level);
  }
}

// Usage
const logger = new ClaudiaLogger(LogLevel.DEBUG);

try {
  await api.executeAgent(agentId, projectPath, task);
  logger.info('Agent execution started', { agentId, projectPath });
} catch (error) {
  logger.error('Agent execution failed', error, { agentId, projectPath, task });
}
```

### 2. Debug Helper Functions

```typescript
class ClaudiaDebugger {
  static async diagnosticReport(): Promise<void> {
    console.log('🔍 Claudia Diagnostic Report');
    console.log('=' .repeat(50));
    
    // Claude installation
    try {
      const version = await api.checkClaudeVersion();
      console.log(`✅ Claude Code: ${version.is_installed ? version.version : 'Not found'}`);
    } catch (error) {
      console.log(`❌ Claude Code: Error checking - ${error.message}`);
    }
    
    // Database access
    try {
      const agents = await api.listAgents();
      console.log(`✅ Database: ${agents.length} agents found`);
    } catch (error) {
      console.log(`❌ Database: ${error.message}`);
    }
    
    // MCP servers
    try {
      const servers = await api.mcpList();
      const running = servers.filter(s => s.status.running).length;
      console.log(`✅ MCP Servers: ${running}/${servers.length} running`);
    } catch (error) {
      console.log(`❌ MCP Servers: ${error.message}`);
    }
    
    // Running processes
    try {
      const processes = await api.listRunningAgentSessions();
      console.log(`✅ Active Processes: ${processes.length}`);
    } catch (error) {
      console.log(`❌ Active Processes: ${error.message}`);
    }
    
    // Usage data
    try {
      const stats = await api.getUsageStats();
      console.log(`✅ Usage Data: ${stats.total_sessions} sessions, $${stats.total_cost.toFixed(4)} total cost`);
    } catch (error) {
      console.log(`❌ Usage Data: ${error.message}`);
    }
    
    console.log('=' .repeat(50));
  }
  
  static async troubleshootProject(projectPath: string): Promise<void> {
    console.log(`🔧 Troubleshooting project: ${projectPath}`);
    
    // Check project exists
    try {
      await api.listDirectoryContents(projectPath);
      console.log('✅ Project directory accessible');
    } catch (error) {
      console.log(`❌ Project directory: ${error.message}`);
      return;
    }
    
    // Check for CLAUDE.md files
    try {
      const claudeFiles = await api.findClaudeMdFiles(projectPath);
      console.log(`✅ CLAUDE.md files: ${claudeFiles.length} found`);
    } catch (error) {
      console.log(`❌ CLAUDE.md files: ${error.message}`);
    }
    
    // Check project in Claude system
    try {
      const projects = await api.listProjects();
      const project = projects.find(p => p.path === projectPath);
      
      if (project) {
        console.log(`✅ Project tracked: ${project.sessions.length} sessions`);
      } else {
        console.log('⚠️ Project not yet tracked by Claude Code');
      }
    } catch (error) {
      console.log(`❌ Project lookup: ${error.message}`);
    }
  }
}
```

## Best Practices

### 1. Error Context Preservation

```typescript
class ContextualError extends Error {
  constructor(
    message: string,
    public context: Record<string, any>,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ContextualError';
  }
}

// Wrap API calls with context
async function contextualApiCall<T>(
  operation: () => Promise<T>,
  context: Record<string, any>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ContextualError(
      `Operation failed: ${error.message}`,
      context,
      error instanceof Error ? error : undefined
    );
  }
}

// Usage
try {
  await contextualApiCall(
    () => api.executeAgent(agentId, projectPath, task),
    { agentId, projectPath, task, timestamp: new Date().toISOString() }
  );
} catch (error) {
  if (error instanceof ContextualError) {
    console.error('Contextual error:', error.message);
    console.error('Context:', error.context);
    console.error('Original error:', error.originalError?.message);
  }
}
```

### 2. Error Aggregation

```typescript
class ErrorCollector {
  private errors: Array<{ operation: string; error: Error; timestamp: Date }> = [];
  
  async executeWithCollection<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      this.errors.push({
        operation: operationName,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      return null;
    }
  }
  
  hasErrors(): boolean {
    return this.errors.length > 0;
  }
  
  getErrorSummary(): string {
    if (this.errors.length === 0) return 'No errors collected';
    
    return this.errors.map(({ operation, error, timestamp }) => 
      `${timestamp.toISOString()} - ${operation}: ${error.message}`
    ).join('\n');
  }
  
  clear(): void {
    this.errors = [];
  }
}

// Usage for batch operations
async function batchProcessProjects(projectPaths: string[]): Promise<void> {
  const errorCollector = new ErrorCollector();
  
  for (const path of projectPaths) {
    await errorCollector.executeWithCollection(
      () => processProject(path),
      `Process project: ${path}`
    );
  }
  
  if (errorCollector.hasErrors()) {
    console.error('Batch processing completed with errors:');
    console.error(errorCollector.getErrorSummary());
  } else {
    console.log('Batch processing completed successfully');
  }
}
```

### 3. Resource Cleanup

```typescript
class ResourceManager {
  private resources: Array<() => Promise<void>> = [];
  
  addCleanup(cleanup: () => Promise<void>): void {
    this.resources.push(cleanup);
  }
  
  async cleanup(): Promise<void> {
    const errors: Error[] = [];
    
    // Cleanup in reverse order
    for (const cleanup of this.resources.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    this.resources = [];
    
    if (errors.length > 0) {
      throw new Error(`Cleanup failed: ${errors.map(e => e.message).join(', ')}`);
    }
  }
}

// Usage
async function complexOperation(): Promise<void> {
  const resources = new ResourceManager();
  
  try {
    // Start agent
    const runId = await api.executeAgent(agentId, projectPath, task);
    resources.addCleanup(() => api.killAgentSession(runId));
    
    // Create checkpoint
    const checkpoint = await api.createCheckpoint(sessionId, projectId, projectPath);
    resources.addCleanup(() => console.log(`Checkpoint ${checkpoint.checkpoint.id} created`));
    
    // Do work...
    
  } finally {
    await resources.cleanup();
  }
}
```

---

This comprehensive error handling guide provides the patterns and tools needed to build robust applications with the Claudia API. Remember to always handle errors gracefully and provide meaningful feedback to users.