#!/usr/bin/env node

/**
 * Web Server for Claudia
 * 
 * This server provides:
 * 1. Static file serving for the React UI
 * 2. API endpoints that mirror Tauri commands
 * 3. WebSocket support for real-time features
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Claude projects directory
const CLAUDE_DIR = path.join(homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'claudia-web',
    timestamp: new Date().toISOString()
  });
});

// List projects
app.get('/api/projects', async (req, res) => {
  try {
    const projectDirs = await fs.readdir(PROJECTS_DIR);
    const projects = [];
    
    for (const dir of projectDirs) {
      const projectPath = path.join(PROJECTS_DIR, dir);
      const stats = await fs.stat(projectPath);
      
      if (stats.isDirectory()) {
        // Decode the directory name to get the original path
        const decodedPath = dir.replace(/-/g, '/');
        
        // Get session files
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
    
    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      status: 500
    });
  }
});

// Get project sessions
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
        
        // Read first line to get first message
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
    
    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      status: 500
    });
  }
});

// Mock agents endpoint (since we can't access the SQLite DB without Rust)
app.get('/api/agents', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 1,
        name: "Code Assistant",
        icon: "🤖",
        system_prompt: "You are a helpful coding assistant.",
        model: "claude-3-sonnet",
        enable_file_read: true,
        enable_file_write: true,
        enable_network: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  });
});

// Serve static files (React app)
if (process.env.NODE_ENV === 'production') {
  // In production, serve the built files
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  // In development, proxy to Vite dev server
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Claudia Web UI</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
          }
          .info {
            background: #f0f0f0;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          code {
            background: #e0e0e0;
            padding: 2px 5px;
            border-radius: 3px;
          }
          a {
            color: #007bff;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <h1>🚀 Claudia Web UI</h1>
        
        <div class="info">
          <h2>Development Server Running</h2>
          <p>The web server is running successfully!</p>
          
          <h3>Available Endpoints:</h3>
          <ul>
            <li><a href="/api/health">/api/health</a> - Health check</li>
            <li><a href="/api/projects">/api/projects</a> - List projects</li>
            <li><a href="/api/agents">/api/agents</a> - List agents (mock data)</li>
          </ul>
          
          <h3>To run the full UI:</h3>
          <ol>
            <li>Start the Vite dev server: <code>bun run dev</code></li>
            <li>Access the UI at: <a href="http://localhost:5173">http://localhost:5173</a></li>
          </ol>
          
          <h3>Test the API:</h3>
          <p>Use the <a href="/web_test.html">API Test Page</a></p>
        </div>
        
        <div class="info">
          <h2>WebSocket Status</h2>
          <p id="ws-status">Checking...</p>
        </div>
        
        <script>
          // Test WebSocket connection
          const ws = new WebSocket('ws://localhost:${PORT}/ws');
          const statusEl = document.getElementById('ws-status');
          
          ws.onopen = () => {
            statusEl.textContent = '✅ WebSocket connected';
            statusEl.style.color = 'green';
          };
          
          ws.onerror = () => {
            statusEl.textContent = '❌ WebSocket connection failed';
            statusEl.style.color = 'red';
          };
          
          ws.onclose = () => {
            statusEl.textContent = '⚠️ WebSocket disconnected';
            statusEl.style.color = 'orange';
          };
        </script>
      </body>
      </html>
    `);
  });
  
  // Serve the test page
  app.use('/web_test.html', express.static(path.join(__dirname, 'web_test.html')));
}

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`
🚀 Claudia Web Server Started
==============================
HTTP Server: http://localhost:${PORT}
WebSocket:   ws://localhost:${PORT}/ws
API Base:    http://localhost:${PORT}/api

Available endpoints:
- GET  /api/health
- GET  /api/projects
- GET  /api/projects/:id/sessions
- GET  /api/agents

Test the API:
- curl http://localhost:${PORT}/api/health
- Open http://localhost:${PORT} in your browser
  `);
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    data: 'Connected to Claudia WebSocket server'
  }));
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    
    // Echo the message back
    ws.send(JSON.stringify({
      type: 'echo',
      data: message.toString()
    }));
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});