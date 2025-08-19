#!/usr/bin/env node

/**
 * JavaScript/Node.js example client for Claudia Server
 * 
 * This example demonstrates:
 * - Starting a Claude session
 * - Real-time streaming via WebSocket
 * - Handling different message types
 * - Error handling
 */

import WebSocket from 'ws';

const SERVER_URL = process.env.CLAUDIA_SERVER_URL || 'http://localhost:3000';
const WS_URL = SERVER_URL.replace('http', 'ws') + '/ws';

class ClaudiaClient {
  constructor(serverUrl = SERVER_URL) {
    this.serverUrl = serverUrl;
    this.ws = null;
  }

  /**
   * Start a new Claude session
   */
  async startSession(projectPath, prompt, model = 'claude-3-5-sonnet-20241022') {
    const response = await fetch(`${this.serverUrl}/api/claude/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_path: projectPath,
        prompt: prompt,
        model: model
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to start session: ${error.error}`);
    }

    const result = await response.json();
    return result.data.session_id;
  }

  /**
   * Connect to WebSocket and subscribe to session
   */
  async connectWebSocket(sessionId) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('📡 Connected to WebSocket');
        
        // Subscribe to session
        this.ws.send(JSON.stringify({
          type: 'subscribe',
          session_id: sessionId
        }));
        
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('📡 WebSocket connection closed');
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(message) {
    switch (message.type) {
      case 'status':
        console.log('📊 Status:', message.data.status);
        break;
        
      case 'claude_stream':
        this.handleClaudeStream(message.data);
        break;
        
      case 'error':
        console.error('❌ Error:', message.data.error);
        break;
        
      default:
        console.log('📩 Unknown message type:', message.type);
    }
  }

  /**
   * Handle Claude streaming messages
   */
  handleClaudeStream(data) {
    switch (data.type) {
      case 'start':
        console.log('🤖 Claude started responding...');
        break;
        
      case 'partial':
        // Stream the content as it comes
        if (data.content) {
          process.stdout.write(data.content);
        }
        break;
        
      case 'complete':
        console.log('\\n✅ Claude completed response');
        break;
        
      case 'error':
        console.error('\\n❌ Claude error:', data.content);
        break;
        
      default:
        console.log('\\n📝 Claude output:', data.content || data);
    }
  }

  /**
   * Get list of running sessions
   */
  async getRunningSessions() {
    const response = await fetch(`${this.serverUrl}/api/claude/sessions/running`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get running sessions: ${error.error}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Cancel a session
   */
  async cancelSession(sessionId) {
    const response = await fetch(`${this.serverUrl}/api/claude/cancel/${sessionId}`, {
      method: 'POST'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to cancel session: ${error.error}`);
    }

    const result = await response.json();
    return result.data.cancelled;
  }

  /**
   * Close WebSocket connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

/**
 * Example entrypoint demonstrating end-to-end usage of ClaudiaClient.
 *
 * Performs a health check against the Claudia server, starts a Claude session
 * for the current working directory, connects to the server WebSocket to stream
 * real-time responses, and installs a SIGINT handler for graceful shutdown.
 *
 * This is an example/demo helper — it performs network I/O, logs status to stdout,
 * and exits the process on error or when the user interrupts (Ctrl+C).
 *
 * @returns {Promise<void>} Resolves when the setup completes; the process may continue running to receive streamed responses.
 */
async function example() {
  const client = new ClaudiaClient();

  try {
    // Check if server is healthy
    const healthResponse = await fetch(`${client.serverUrl}/api/status/health`);
    if (!healthResponse.ok) {
      throw new Error('Server is not healthy');
    }
    console.log('✅ Server is healthy');

    // Get current directory as project path
    const projectPath = process.cwd();
    console.log(`📁 Using project path: ${projectPath}`);

    // Start a new Claude session
    console.log('🚀 Starting Claude session...');
    const sessionId = await client.startSession(
      projectPath,
      'Help me understand the structure of this project and suggest improvements.',
      'claude-3-5-sonnet-20241022'
    );
    console.log(`🎯 Session started: ${sessionId}`);

    // Connect WebSocket for real-time streaming
    await client.connectWebSocket(sessionId);

    // Keep the connection alive
    console.log('👂 Listening for Claude responses... (Press Ctrl+C to exit)');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\\n🛑 Shutting down...');
      client.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  example();
}