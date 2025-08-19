import { Router } from 'express';
import type { ClaudeService } from '../services/claude.js';
import type { ProjectService } from '../services/project.js';
import type { 
  ExecuteClaudeRequest, 
  ContinueClaudeRequest, 
  ResumeClaudeRequest,
  SuccessResponse,
  ErrorResponse
} from '../types/index.js';

/**
 * Creates an Express Router with endpoints for managing and interacting with Claude code executions.
 *
 * The router exposes these routes:
 * - GET  /version                        — check Claude code version/installation status
 * - POST /execute                        — start a new Claude execution (requires project_path, prompt, model)
 * - POST /continue                       — continue an existing conversation (requires project_path, prompt, model)
 * - POST /resume                         — resume a session (requires project_path, session_id, prompt, model)
 * - POST /cancel/:sessionId              — cancel a running execution
 * - GET  /sessions/running               — list running Claude sessions
 * - GET  /sessions/:sessionId            — get session information
 * - GET  /sessions/:sessionId/history    — load session history/output
 *
 * All endpoints return a standardized SuccessResponse or ErrorResponse object with a timestamp and appropriate HTTP status codes for validation, not-found, and internal errors.
 *
 * @returns An Express Router configured with the Claude-related routes.
 */
export function createClaudeRoutes(
  claudeService: ClaudeService,
  projectService: ProjectService
): Router {
  const router = Router();

  /**
   * Check Claude Code version and installation status
   */
  router.get('/version', async (req, res) => {
    try {
      const versionStatus = await claudeService.checkClaudeVersion();
      
      const response: SuccessResponse = {
        success: true,
        data: versionStatus,
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'CLAUDE_VERSION_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Execute Claude Code with new prompt
   */
  router.post('/execute', async (req, res) => {
    try {
      const request = req.body as ExecuteClaudeRequest;
      
      // Validate request
      if (!request.project_path || !request.prompt || !request.model) {
        const errorResponse: ErrorResponse = {
          error: 'Missing required fields: project_path, prompt, model',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(errorResponse);
      }

      const sessionId = await claudeService.executeClaudeCode(request);
      
      const response: SuccessResponse = {
        success: true,
        data: { session_id: sessionId },
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'EXECUTION_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Continue existing Claude Code conversation
   */
  router.post('/continue', async (req, res) => {
    try {
      const request = req.body as ContinueClaudeRequest;
      
      // Validate request
      if (!request.project_path || !request.prompt || !request.model) {
        const errorResponse: ErrorResponse = {
          error: 'Missing required fields: project_path, prompt, model',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(errorResponse);
      }

      const sessionId = await claudeService.continueClaudeCode(request);
      
      const response: SuccessResponse = {
        success: true,
        data: { session_id: sessionId },
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'EXECUTION_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Resume existing Claude Code session
   */
  router.post('/resume', async (req, res) => {
    try {
      const request = req.body as ResumeClaudeRequest;
      
      // Validate request
      if (!request.project_path || !request.session_id || !request.prompt || !request.model) {
        const errorResponse: ErrorResponse = {
          error: 'Missing required fields: project_path, session_id, prompt, model',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(errorResponse);
      }

      const sessionId = await claudeService.resumeClaudeCode(request);
      
      const response: SuccessResponse = {
        success: true,
        data: { session_id: sessionId },
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'EXECUTION_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Cancel running Claude execution
   */
  router.post('/cancel/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const cancelled = await claudeService.cancelClaudeExecution(sessionId);
      
      const response: SuccessResponse = {
        success: true,
        data: { cancelled, session_id: sessionId },
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'CANCELLATION_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Get list of running Claude sessions
   */
  router.get('/sessions/running', async (req, res) => {
    try {
      const sessions = claudeService.getRunningClaudeSessions();
      
      const response: SuccessResponse = {
        success: true,
        data: sessions,
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'SESSIONS_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Get session info by ID
   */
  router.get('/sessions/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const sessionInfo = claudeService.getSessionInfo(sessionId);
      
      if (!sessionInfo) {
        const errorResponse: ErrorResponse = {
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
          timestamp: new Date().toISOString(),
        };
        return res.status(404).json(errorResponse);
      }
      
      const response: SuccessResponse = {
        success: true,
        data: sessionInfo,
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'SESSION_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Get session history/output
   */
  router.get('/sessions/:sessionId/history', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const history = await projectService.loadSessionHistory(sessionId);
      
      const response: SuccessResponse = {
        success: true,
        data: { session_id: sessionId, history },
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'HISTORY_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(404).json(errorResponse);
    }
  });

  return router;
}