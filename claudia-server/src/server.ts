import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { ClaudeService } from './services/claude.js';
import { ProjectService } from './services/project.js';
import { WebSocketService } from './services/websocket.js';
import { createClaudeRoutes } from './routes/claude.js';
import { createProjectRoutes } from './routes/projects.js';
import { createStatusRoutes } from './routes/status.js';
import type { ServerConfig, ErrorResponse } from './types/index.js';

/**
 * Main Claudia Server class
 */
export class ClaudiaServer {
  private app: express.Application;
  private server: any;
  private config: ServerConfig;
  private claudeService: ClaudeService;
  private projectService: ProjectService;
  private wsService: WebSocketService;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = {
      port: config.port || 3000,
      host: config.host || '0.0.0.0',
      cors_origin: config.cors_origin || ['http://localhost:3000'],
      max_concurrent_sessions: config.max_concurrent_sessions || 10,
      session_timeout_ms: config.session_timeout_ms || 300000, // 5 minutes
      claude_binary_path: config.claude_binary_path,
      claude_home_dir: config.claude_home_dir,
    };

    this.app = express();
    this.server = createServer(this.app);

    // Initialize services
    this.claudeService = new ClaudeService(this.config.claude_binary_path);
    this.projectService = new ProjectService(this.config.claude_home_dir);
    this.wsService = new WebSocketService(this.server);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocketEvents();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable CSP for API server
    }));

    // CORS
    this.app.use(cors({
      origin: this.config.cors_origin,
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // Logging
    this.app.use(morgan('combined'));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request timeout
    this.app.use((req, res, next) => {
      req.setTimeout(30000); // 30 seconds
      next();
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api/claude', createClaudeRoutes(this.claudeService, this.projectService));
    this.app.use('/api/projects', createProjectRoutes(this.projectService));
    this.app.use('/api/status', createStatusRoutes());

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Claudia Server',
        version: '1.0.0',
        description: 'Standalone TypeScript server for Claude Code integration',
        endpoints: {
          api: '/api',
          websocket: '/ws',
          health: '/api/status/health',
          info: '/api/status/info',
        },
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      const errorResponse: ErrorResponse = {
        error: 'Not Found',
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
        details: { path: req.originalUrl, method: req.method },
      };
      res.status(404).json(errorResponse);
    });
  }

  private setupWebSocketEvents(): void {
    // Forward Claude service events to WebSocket clients
    this.claudeService.on('claude_stream', (data) => {
      this.wsService.broadcastClaudeStream(data.session_id, data.message);
    });

    this.claudeService.on('claude_output', (data) => {
      this.wsService.broadcastClaudeStream(data.session_id, {
        type: 'output',
        content: data.data,
        timestamp: new Date().toISOString(),
      });
    });

    this.claudeService.on('claude_error', (data) => {
      this.wsService.broadcastClaudeStream(data.session_id, {
        type: 'error',
        content: data.error,
        timestamp: new Date().toISOString(),
      });
    });

    this.claudeService.on('claude_exit', (data) => {
      this.wsService.broadcastClaudeStream(data.session_id, {
        type: 'complete',
        content: `Process exited with code ${data.code}`,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', error);

      const errorResponse: ErrorResponse = {
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
        } : undefined,
      };

      res.status(500).json(errorResponse);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down gracefully');
      this.gracefulShutdown('SIGINT');
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`🚀 Claudia Server started on http://${this.config.host}:${this.config.port}`);
          console.log(`📡 WebSocket endpoint: ws://${this.config.host}:${this.config.port}/ws`);
          console.log(`🏠 Claude home directory: ${this.claudeService.getClaudeHomeDir()}`);
          resolve();
        }
      });
    });
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      console.log('Stopping Claudia Server...');

      // Cleanup services
      this.claudeService.cleanup();
      this.wsService.close();

      // Close server
      this.server.close(() => {
        console.log('Claudia Server stopped');
        resolve();
      });
    });
  }

  /**
   * Graceful shutdown handler
   */
  private gracefulShutdown(signal: string): void {
    console.log(`Shutting down gracefully (${signal})...`);
    
    this.stop().then(() => {
      process.exit(0);
    }).catch((error) => {
      console.error('Error during shutdown:', error);
      process.exit(1);
    });
  }

  /**
   * Get server configuration
   */
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      connections: this.wsService.getConnectedClientsCount(),
      subscriptions: this.wsService.getActiveSubscriptions(),
      running_sessions: this.claudeService.getRunningClaudeSessions().length,
    };
  }
}