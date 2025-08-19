import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type { WebSocketMessage } from '../types/index.js';

/**
 * Service for managing WebSocket connections and real-time communication
 */
export class WebSocketService extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, any> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // clientId -> sessionIds

  constructor(server: any) {
    super();
    
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      this.subscriptions.set(clientId, new Set());

      console.log(`WebSocket client connected: ${clientId}`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'status',
        data: { status: 'connected', client_id: clientId },
        timestamp: new Date().toISOString(),
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleClientMessage(clientId, message);
        } catch (error) {
          this.sendError(clientId, 'Invalid JSON message', error);
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        this.subscriptions.delete(clientId);
      });

      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
        this.subscriptions.delete(clientId);
      });
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleClientMessage(clientId: string, message: WebSocketMessage): void {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(clientId, message);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(clientId, message);
        break;
      default:
        this.sendError(clientId, 'Unknown message type', { type: message.type });
    }
  }

  private handleSubscribe(clientId: string, message: WebSocketMessage): void {
    if (!message.session_id) {
      this.sendError(clientId, 'session_id required for subscribe');
      return;
    }

    const subscriptions = this.subscriptions.get(clientId);
    if (subscriptions) {
      subscriptions.add(message.session_id);
      console.log(`Client ${clientId} subscribed to session ${message.session_id}`);
      
      this.sendToClient(clientId, {
        type: 'status',
        data: { 
          status: 'subscribed', 
          session_id: message.session_id,
          subscriptions: Array.from(subscriptions)
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleUnsubscribe(clientId: string, message: WebSocketMessage): void {
    if (!message.session_id) {
      this.sendError(clientId, 'session_id required for unsubscribe');
      return;
    }

    const subscriptions = this.subscriptions.get(clientId);
    if (subscriptions) {
      subscriptions.delete(message.session_id);
      console.log(`Client ${clientId} unsubscribed from session ${message.session_id}`);
      
      this.sendToClient(clientId, {
        type: 'status',
        data: { 
          status: 'unsubscribed', 
          session_id: message.session_id,
          subscriptions: Array.from(subscriptions)
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
      }
    }
  }

  /**
   * Send error message to client
   */
  private sendError(clientId: string, error: string, details?: any): void {
    this.sendToClient(clientId, {
      type: 'error',
      data: { error, details },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast Claude stream message to subscribed clients
   */
  broadcastClaudeStream(sessionId: string, message: any): void {
    const wsMessage: WebSocketMessage = {
      type: 'claude_stream',
      data: message,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
    };

    for (const [clientId, subscriptions] of this.subscriptions.entries()) {
      if (subscriptions.has(sessionId)) {
        this.sendToClient(clientId, wsMessage);
      }
    }
  }

  /**
   * Broadcast status message to all clients
   */
  broadcastStatus(data: any): void {
    const message: WebSocketMessage = {
      type: 'status',
      data,
      timestamp: new Date().toISOString(),
    };

    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [clientId, subscriptions] of this.subscriptions.entries()) {
      result[clientId] = Array.from(subscriptions);
    }
    return result;
  }

  /**
   * Close all connections and cleanup
   */
  close(): void {
    for (const client of this.clients.values()) {
      client.close();
    }
    this.clients.clear();
    this.subscriptions.clear();
    this.wss.close();
  }
}