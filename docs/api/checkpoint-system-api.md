# Checkpoint System API

The Checkpoint System API provides session versioning and timeline management capabilities, allowing you to create snapshots of session state, branch conversations, and restore to previous points in time.

## Table of Contents
- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Checkpoint Management](#checkpoint-management)
- [Timeline Navigation](#timeline-navigation)
- [File Snapshots](#file-snapshots)
- [Branching and Forking](#branching-and-forking)
- [Automatic Checkpoints](#automatic-checkpoints)
- [Examples](#examples)

## Overview

The checkpoint system provides Git-like versioning for Claude Code sessions, enabling:

- **Session Snapshots** - Capture complete session state at any point
- **Timeline Management** - Navigate through session history with branching
- **File Versioning** - Track file system changes across checkpoints
- **Conversation Branching** - Fork sessions to explore different paths
- **Automatic Checkpoints** - Smart checkpoint creation based on triggers
- **Diff Analysis** - Compare changes between checkpoints

### Checkpoint Architecture
```
Session Timeline:
    A ─── B ─── C ─── D (main branch)
          │
          └─── E ─── F (feature branch)
               │
               └─── G (experiment branch)

Each node represents a checkpoint with:
- Session state snapshot
- File system snapshot  
- Conversation context
- Metadata and metrics
```

## Core Concepts

### Checkpoint Structure
```typescript
interface Checkpoint {
  id: string;                    // Unique checkpoint identifier
  sessionId: string;             // Parent session ID
  projectId: string;             // Project identifier
  messageIndex: number;          // Position in conversation
  timestamp: string;             // Creation time
  description?: string;          // Optional description
  parentCheckpointId?: string;   // Parent checkpoint (for branching)
  metadata: CheckpointMetadata;  // Additional information
}
```

### Checkpoint Metadata
```typescript
interface CheckpointMetadata {
  totalTokens: number;           // Token count at checkpoint
  modelUsed: string;             // Claude model used
  userPrompt: string;            // User message that triggered checkpoint
  fileChanges: number;           // Number of file modifications
  snapshotSize: number;          // Size of file snapshot data
}
```

### Timeline Structure
- **Linear Timeline**: Sequential checkpoints in a single conversation
- **Branching Timeline**: Multiple conversation paths from common checkpoints
- **Root Node**: Initial checkpoint when session starts
- **Current Node**: Active checkpoint position

### Checkpoint Strategies
- **manual**: Only create checkpoints when explicitly requested
- **per_prompt**: Create checkpoint after each user message
- **per_tool_use**: Create checkpoint after tool usage
- **smart**: Intelligent checkpoint creation based on content analysis

## Checkpoint Management

### `createCheckpoint(sessionId, projectId, projectPath, messageIndex?, description?)`

Creates a new checkpoint capturing the current session state.

```typescript
async createCheckpoint(
  sessionId: string,
  projectId: string,
  projectPath: string,
  messageIndex?: number,
  description?: string
): Promise<CheckpointResult>
```

**Parameters**:
- `sessionId` - Session UUID to checkpoint
- `projectId` - Project identifier
- `projectPath` - Absolute path to project directory
- `messageIndex` - Optional specific message position
- `description` - Optional checkpoint description

**Returns**: Checkpoint creation result with metadata

**Example**:
```typescript
const result = await api.createCheckpoint(
  'session-uuid-123',
  'project-id',
  '/path/to/project',
  5,
  'Implemented user authentication'
);

console.log(`✅ Checkpoint created: ${result.checkpoint.id}`);
console.log(`📁 Files processed: ${result.filesProcessed}`);
console.log(`⚠️ Warnings: ${result.warnings.length}`);

if (result.warnings.length > 0) {
  result.warnings.forEach(warning => {
    console.log(`  ⚠️ ${warning}`);
  });
}

// Access checkpoint details
const checkpoint = result.checkpoint;
console.log(`🏷️ Description: ${checkpoint.description}`);
console.log(`🔢 Total tokens: ${checkpoint.metadata.totalTokens}`);
console.log(`📝 Files changed: ${checkpoint.metadata.fileChanges}`);
console.log(`💾 Snapshot size: ${checkpoint.metadata.snapshotSize} bytes`);
```

### `listCheckpoints(sessionId, projectId, projectPath)`

Lists all checkpoints for a specific session.

```typescript
async listCheckpoints(
  sessionId: string,
  projectId: string,
  projectPath: string
): Promise<Checkpoint[]>
```

**Returns**: Array of checkpoints ordered by creation time

**Example**:
```typescript
const checkpoints = await api.listCheckpoints(
  'session-uuid-123',
  'project-id',
  '/path/to/project'
);

console.log(`📋 Found ${checkpoints.length} checkpoints:`);

checkpoints.forEach((checkpoint, index) => {
  console.log(`\n${index + 1}. ${checkpoint.id.slice(0, 8)}...`);
  console.log(`   📅 Created: ${new Date(checkpoint.timestamp).toLocaleString()}`);
  console.log(`   📝 Message: ${checkpoint.messageIndex}`);
  console.log(`   🔢 Tokens: ${checkpoint.metadata.totalTokens}`);
  console.log(`   🤖 Model: ${checkpoint.metadata.modelUsed}`);
  
  if (checkpoint.description) {
    console.log(`   📖 Description: ${checkpoint.description}`);
  }
  
  if (checkpoint.parentCheckpointId) {
    console.log(`   🌳 Parent: ${checkpoint.parentCheckpointId.slice(0, 8)}...`);
  }
});
```

### `restoreCheckpoint(checkpointId, sessionId, projectId, projectPath)`

Restores a session to a specific checkpoint state.

```typescript
async restoreCheckpoint(
  checkpointId: string,
  sessionId: string,
  projectId: string,
  projectPath: string
): Promise<CheckpointResult>
```

**Parameters**:
- `checkpointId` - Target checkpoint ID to restore
- `sessionId` - Session to restore
- `projectId` - Project identifier
- `projectPath` - Project directory path

**Returns**: Restoration result with metadata

**Example**:
```typescript
const result = await api.restoreCheckpoint(
  'checkpoint-abc123',
  'session-uuid-123',
  'project-id',
  '/path/to/project'
);

console.log(`🔄 Restored to checkpoint: ${result.checkpoint.id}`);
console.log(`📁 Files restored: ${result.filesProcessed}`);

if (result.warnings.length > 0) {
  console.log('⚠️ Restoration warnings:');
  result.warnings.forEach(warning => {
    console.log(`  - ${warning}`);
  });
}

// Session is now at the restored checkpoint state
console.log(`📍 Session restored to message ${result.checkpoint.messageIndex}`);
console.log(`📖 Description: ${result.checkpoint.description}`);
```

**Restoration Process**:
1. Validates checkpoint exists and is accessible
2. Creates backup of current session state
3. Restores file system to checkpoint state
4. Resets session conversation to checkpoint position
5. Updates session metadata and current position

## Timeline Navigation

### `getSessionTimeline(sessionId, projectId, projectPath)`

Retrieves the complete timeline structure for a session.

```typescript
async getSessionTimeline(
  sessionId: string,
  projectId: string,
  projectPath: string
): Promise<SessionTimeline>
```

**Returns**: Complete timeline with branching structure

**Example**:
```typescript
const timeline = await api.getSessionTimeline(
  'session-uuid-123',
  'project-id',
  '/path/to/project'
);

console.log(`🌳 Session Timeline for ${timeline.sessionId}:`);
console.log(`📊 Total checkpoints: ${timeline.totalCheckpoints}`);
console.log(`🎯 Current checkpoint: ${timeline.currentCheckpointId}`);
console.log(`🤖 Auto-checkpoint: ${timeline.autoCheckpointEnabled ? 'Enabled' : 'Disabled'}`);
console.log(`📋 Strategy: ${timeline.checkpointStrategy}`);

// Traverse timeline tree
function printTimelineNode(node: TimelineNode, depth = 0): void {
  const indent = '  '.repeat(depth);
  const isCurrent = node.checkpoint.id === timeline.currentCheckpointId;
  const marker = isCurrent ? '👉' : '  ';
  
  console.log(`${indent}${marker} ${node.checkpoint.id.slice(0, 8)}... (${node.checkpoint.timestamp})`);
  
  if (node.checkpoint.description) {
    console.log(`${indent}   📖 ${node.checkpoint.description}`);
  }
  
  // Show file snapshots count
  console.log(`${indent}   📁 ${node.fileSnapshotIds.length} file snapshots`);
  
  // Recursively print children (branches)
  node.children.forEach(child => {
    printTimelineNode(child, depth + 1);
  });
}

if (timeline.rootNode) {
  printTimelineNode(timeline.rootNode);
}
```

### Timeline Visualization

```typescript
async function visualizeTimeline(sessionId: string, projectId: string, projectPath: string): Promise<void> {
  const timeline = await api.getSessionTimeline(sessionId, projectId, projectPath);
  
  console.log('🌳 Session Timeline Visualization:');
  console.log('━'.repeat(50));
  
  if (!timeline.rootNode) {
    console.log('No checkpoints found');
    return;
  }
  
  // Create ASCII art timeline
  function renderBranch(node: TimelineNode, prefix = '', isLast = true): void {
    const isCurrent = node.checkpoint.id === timeline.currentCheckpointId;
    const symbol = isCurrent ? '●' : '○';
    const connector = isLast ? '└─' : '├─';
    
    console.log(`${prefix}${connector}${symbol} ${node.checkpoint.id.slice(0, 8)}`);
    
    if (node.checkpoint.description) {
      const descPrefix = prefix + (isLast ? '   ' : '│  ');
      console.log(`${descPrefix}📝 ${node.checkpoint.description}`);
    }
    
    // Show metadata
    const metaPrefix = prefix + (isLast ? '   ' : '│  ');
    console.log(`${metaPrefix}🔢 ${node.checkpoint.metadata.totalTokens} tokens`);
    
    // Render children
    node.children.forEach((child, index) => {
      const childPrefix = prefix + (isLast ? '   ' : '│  ');
      const childIsLast = index === node.children.length - 1;
      renderBranch(child, childPrefix, childIsLast);
    });
  }
  
  renderBranch(timeline.rootNode);
  
  console.log('━'.repeat(50));
  console.log(`Current: ${timeline.currentCheckpointId?.slice(0, 8) || 'None'}`);
  console.log(`Total: ${timeline.totalCheckpoints} checkpoints`);
}
```

## File Snapshots

### File Snapshot Management

```typescript
// File snapshots are automatically created with checkpoints
interface FileSnapshot {
  checkpointId: string;          // Associated checkpoint
  filePath: string;              // Relative file path
  content: string;               // File content at checkpoint
  hash: string;                  // Content hash for deduplication
  isDeleted: boolean;            // Whether file was deleted
  permissions?: number;          // File permissions
  size: number;                  // File size in bytes
}
```

### Viewing File Changes

```typescript
async function showFileChanges(checkpointId: string): Promise<void> {
  // This would be implemented by analyzing file snapshots
  // associated with the checkpoint
  
  console.log(`📁 File changes in checkpoint ${checkpointId}:`);
  
  // Example of what this might show:
  console.log('  📝 Modified files:');
  console.log('    - src/auth.ts (245 lines → 289 lines)');
  console.log('    - package.json (1 line added)');
  console.log('  ➕ Added files:');
  console.log('    - src/auth/jwt.ts (67 lines)');
  console.log('    - tests/auth.test.ts (134 lines)');
  console.log('  ❌ Deleted files:');
  console.log('    - src/old-auth.js');
}
```

## Branching and Forking

### `forkFromCheckpoint(checkpointId, sessionId, projectId, projectPath, newSessionId, description?)`

Creates a new session branch from an existing checkpoint.

```typescript
async forkFromCheckpoint(
  checkpointId: string,
  sessionId: string,
  projectId: string,
  projectPath: string,
  newSessionId: string,
  description?: string
): Promise<CheckpointResult>
```

**Parameters**:
- `checkpointId` - Source checkpoint to fork from
- `sessionId` - Original session ID
- `projectId` - Project identifier
- `projectPath` - Project directory path
- `newSessionId` - New session ID for the fork
- `description` - Optional description for the fork

**Returns**: Fork creation result

**Example**:
```typescript
// Create a fork to explore alternative implementation
const forkResult = await api.forkFromCheckpoint(
  'checkpoint-abc123',
  'session-uuid-123',
  'project-id',
  '/path/to/project',
  'session-uuid-fork-456',
  'Explore alternative authentication approach'
);

console.log(`🍴 Fork created: ${forkResult.checkpoint.id}`);
console.log(`📝 Description: ${forkResult.checkpoint.description}`);
console.log(`🆔 New session: session-uuid-fork-456`);

// The fork starts from the specified checkpoint
// You can now continue the conversation in a different direction
await api.resumeClaudeCode(
  '/path/to/project',
  'session-uuid-fork-456',
  'Instead of JWT tokens, let\'s implement OAuth 2.0',
  'sonnet'
);
```

### Managing Multiple Branches

```typescript
class SessionBranchManager {
  private branches: Map<string, BranchInfo> = new Map();

  async createExperimentBranch(
    originalSessionId: string,
    checkpointId: string,
    projectId: string,
    projectPath: string,
    experimentName: string
  ): Promise<string> {
    const branchSessionId = `${originalSessionId}-${experimentName}-${Date.now()}`;
    
    const result = await api.forkFromCheckpoint(
      checkpointId,
      originalSessionId,
      projectId,
      projectPath,
      branchSessionId,
      `Experiment: ${experimentName}`
    );

    this.branches.set(branchSessionId, {
      name: experimentName,
      parentSessionId: originalSessionId,
      parentCheckpointId: checkpointId,
      createdAt: new Date(),
      lastActivity: new Date()
    });

    console.log(`🧪 Created experiment branch: ${experimentName}`);
    return branchSessionId;
  }

  async listBranches(): Promise<void> {
    console.log('🌳 Active Branches:');
    
    for (const [sessionId, info] of this.branches) {
      console.log(`\n📋 ${info.name}`);
      console.log(`   🆔 Session: ${sessionId}`);
      console.log(`   📅 Created: ${info.createdAt.toLocaleString()}`);
      console.log(`   🕐 Last Activity: ${info.lastActivity.toLocaleString()}`);
      console.log(`   🔗 From: ${info.parentCheckpointId.slice(0, 8)}...`);
    }
  }

  async compareBranches(
    branchA: string,
    branchB: string,
    projectId: string
  ): Promise<void> {
    console.log(`🔍 Comparing branches: ${this.branches.get(branchA)?.name} vs ${this.branches.get(branchB)?.name}`);
    
    // Get latest checkpoints from each branch
    const timelineA = await api.getSessionTimeline(branchA, projectId, '/path/to/project');
    const timelineB = await api.getSessionTimeline(branchB, projectId, '/path/to/project');
    
    console.log(`Branch A: ${timelineA.totalCheckpoints} checkpoints`);
    console.log(`Branch B: ${timelineB.totalCheckpoints} checkpoints`);
    
    // Compare metrics if available
    // This would involve analyzing checkpoint metadata
  }
}
```

## Automatic Checkpoints

### `updateCheckpointSettings(sessionId, projectId, projectPath, autoEnabled, strategy)`

Configures automatic checkpoint creation for a session.

```typescript
async updateCheckpointSettings(
  sessionId: string,
  projectId: string,
  projectPath: string,
  autoCheckpointEnabled: boolean,
  checkpointStrategy: CheckpointStrategy
): Promise<void>
```

**Parameters**:
- `sessionId` - Session to configure
- `projectId` - Project identifier
- `projectPath` - Project directory path
- `autoCheckpointEnabled` - Enable/disable automatic checkpoints
- `checkpointStrategy` - Strategy for automatic creation

**Example**:
```typescript
// Enable smart automatic checkpointing
await api.updateCheckpointSettings(
  'session-uuid-123',
  'project-id',
  '/path/to/project',
  true,
  'smart'
);

console.log('✅ Automatic checkpointing enabled with smart strategy');

// The system will now automatically create checkpoints based on:
// - Significant code changes
// - Important conversation milestones
// - Tool usage patterns
// - Error recovery points
```

### `getCheckpointSettings(sessionId, projectId, projectPath)`

Retrieves current checkpoint configuration for a session.

```typescript
async getCheckpointSettings(
  sessionId: string,
  projectId: string,
  projectPath: string
): Promise<{
  auto_checkpoint_enabled: boolean;
  checkpoint_strategy: CheckpointStrategy;
  total_checkpoints: number;
  current_checkpoint_id?: string;
}>
```

**Example**:
```typescript
const settings = await api.getCheckpointSettings(
  'session-uuid-123',
  'project-id',
  '/path/to/project'
);

console.log('⚙️ Checkpoint Settings:');
console.log(`🤖 Auto-checkpoint: ${settings.auto_checkpoint_enabled ? 'Enabled' : 'Disabled'}`);
console.log(`📋 Strategy: ${settings.checkpoint_strategy}`);
console.log(`📊 Total checkpoints: ${settings.total_checkpoints}`);

if (settings.current_checkpoint_id) {
  console.log(`📍 Current: ${settings.current_checkpoint_id.slice(0, 8)}...`);
}
```

### Smart Checkpoint Strategy

The smart strategy uses heuristics to determine when to create checkpoints:

```typescript
// These triggers might cause automatic checkpoint creation:
const smartTriggers = {
  significant_code_changes: 'Large file modifications or new file creation',
  conversation_milestones: 'User expresses satisfaction or completion',
  error_recovery: 'After resolving errors or debugging',
  tool_usage: 'After significant tool operations',
  time_intervals: 'Every 15-30 minutes of active conversation',
  token_thresholds: 'After consuming significant tokens (1000+)'
};
```

## Checkpoint Diff Analysis

### `getCheckpointDiff(fromCheckpointId, toCheckpointId, sessionId, projectId)`

Compares changes between two checkpoints.

```typescript
async getCheckpointDiff(
  fromCheckpointId: string,
  toCheckpointId: string,
  sessionId: string,
  projectId: string
): Promise<CheckpointDiff>
```

**Returns**: Detailed diff information

**Example**:
```typescript
const diff = await api.getCheckpointDiff(
  'checkpoint-abc123',
  'checkpoint-def456',
  'session-uuid-123',
  'project-id'
);

console.log(`📊 Diff from ${diff.fromCheckpointId.slice(0, 8)} to ${diff.toCheckpointId.slice(0, 8)}:`);
console.log(`🔢 Token delta: ${diff.tokenDelta > 0 ? '+' : ''}${diff.tokenDelta}`);

console.log('\n📝 Modified files:');
diff.modifiedFiles.forEach(file => {
  console.log(`  ${file.path}: +${file.additions} -${file.deletions}`);
  
  if (file.diffContent) {
    console.log(`    Preview: ${file.diffContent.slice(0, 100)}...`);
  }
});

if (diff.addedFiles.length > 0) {
  console.log('\n➕ Added files:');
  diff.addedFiles.forEach(file => {
    console.log(`  + ${file}`);
  });
}

if (diff.deletedFiles.length > 0) {
  console.log('\n❌ Deleted files:');
  diff.deletedFiles.forEach(file => {
    console.log(`  - ${file}`);
  });
}
```

## Examples

### Checkpoint Workflow Manager

```typescript
class CheckpointWorkflow {
  async implementFeatureWithCheckpoints(
    sessionId: string,
    projectId: string,
    projectPath: string,
    featureName: string
  ): Promise<void> {
    console.log(`🚀 Starting feature implementation: ${featureName}`);
    
    // Create initial checkpoint
    const startCheckpoint = await api.createCheckpoint(
      sessionId,
      projectId,
      projectPath,
      undefined,
      `Start: ${featureName} implementation`
    );
    
    console.log(`📍 Initial checkpoint: ${startCheckpoint.checkpoint.id.slice(0, 8)}`);
    
    // Enable smart checkpointing for this session
    await api.updateCheckpointSettings(
      sessionId,
      projectId,
      projectPath,
      true,
      'smart'
    );
    
    console.log('✅ Smart checkpointing enabled');
    
    // Implement feature (this would involve actual coding session)
    await this.implementFeature(sessionId, projectPath, featureName);
    
    // Create completion checkpoint
    const endCheckpoint = await api.createCheckpoint(
      sessionId,
      projectId,
      projectPath,
      undefined,
      `Complete: ${featureName} implementation`
    );
    
    console.log(`🏁 Completion checkpoint: ${endCheckpoint.checkpoint.id.slice(0, 8)}`);
    
    // Show implementation summary
    await this.showImplementationSummary(
      startCheckpoint.checkpoint.id,
      endCheckpoint.checkpoint.id,
      sessionId,
      projectId
    );
  }

  private async implementFeature(sessionId: string, projectPath: string, featureName: string): Promise<void> {
    // This would involve actual Claude Code interaction
    await api.continueClaudeCode(
      projectPath,
      `Implement ${featureName} feature with proper error handling and tests`,
      'sonnet'
    );
    
    // Wait for completion (simplified)
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  private async showImplementationSummary(
    startCheckpointId: string,
    endCheckpointId: string,
    sessionId: string,
    projectId: string
  ): Promise<void> {
    const diff = await api.getCheckpointDiff(
      startCheckpointId,
      endCheckpointId,
      sessionId,
      projectId
    );
    
    console.log('\n📊 Implementation Summary:');
    console.log(`🔢 Token usage: ${diff.tokenDelta} tokens`);
    console.log(`📝 Files modified: ${diff.modifiedFiles.length}`);
    console.log(`➕ Files added: ${diff.addedFiles.length}`);
    console.log(`❌ Files deleted: ${diff.deletedFiles.length}`);
    
    // Show file changes
    if (diff.modifiedFiles.length > 0) {
      console.log('\n📋 File Changes:');
      diff.modifiedFiles.forEach(file => {
        console.log(`  ${file.path}: +${file.additions} -${file.deletions} lines`);
      });
    }
  }
}
```

### Checkpoint Recovery System

```typescript
class CheckpointRecovery {
  async createRecoveryPoint(
    sessionId: string,
    projectId: string,
    projectPath: string,
    description: string
  ): Promise<string> {
    const result = await api.createCheckpoint(
      sessionId,
      projectId,
      projectPath,
      undefined,
      `RECOVERY: ${description}`
    );
    
    console.log(`💾 Recovery point created: ${result.checkpoint.id.slice(0, 8)}`);
    return result.checkpoint.id;
  }

  async listRecoveryPoints(sessionId: string, projectId: string, projectPath: string): Promise<Checkpoint[]> {
    const checkpoints = await api.listCheckpoints(sessionId, projectId, projectPath);
    
    return checkpoints.filter(cp => 
      cp.description?.startsWith('RECOVERY:')
    );
  }

  async recoverFromError(
    sessionId: string,
    projectId: string,
    projectPath: string,
    errorDescription: string
  ): Promise<void> {
    console.log(`🚨 Error occurred: ${errorDescription}`);
    console.log('🔍 Looking for recovery points...');
    
    const recoveryPoints = await this.listRecoveryPoints(sessionId, projectId, projectPath);
    
    if (recoveryPoints.length === 0) {
      console.log('❌ No recovery points found');
      return;
    }
    
    // Find the most recent recovery point
    const latestRecovery = recoveryPoints[recoveryPoints.length - 1];
    
    console.log(`🔄 Recovering to: ${latestRecovery.description}`);
    console.log(`📅 Created: ${new Date(latestRecovery.timestamp).toLocaleString()}`);
    
    const result = await api.restoreCheckpoint(
      latestRecovery.id,
      sessionId,
      projectId,
      projectPath
    );
    
    console.log(`✅ Recovered to checkpoint: ${result.checkpoint.id.slice(0, 8)}`);
    console.log(`📁 Files restored: ${result.filesProcessed}`);
    
    if (result.warnings.length > 0) {
      console.log('⚠️ Recovery warnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
  }

  async autoRecoverySetup(sessionId: string, projectId: string, projectPath: string): Promise<void> {
    console.log('🛡️ Setting up auto-recovery...');
    
    // Create initial recovery point
    await this.createRecoveryPoint(
      sessionId,
      projectId,
      projectPath,
      'Session start - auto-recovery enabled'
    );
    
    // Enable periodic recovery points (would be implemented with timers)
    console.log('✅ Auto-recovery configured');
    console.log('💾 Recovery points will be created every 15 minutes');
  }
}
```

### Checkpoint Analytics

```typescript
class CheckpointAnalytics {
  async analyzeCheckpointPatterns(sessionId: string, projectId: string, projectPath: string): Promise<void> {
    const timeline = await api.getSessionTimeline(sessionId, projectId, projectPath);
    const checkpoints = await api.listCheckpoints(sessionId, projectId, projectPath);
    
    console.log('📈 Checkpoint Analytics:');
    console.log(`📊 Total checkpoints: ${timeline.totalCheckpoints}`);
    console.log(`🌳 Timeline branches: ${this.countBranches(timeline.rootNode)}`);
    
    // Analyze checkpoint frequency
    const intervals = this.calculateIntervals(checkpoints);
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    console.log(`⏰ Average checkpoint interval: ${Math.round(avgInterval / 1000 / 60)} minutes`);
    
    // Token usage patterns
    const tokenProgression = checkpoints.map(cp => cp.metadata.totalTokens);
    const totalTokens = tokenProgression[tokenProgression.length - 1] || 0;
    
    console.log(`🔢 Total token progression: ${totalTokens.toLocaleString()}`);
    
    // File change patterns
    const fileChanges = checkpoints.map(cp => cp.metadata.fileChanges);
    const totalFileChanges = fileChanges.reduce((sum, changes) => sum + changes, 0);
    
    console.log(`📁 Total file changes: ${totalFileChanges}`);
    console.log(`📊 Average changes per checkpoint: ${Math.round(totalFileChanges / checkpoints.length)}`);
    
    // Most active checkpoint
    const mostActive = checkpoints.reduce((max, cp) => 
      cp.metadata.fileChanges > max.metadata.fileChanges ? cp : max
    );
    
    console.log(`🏆 Most active checkpoint: ${mostActive.id.slice(0, 8)} (${mostActive.metadata.fileChanges} changes)`);
  }

  private countBranches(node?: TimelineNode): number {
    if (!node) return 0;
    
    let branches = node.children.length > 1 ? node.children.length : 0;
    
    for (const child of node.children) {
      branches += this.countBranches(child);
    }
    
    return branches;
  }

  private calculateIntervals(checkpoints: Checkpoint[]): number[] {
    const intervals: number[] = [];
    
    for (let i = 1; i < checkpoints.length; i++) {
      const prev = new Date(checkpoints[i - 1].timestamp).getTime();
      const curr = new Date(checkpoints[i].timestamp).getTime();
      intervals.push(curr - prev);
    }
    
    return intervals;
  }
}
```

---

**Next**: Learn about [Data Types Reference](./data-types.md) for complete interface definitions.