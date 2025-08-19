import { Router } from 'express';
import type { ProjectService } from '../services/project.js';
import type { SuccessResponse, ErrorResponse } from '../types/index.js';

export function createProjectRoutes(projectService: ProjectService): Router {
  const router = Router();

  /**
   * List all projects
   */
  router.get('/', async (req, res) => {
    try {
      const projects = await projectService.listProjects();
      
      const response: SuccessResponse = {
        success: true,
        data: projects,
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'PROJECTS_LIST_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Create a new project
   */
  router.post('/', async (req, res) => {
    try {
      const { path } = req.body;
      
      if (!path) {
        const errorResponse: ErrorResponse = {
          error: 'Missing required field: path',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(errorResponse);
      }

      const project = await projectService.createProject(path);
      
      const response: SuccessResponse = {
        success: true,
        data: project,
        timestamp: new Date().toISOString(),
      };
      
      res.status(201).json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'PROJECT_CREATE_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Get sessions for a specific project
   */
  router.get('/:projectId/sessions', async (req, res) => {
    try {
      const { projectId } = req.params;
      const sessions = await projectService.getProjectSessions(projectId);
      
      const response: SuccessResponse = {
        success: true,
        data: sessions,
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'PROJECT_SESSIONS_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Find CLAUDE.md files in a project
   */
  router.get('/:projectId/claude-files', async (req, res) => {
    try {
      const { projectId } = req.params;
      
      // First get the project to find its actual path
      const projects = await projectService.listProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        const errorResponse: ErrorResponse = {
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND',
          timestamp: new Date().toISOString(),
        };
        return res.status(404).json(errorResponse);
      }

      const claudeFiles = await projectService.findClaudeMdFiles(project.path);
      
      const response: SuccessResponse = {
        success: true,
        data: claudeFiles,
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'CLAUDE_FILES_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Read CLAUDE.md file content
   */
  router.get('/claude-file', async (req, res) => {
    try {
      const { path } = req.query;
      
      if (!path || typeof path !== 'string') {
        const errorResponse: ErrorResponse = {
          error: 'Missing required query parameter: path',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(errorResponse);
      }

      const content = await projectService.readClaudeMdFile(path);
      
      const response: SuccessResponse = {
        success: true,
        data: { path, content },
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'CLAUDE_FILE_READ_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Save CLAUDE.md file content
   */
  router.put('/claude-file', async (req, res) => {
    try {
      const { path, content } = req.body;
      
      if (!path || !content) {
        const errorResponse: ErrorResponse = {
          error: 'Missing required fields: path, content',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(errorResponse);
      }

      await projectService.saveClaudeMdFile(path, content);
      
      const response: SuccessResponse = {
        success: true,
        data: { path, saved: true },
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'CLAUDE_FILE_SAVE_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  /**
   * List directory contents
   */
  router.get('/directory', async (req, res) => {
    try {
      const { path } = req.query;
      
      if (!path || typeof path !== 'string') {
        const errorResponse: ErrorResponse = {
          error: 'Missing required query parameter: path',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(errorResponse);
      }

      const contents = await projectService.listDirectoryContents(path);
      
      const response: SuccessResponse = {
        success: true,
        data: { path, contents },
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'DIRECTORY_LIST_ERROR',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  });

  return router;
}