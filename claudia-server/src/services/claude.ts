import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type {
  ClaudeStreamMessage,
  ProcessInfo,
  ClaudeVersionStatus,
  ExecuteClaudeRequest,
  ContinueClaudeRequest,
  ResumeClaudeRequest,
} from '../types/index.js';

/**
 * Service for managing Claude Code CLI processes
 */
export class ClaudeService extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private processRegistry: Map<string, ProcessInfo> = new Map();

  constructor(private claudeBinaryPath?: string) {
    super();
  }

  /**
   * Find Claude binary in common locations
   */
  private async findClaudeBinary(): Promise<string> {
    if (this.claudeBinaryPath) {
      try {
        await fs.access(this.claudeBinaryPath);
        return this.claudeBinaryPath;
      } catch {
        // Fall through to search
      }
    }

    const searchPaths = [
      'claude', // In PATH
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      join(homedir(), '.local/bin/claude'),
      join(homedir(), '.nvm/versions/node/*/bin/claude'),
    ];

    for (const path of searchPaths) {
      try {
        // Test if binary exists and is executable
        await this.testClaudeBinary(path);
        return path;
      } catch {
        continue;
      }
    }

    throw new Error('Claude binary not found. Please install Claude Code CLI.');
  }

  /**
   * Test if a Claude binary path is valid
   */
  private async testClaudeBinary(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(path, ['--version'], { stdio: 'pipe' });
      let output = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && output.includes('claude')) {
          resolve();
        } else {
          reject(new Error(`Invalid Claude binary: ${path}`));
        }
      });

      child.on('error', reject);
    });
  }

  /**
   * Get Claude version and installation status
   */
  async checkClaudeVersion(): Promise<ClaudeVersionStatus> {
    try {
      const claudePath = await this.findClaudeBinary();
      const output = await this.runCommand(claudePath, ['--version']);
      
      const versionMatch = output.match(/claude[^\d]*(\d+\.\d+\.\d+)/i);
      const version = versionMatch ? versionMatch[1] : undefined;

      return {
        is_installed: true,
        version,
        output: output.trim(),
      };
    } catch (error) {
      return {
        is_installed: false,
        output: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute a command and return output
   */
  private async runCommand(command: string, args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, stdio: 'pipe' });
      let output = '';
      let error = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `Command failed with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  /**
   * Execute Claude Code with streaming output
   */
  async executeClaudeCode(request: ExecuteClaudeRequest): Promise<string> {
    const sessionId = uuidv4();
    const claudePath = await this.findClaudeBinary();

    const args = [
      '-p',
      request.prompt,
      '--model',
      request.model,
      '--output-format',
      'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    await this.spawnClaudeProcess(sessionId, claudePath, args, request.project_path, request);
    return sessionId;
  }

  /**
   * Continue existing Claude Code conversation
   */
  async continueClaudeCode(request: ContinueClaudeRequest): Promise<string> {
    const sessionId = uuidv4();
    const claudePath = await this.findClaudeBinary();

    const args = [
      '-c', // Continue flag
      '-p',
      request.prompt,
      '--model',
      request.model,
      '--output-format',
      'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    await this.spawnClaudeProcess(sessionId, claudePath, args, request.project_path, request);
    return sessionId;
  }

  /**
   * Resume existing Claude Code session
   */
  async resumeClaudeCode(request: ResumeClaudeRequest): Promise<string> {
    const sessionId = request.session_id;
    const claudePath = await this.findClaudeBinary();

    const args = [
      '--resume',
      request.session_id,
      '-p',
      request.prompt,
      '--model',
      request.model,
      '--output-format',
      'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    await this.spawnClaudeProcess(sessionId, claudePath, args, request.project_path, request);
    return sessionId;
  }

  /**
   * Spawn Claude process with streaming output
   */
  private async spawnClaudeProcess(
    sessionId: string,
    claudePath: string,
    args: string[],
    projectPath: string,
    request: any
  ): Promise<void> {
    const child = spawn(claudePath, args, {
      cwd: projectPath,
      stdio: 'pipe',
      env: { ...process.env },
    });

    if (!child.pid) {
      throw new Error('Failed to start Claude process');
    }

    // Register process
    const processInfo: ProcessInfo = {
      run_id: Date.now(),
      process_type: { ClaudeSession: { session_id: sessionId } },
      pid: child.pid,
      started_at: new Date().toISOString(),
      project_path: projectPath,
      task: request.prompt.substring(0, 100),
      model: request.model,
    };

    this.processes.set(sessionId, child);
    this.processRegistry.set(sessionId, processInfo);

    // Handle stdout (streaming JSON)
    child.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      
      for (const line of lines) {
        try {
          const message = JSON.parse(line) as ClaudeStreamMessage;
          message.session_id = sessionId;
          message.timestamp = new Date().toISOString();
          
          this.emit('claude_stream', {
            session_id: sessionId,
            message,
          });
        } catch (error) {
          // Non-JSON line, emit as raw output
          this.emit('claude_output', {
            session_id: sessionId,
            data: line,
          });
        }
      }
    });

    // Handle stderr
    child.stderr?.on('data', (data) => {
      this.emit('claude_error', {
        session_id: sessionId,
        error: data.toString(),
      });
    });

    // Handle process exit
    child.on('close', (code) => {
      this.processes.delete(sessionId);
      this.processRegistry.delete(sessionId);
      
      this.emit('claude_exit', {
        session_id: sessionId,
        code,
      });
    });

    child.on('error', (error) => {
      this.processes.delete(sessionId);
      this.processRegistry.delete(sessionId);
      
      this.emit('claude_error', {
        session_id: sessionId,
        error: error.message,
      });
    });
  }

  /**
   * Cancel a running Claude process
   */
  async cancelClaudeExecution(sessionId: string): Promise<boolean> {
    const process = this.processes.get(sessionId);
    
    if (process) {
      process.kill('SIGTERM');
      
      // Force kill after 5 seconds if not terminated
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);
      
      return true;
    }
    
    return false;
  }

  /**
   * Get list of running Claude sessions
   */
  getRunningClaudeSessions(): ProcessInfo[] {
    return Array.from(this.processRegistry.values());
  }

  /**
   * Get session info by ID
   */
  getSessionInfo(sessionId: string): ProcessInfo | undefined {
    return this.processRegistry.get(sessionId);
  }

  /**
   * Get Claude home directory (~/.claude)
   */
  getClaudeHomeDir(): string {
    return join(homedir(), '.claude');
  }

  /**
   * Cleanup all processes
   */
  cleanup(): void {
    for (const [sessionId, process] of this.processes) {
      process.kill('SIGTERM');
    }
    this.processes.clear();
    this.processRegistry.clear();
  }
}