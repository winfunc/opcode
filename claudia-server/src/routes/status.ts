import { Router } from 'express';
import type { SuccessResponse } from '../types/index.js';
import { homedir } from 'os';
import { join } from 'path';

export function createStatusRoutes(): Router {
  const router = Router();

  /**
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    const response: SuccessResponse = {
      success: true,
      data: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
      },
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
  });

  /**
   * Server info endpoint
   */
  router.get('/info', (req, res) => {
    const response: SuccessResponse = {
      success: true,
      data: {
        name: 'Claudia Server',
        version: '1.0.0',
        description: 'Standalone TypeScript server for Claude Code integration',
        node_version: process.version,
        platform: process.platform,
        architecture: process.arch,
        pid: process.pid,
        cwd: process.cwd(),
        claude_home: join(homedir(), '.claude'),
      },
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
  });

  /**
   * Get home directory
   */
  router.get('/home', (req, res) => {
    const response: SuccessResponse = {
      success: true,
      data: {
        home_directory: homedir(),
        claude_directory: join(homedir(), '.claude'),
      },
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
  });

  return router;
}