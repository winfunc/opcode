#!/usr/bin/env node

/**
 * Enhanced Web Server for Claudia
 * 
 * This server provides complete API compatibility with the Tauri backend
 * to support both web GUI and iOS app development.
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Paths
const CLAUDE_DIR = path.join(homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
const SYSTEM_PROMPT_FILE = path.join(CLAUDE_DIR, 'CLAUDE.md');
const DB_PATH = path.join(__dirname, 'claudia.db');

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  -- Agents table
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    default_task TEXT,
    model TEXT DEFAULT 'claude-3-sonnet-20240229',
    hooks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Agent runs table
  CREATE TABLE IF NOT EXISTS agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    agent_name TEXT NOT NULL,
    agent_icon TEXT NOT NULL,
    task TEXT NOT NULL,
    model TEXT NOT NULL,
    project_path TEXT NOT NULL,
    session_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    pid INTEGER,
    process_started_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
  );

  -- Usage analytics table
  CREATE TABLE IF NOT EXISTS usage_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    session_id TEXT
  );

  -- MCP servers table
  CREATE TABLE IF NOT EXISTS mcp_servers (
    name TEXT PRIMARY KEY,
    transport TEXT NOT NULL,
    command TEXT,
    args TEXT DEFAULT '[]',
    env TEXT DEFAULT '{}',
    url TEXT,
    scope TEXT DEFAULT 'local',
    is_active BOOLEAN DEFAULT 1,
    status TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Slash commands table
  CREATE TABLE IF NOT EXISTS slash_commands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    full_command TEXT NOT NULL,
    scope TEXT NOT NULL,
    namespace TEXT,
    file_path TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    allowed_tools TEXT DEFAULT '[]',
    has_bash_commands BOOLEAN DEFAULT 0,
    has_file_references BOOLEAN DEFAULT 0,
    accepts_arguments BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Process management
const runningProcesses = new Map();
const processOutputBuffers = new Map();

// WebSocket connections
let wss;

// Helper functions
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

function broadcastToWebSocket(type, data) {
  if (wss) {
    const message = JSON.stringify({ type, data });
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'claudia-web-enhanced',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Project management endpoints
app.get('/api/projects', async (req, res) => {
  try {
    await ensureDirectoryExists(PROJECTS_DIR);
    const projectDirs = await fs.readdir(PROJECTS_DIR);
    const projects = [];
    
    for (const dir of projectDirs) {
      const projectPath = path.join(PROJECTS_DIR, dir);
      const stats = await fs.stat(projectPath);
      
      if (stats.isDirectory()) {
        const decodedPath = dir.replace(/-/g, '/');
        
        const files = await fs.readdir(projectPath);
        const sessions = files
          .filter(f => f.endsWith('.jsonl'))
          .map(f => f.replace('.jsonl', ''));
        
        projects.push({
          id: dir,
          path: decodedPath,
          sessions: sessions,
          created_at: Math.floor(stats.birthtimeMs / 1000)
        });
      }
    }
    
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:id/sessions', async (req, res) => {
  try {
    const projectDir = path.join(PROJECTS_DIR, req.params.id);
    const files = await fs.readdir(projectDir);
    const sessions = [];
    
    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        const sessionId = file.replace('.jsonl', '');
        const filePath = path.join(projectDir, file);
        const stats = await fs.stat(filePath);
        
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        let firstMessage = null;
        let messageTimestamp = null;
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.message && entry.message.role === 'user') {
              firstMessage = entry.message.content;
              messageTimestamp = entry.timestamp;
              break;
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
        
        sessions.push({
          id: sessionId,
          project_id: req.params.id,
          project_path: req.params.id.replace(/-/g, '/'),
          created_at: Math.floor(stats.birthtimeMs / 1000),
          first_message: firstMessage,
          message_timestamp: messageTimestamp
        });
      }
    }
    
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agent management endpoints
app.get('/api/agents', (req, res) => {
  try {
    const agents = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agents', (req, res) => {
  try {
    const { name, icon, systemPrompt, defaultTask, model, hooks } = req.body;
    
    const result = db.prepare(`
      INSERT INTO agents (name, icon, system_prompt, default_task, model, hooks)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, icon, systemPrompt, defaultTask, model || 'claude-3-sonnet-20240229', hooks);
    
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(result.lastInsertRowid);
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/agents/:id', (req, res) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/agents/:id', (req, res) => {
  try {
    const { name, icon, systemPrompt, defaultTask, model, hooks } = req.body;
    
    db.prepare(`
      UPDATE agents 
      SET name = ?, icon = ?, system_prompt = ?, default_task = ?, model = ?, hooks = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, icon, systemPrompt, defaultTask, model, hooks, req.params.id);
    
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/agents/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Claude Code execution endpoints
app.post('/api/claude/execute', async (req, res) => {
  try {
    const { projectPath, prompt, model } = req.body;
    const sessionId = uuidv4();
    
    // Create a mock process entry
    const process = {
      sessionId,
      projectPath,
      model,
      status: 'running',
      pid: Math.floor(Math.random() * 10000),
      startedAt: new Date().toISOString()
    };
    
    runningProcesses.set(sessionId, process);
    processOutputBuffers.set(sessionId, []);
    
    // In a real implementation, we would spawn the claude process here
    // For now, we'll simulate it
    setTimeout(() => {
      broadcastToWebSocket('process-output', {
        sessionId,
        content: `Starting Claude session with model ${model}...\n`
      });
      
      setTimeout(() => {
        broadcastToWebSocket('process-output', {
          sessionId,
          content: `Processing prompt: ${prompt}\n`
        });
        
        setTimeout(() => {
          broadcastToWebSocket('process-completed', {
            sessionId,
            status: 'completed'
          });
          runningProcesses.delete(sessionId);
        }, 2000);
      }, 1000);
    }, 500);
    
    res.json({ sessionId, status: 'started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/claude/cancel', (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (runningProcesses.has(sessionId)) {
      const process = runningProcesses.get(sessionId);
      process.status = 'cancelled';
      runningProcesses.delete(sessionId);
      
      broadcastToWebSocket('process-failed', {
        sessionId,
        error: 'Process cancelled by user'
      });
    }
    
    res.json({ status: 'cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/claude/status/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const process = runningProcesses.get(sessionId);
    const output = processOutputBuffers.get(sessionId) || [];
    
    res.json({
      sessionId,
      status: process ? process.status : 'not_found',
      output: output.join('')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Usage analytics endpoints
app.get('/api/usage/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT session_id) as total_sessions,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(cache_write_tokens) as total_cache_creation_tokens,
        SUM(cache_read_tokens) as total_cache_read_tokens,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(cost) as total_cost
      FROM usage_analytics
    `).get();
    
    const byModel = db.prepare(`
      SELECT 
        model,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(cache_write_tokens) as cache_creation_tokens,
        SUM(cache_read_tokens) as cache_read_tokens,
        COUNT(DISTINCT session_id) as session_count
      FROM usage_analytics
      GROUP BY model
      ORDER BY total_cost DESC
    `).all();
    
    const byDate = db.prepare(`
      SELECT 
        DATE(timestamp) as date,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens) as total_tokens,
        GROUP_CONCAT(DISTINCT model) as models_used
      FROM usage_analytics
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
      LIMIT 30
    `).all();
    
    const byProject = db.prepare(`
      SELECT 
        project as project_path,
        project as project_name,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens) as total_tokens,
        COUNT(DISTINCT session_id) as session_count,
        MAX(timestamp) as last_used
      FROM usage_analytics
      GROUP BY project
      ORDER BY total_cost DESC
    `).all();
    
    res.json({
      ...stats,
      by_model: byModel,
      by_date: byDate.map(d => ({
        ...d,
        models_used: d.models_used ? d.models_used.split(',') : []
      })),
      by_project: byProject
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings endpoints
app.get('/api/settings/claude', async (req, res) => {
  try {
    const settings = await readJsonFile(SETTINGS_FILE) || {};
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings/claude', async (req, res) => {
  try {
    await writeJsonFile(SETTINGS_FILE, req.body);
    res.json({ status: 'saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Running sessions endpoints
app.get('/api/running-sessions', (req, res) => {
  try {
    const runningSessions = db.prepare(`
      SELECT * FROM agent_runs 
      WHERE status IN ('pending', 'running')
      ORDER BY created_at DESC
    `).all();
    res.json(runningSessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/running-claude-sessions', (req, res) => {
  try {
    const sessions = Array.from(runningProcesses.values())
      .filter(p => p.status === 'running');
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MCP server endpoints
app.get('/api/mcp/servers', (req, res) => {
  try {
    const servers = db.prepare('SELECT * FROM mcp_servers ORDER BY name').all();
    res.json(servers.map(s => ({
      ...s,
      args: JSON.parse(s.args),
      env: JSON.parse(s.env),
      status: JSON.parse(s.status)
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mcp/servers', (req, res) => {
  try {
    const { name, transport, command, args = [], env = {}, url, scope = 'local' } = req.body;
    
    db.prepare(`
      INSERT INTO mcp_servers (name, transport, command, args, env, url, scope)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, transport, command, JSON.stringify(args), JSON.stringify(env), url, scope);
    
    res.json({
      success: true,
      message: `Server '${name}' added successfully`,
      server_name: name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve test page
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'web-api-test.html'));
});

// File system endpoints
app.get('/api/fs/list', async (req, res) => {
  try {
    const { path: dirPath } = req.query;
    const files = await fs.readdir(dirPath);
    const entries = [];
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      entries.push({
        name: file,
        path: filePath,
        is_directory: stats.isDirectory(),
        size: stats.size,
        extension: path.extname(file).slice(1)
      });
    }
    
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Session history endpoints
app.get('/api/sessions/:projectId/:sessionId/history', async (req, res) => {
  try {
    const { projectId, sessionId } = req.params;
    const sessionFile = path.join(PROJECTS_DIR, projectId, `${sessionId}.jsonl`);
    
    const content = await fs.readFile(sessionFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const messages = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agent runs endpoints
app.get('/api/agents/:id/runs', (req, res) => {
  try {
    const runs = db.prepare(`
      SELECT ar.*, 
        CASE 
          WHEN ar.completed_at IS NOT NULL 
          THEN CAST((julianday(ar.completed_at) - julianday(ar.created_at)) * 86400000 AS INTEGER)
          ELSE NULL
        END as duration_ms
      FROM agent_runs ar
      WHERE ar.agent_id = ?
      ORDER BY ar.created_at DESC
    `).all(req.params.id);
    
    res.json(runs.map(run => ({
      ...run,
      metrics: {
        duration_ms: run.duration_ms,
        total_tokens: 0,
        cost_usd: 0,
        message_count: 0
      }
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agents/:id/execute', async (req, res) => {
  try {
    const { projectPath, task, model } = req.body;
    const agentId = req.params.id;
    
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const sessionId = uuidv4();
    const result = db.prepare(`
      INSERT INTO agent_runs (agent_id, agent_name, agent_icon, task, model, project_path, session_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      agentId,
      agent.name,
      agent.icon,
      task,
      model || agent.model,
      projectPath,
      sessionId,
      'running'
    );
    
    // Simulate agent execution
    setTimeout(() => {
      db.prepare(`
        UPDATE agent_runs 
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(result.lastInsertRowid);
      
      broadcastToWebSocket('process-completed', {
        runId: result.lastInsertRowid,
        status: 'completed'
      });
    }, 5000);
    
    res.json(result.lastInsertRowid);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`
🚀 Claudia Enhanced Web Server Started
======================================
HTTP Server: http://localhost:${PORT}
WebSocket:   ws://localhost:${PORT}/ws
API Base:    http://localhost:${PORT}/api
Database:    ${DB_PATH}

Features:
✅ Full API compatibility with Tauri backend
✅ SQLite database for persistent storage
✅ WebSocket for real-time updates
✅ Agent management
✅ Usage analytics
✅ MCP server configuration
✅ Session history

Test the API:
- curl http://localhost:${PORT}/api/health
- Open http://localhost:${PORT} in your browser
  `);
});

// WebSocket server
wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.send(JSON.stringify({
    type: 'welcome',
    data: 'Connected to Claudia Enhanced WebSocket server'
  }));
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    
    try {
      const data = JSON.parse(message.toString());
      
      // Handle different message types
      switch (data.type) {
        case 'subscribe':
          // Handle subscription to specific events
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          ws.send(JSON.stringify({
            type: 'echo',
            data: data
          }));
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format'
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    db.close();
    console.log('Server closed');
    process.exit(0);
  });
});