#!/usr/bin/env node

/**
 * Claudia Server CLI Tool
 * Provides easy command-line interface for interacting with Claudia Server
 */

import { program } from 'commander';
import { ClaudiaServer } from './server.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

program
  .name('claudia-server')
  .description('Standalone TypeScript server for Claude Code integration')
  .version(packageJson.version);

// Server commands
const serverCmd = program
  .command('server')
  .description('Server management commands');

serverCmd
  .command('start')
  .description('Start the Claudia server')
  .option('-p, --port <port>', 'Server port', '3000')
  .option('-h, --host <host>', 'Server host', '0.0.0.0')
  .option('--claude-binary <path>', 'Path to Claude binary')
  .option('--claude-home <path>', 'Path to Claude home directory')
  .option('-d, --daemon', 'Run as daemon (background process)')
  .action(async (options) => {
    try {
      const config = {
        port: parseInt(options.port, 10),
        host: options.host,
        claude_binary_path: options.claudeBinary,
        claude_home_dir: options.claudeHome,
      };

      const server = new ClaudiaServer(config);
      
      if (options.daemon) {
        // For daemon mode, we would need to implement proper daemonization
        console.log('Daemon mode not yet implemented. Starting in foreground...');
      }
      
      await server.start();
      
      // Keep running until interrupted
      process.on('SIGINT', async () => {
        console.log('\\nShutting down server...');
        await server.stop();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('Failed to start server:', (error as Error).message);
      process.exit(1);
    }
  });

// Client commands
const clientCmd = program
  .command('client')
  .description('Client commands for interacting with Claudia server')
  .option('-s, --server <url>', 'Server URL', 'http://localhost:3000');

clientCmd
  .command('health')
  .description('Check server health')
  .action(async (options, cmd) => {
    const serverUrl = cmd.parent.opts().server;
    try {
      const response = await fetch(`${serverUrl}/api/status/health`);
      const result = await response.json() as any;
      
      if (result.success) {
        console.log('✅ Server is healthy');
        console.log(`   Uptime: ${result.data.uptime} seconds`);
        console.log(`   Memory: ${Math.round(result.data.memory.heapUsed / 1024 / 1024)}MB`);
      } else {
        console.log('❌ Server is unhealthy');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Cannot connect to server:', (error as Error).message);
      process.exit(1);
    }
  });

clientCmd
  .command('execute <prompt>')
  .description('Execute Claude Code with a prompt')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('-m, --model <model>', 'Claude model', 'claude-3-5-sonnet-20241022')
  .option('-w, --watch', 'Watch for real-time output via WebSocket')
  .action(async (prompt, options, cmd) => {
    const serverUrl = cmd.parent.opts().server;
    
    try {
      const response = await fetch(`${serverUrl}/api/claude/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_path: options.project,
          prompt: prompt,
          model: options.model
        })
      });

      const result = await response.json() as any;
      
      if (result.success) {
        console.log(`🚀 Session started: ${result.data.session_id}`);
        
        if (options.watch) {
          console.log('👂 Watching for real-time output...');
          // Here we would implement WebSocket watching
          // For now, just show the session ID
        } else {
          console.log('💡 Use --watch flag to see real-time output');
        }
      } else {
        console.error('❌ Failed to start session:', result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

clientCmd
  .command('sessions')
  .description('List running sessions')
  .action(async (options, cmd) => {
    const serverUrl = cmd.parent.opts().server;
    
    try {
      const response = await fetch(`${serverUrl}/api/claude/sessions/running`);
      const result = await response.json() as any;
      
      if (result.success) {
        const sessions = result.data;
        
        if (sessions.length === 0) {
          console.log('📭 No running sessions');
        } else {
          console.log(`🏃 Running sessions (${sessions.length}):`);
          sessions.forEach((session: any) => {
            const sessionType = session.process_type.ClaudeSession ? 
              session.process_type.ClaudeSession.session_id : 
              'Unknown';
            console.log(`   ${sessionType} - ${session.task.substring(0, 50)}...`);
            console.log(`     Project: ${session.project_path}`);
            console.log(`     Model: ${session.model}`);
            console.log(`     Started: ${session.started_at}`);
            console.log();
          });
        }
      } else {
        console.error('❌ Failed to get sessions:', result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

clientCmd
  .command('cancel <sessionId>')
  .description('Cancel a running session')
  .action(async (sessionId, options, cmd) => {
    const serverUrl = cmd.parent.opts().server;
    
    try {
      const response = await fetch(`${serverUrl}/api/claude/cancel/${sessionId}`, {
        method: 'POST'
      });

      const result = await response.json() as any;
      
      if (result.success) {
        if (result.data.cancelled) {
          console.log(`✅ Session ${sessionId} cancelled`);
        } else {
          console.log(`⚠️  Session ${sessionId} was not running`);
        }
      } else {
        console.error('❌ Failed to cancel session:', result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

// Project commands
const projectCmd = program
  .command('projects')
  .description('Project management commands')
  .option('-s, --server <url>', 'Server URL', 'http://localhost:3000');

projectCmd
  .command('list')
  .description('List all projects')
  .action(async (options, cmd) => {
    const serverUrl = cmd.parent.opts().server;
    
    try {
      const response = await fetch(`${serverUrl}/api/projects`);
      const result = await response.json() as any;
      
      if (result.success) {
        const projects = result.data;
        
        if (projects.length === 0) {
          console.log('📭 No projects found');
        } else {
          console.log(`📁 Projects (${projects.length}):`);
          projects.forEach((project: any) => {
            console.log(`   ${project.id}`);
            console.log(`     Path: ${project.path}`);
            console.log(`     Sessions: ${project.sessions.length}`);
            console.log(`     Created: ${new Date(project.created_at * 1000).toLocaleString()}`);
            console.log();
          });
        }
      } else {
        console.error('❌ Failed to get projects:', result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

// Add version and help
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}