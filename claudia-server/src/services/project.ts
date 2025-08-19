import { promises as fs } from 'fs';
import { join, basename, extname } from 'path';
import { homedir } from 'os';
import type { Project, Session, ClaudeMdFile, FileEntry } from '../types/index.js';

/**
 * Service for managing Claude projects and sessions
 */
export class ProjectService {
  private claudeHomeDir: string;
  private projectsDir: string;

  constructor(claudeHomeDir?: string) {
    this.claudeHomeDir = claudeHomeDir || join(homedir(), '.claude');
    this.projectsDir = join(this.claudeHomeDir, 'projects');
  }

  /**
   * List all projects in ~/.claude/projects/
   */
  async listProjects(): Promise<Project[]> {
    try {
      await fs.access(this.projectsDir);
    } catch {
      // Projects directory doesn't exist
      return [];
    }

    const projectDirs = await fs.readdir(this.projectsDir, { withFileTypes: true });
    const projects: Project[] = [];

    for (const dirent of projectDirs) {
      if (dirent.isDirectory()) {
        try {
          const project = await this.getProjectFromDirectory(dirent.name);
          projects.push(project);
        } catch (error) {
          console.warn(`Failed to read project ${dirent.name}:`, error);
        }
      }
    }

    // Sort projects by most recent session activity, then by creation time
    projects.sort((a, b) => {
      // First compare by most recent session
      if (a.most_recent_session && b.most_recent_session) {
        return b.most_recent_session - a.most_recent_session;
      }
      if (a.most_recent_session && !b.most_recent_session) return -1;
      if (!a.most_recent_session && b.most_recent_session) return 1;
      return b.created_at - a.created_at;
    });

    return projects;
  }

  /**
   * Get project from directory name
   */
  private async getProjectFromDirectory(projectId: string): Promise<Project> {
    const projectDir = join(this.projectsDir, projectId);
    const stats = await fs.stat(projectDir);
    
    // Get sessions (JSONL files)
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    const sessions = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map(entry => basename(entry.name, '.jsonl'));

    // Get actual project path from session files
    let projectPath: string;
    try {
      projectPath = await this.getProjectPathFromSessions(projectDir);
    } catch {
      // Fallback to decoded path
      projectPath = this.decodeProjectPath(projectId);
    }

    // Find most recent session
    let mostRecentSession: number | undefined;
    for (const sessionId of sessions) {
      try {
        const sessionPath = join(projectDir, `${sessionId}.jsonl`);
        const sessionStats = await fs.stat(sessionPath);
        const sessionTime = Math.floor(sessionStats.mtime.getTime() / 1000);
        
        if (!mostRecentSession || sessionTime > mostRecentSession) {
          mostRecentSession = sessionTime;
        }
      } catch {
        // Ignore errors reading individual sessions
      }
    }

    return {
      id: projectId,
      path: projectPath,
      sessions,
      created_at: Math.floor(stats.ctime.getTime() / 1000),
      most_recent_session: mostRecentSession,
    };
  }

  /**
   * Get actual project path by reading from JSONL files
   */
  private async getProjectPathFromSessions(projectDir: string): Promise<string> {
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        try {
          const filePath = join(projectDir, entry.name);
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());
          
          if (lines.length > 0) {
            const firstLine = JSON.parse(lines[0]);
            if (firstLine.cwd) {
              return firstLine.cwd;
            }
          }
        } catch {
          continue;
        }
      }
    }
    
    throw new Error('Could not determine project path from session files');
  }

  /**
   * Decode project directory name back to original path (fallback)
   */
  private decodeProjectPath(encoded: string): string {
    return encoded.replace(/-/g, '/');
  }

  /**
   * Create a new project for the given directory path
   */
  async createProject(path: string): Promise<Project> {
    // Encode the path to create a project ID
    const projectId = path.replace(/\//g, '-');
    
    // Create projects directory if it doesn't exist
    await fs.mkdir(this.projectsDir, { recursive: true });
    
    // Create project directory if it doesn't exist
    const projectDir = join(this.projectsDir, projectId);
    await fs.mkdir(projectDir, { recursive: true });
    
    // Get creation time
    const stats = await fs.stat(projectDir);
    const createdAt = Math.floor(stats.ctime.getTime() / 1000);
    
    return {
      id: projectId,
      path,
      sessions: [],
      created_at: createdAt,
    };
  }

  /**
   * Get sessions for a specific project
   */
  async getProjectSessions(projectId: string): Promise<Session[]> {
    const projectDir = join(this.projectsDir, projectId);
    
    try {
      await fs.access(projectDir);
    } catch {
      throw new Error(`Project directory not found: ${projectId}`);
    }

    // Get the actual project path
    let projectPath: string;
    try {
      projectPath = await this.getProjectPathFromSessions(projectDir);
    } catch {
      projectPath = this.decodeProjectPath(projectId);
    }

    const sessions: Session[] = [];
    const entries = await fs.readdir(projectDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        try {
          const sessionId = basename(entry.name, '.jsonl');
          const session = await this.getSessionFromFile(projectId, projectPath, sessionId);
          sessions.push(session);
        } catch (error) {
          console.warn(`Failed to read session ${entry.name}:`, error);
        }
      }
    }

    // Sort sessions by creation time (newest first)
    sessions.sort((a, b) => b.created_at - a.created_at);

    return sessions;
  }

  /**
   * Get session metadata from JSONL file
   */
  private async getSessionFromFile(projectId: string, projectPath: string, sessionId: string): Promise<Session> {
    const sessionPath = join(this.projectsDir, projectId, `${sessionId}.jsonl`);
    const stats = await fs.stat(sessionPath);
    
    let firstMessage: string | undefined;
    let messageTimestamp: string | undefined;
    let todoData: any;

    try {
      const content = await fs.readFile(sessionPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Find first user message
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.message?.role === 'user' && entry.message?.content) {
            firstMessage = Array.isArray(entry.message.content) 
              ? entry.message.content.find((c: any) => c.type === 'text')?.text
              : entry.message.content;
            messageTimestamp = entry.timestamp;
            break;
          }
        } catch {
          continue;
        }
      }

      // Check for todo data
      const todosDir = join(this.claudeHomeDir, 'todos');
      try {
        const todoPath = join(todosDir, `${sessionId}.json`);
        const todoContent = await fs.readFile(todoPath, 'utf-8');
        todoData = JSON.parse(todoContent);
      } catch {
        // No todo data
      }
    } catch (error) {
      console.warn(`Failed to parse session content for ${sessionId}:`, error);
    }

    return {
      id: sessionId,
      project_id: projectId,
      project_path: projectPath,
      created_at: Math.floor(stats.ctime.getTime() / 1000),
      first_message: firstMessage,
      message_timestamp: messageTimestamp,
      todo_data: todoData,
    };
  }

  /**
   * Load session history/output
   */
  async loadSessionHistory(sessionId: string): Promise<string> {
    // Find session in any project
    const projects = await this.listProjects();
    
    for (const project of projects) {
      if (project.sessions.includes(sessionId)) {
        const sessionPath = join(this.projectsDir, project.id, `${sessionId}.jsonl`);
        try {
          return await fs.readFile(sessionPath, 'utf-8');
        } catch {
          continue;
        }
      }
    }
    
    throw new Error(`Session not found: ${sessionId}`);
  }

  /**
   * Find CLAUDE.md files in a project
   */
  async findClaudeMdFiles(projectPath: string): Promise<ClaudeMdFile[]> {
    const files: ClaudeMdFile[] = [];
    
    try {
      await this.findClaudeMdFilesRecursive(projectPath, projectPath, files);
    } catch (error) {
      console.warn(`Failed to scan project for CLAUDE.md files:`, error);
    }
    
    return files;
  }

  /**
   * Recursively find CLAUDE.md files
   */
  private async findClaudeMdFilesRecursive(
    rootPath: string,
    currentPath: string,
    files: ClaudeMdFile[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          // Recurse into subdirectories (except hidden ones)
          await this.findClaudeMdFilesRecursive(rootPath, fullPath, files);
        } else if (entry.isFile() && entry.name.toLowerCase() === 'claude.md') {
          const stats = await fs.stat(fullPath);
          const relativePath = fullPath.substring(rootPath.length + 1);
          
          files.push({
            relative_path: relativePath,
            absolute_path: fullPath,
            size: stats.size,
            modified: Math.floor(stats.mtime.getTime() / 1000),
          });
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Cannot read directory ${currentPath}:`, error);
    }
  }

  /**
   * Read CLAUDE.md file content
   */
  async readClaudeMdFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  /**
   * Save CLAUDE.md file content
   */
  async saveClaudeMdFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * List directory contents
   */
  async listDirectoryContents(path: string): Promise<FileEntry[]> {
    const entries = await fs.readdir(path, { withFileTypes: true });
    const fileEntries: FileEntry[] = [];

    for (const entry of entries) {
      const fullPath = join(path, entry.name);
      
      try {
        const stats = await fs.stat(fullPath);
        
        fileEntries.push({
          name: entry.name,
          path: fullPath,
          is_directory: entry.isDirectory(),
          size: entry.isDirectory() ? 0 : stats.size,
          extension: entry.isDirectory() ? undefined : extname(entry.name).substring(1),
        });
      } catch (error) {
        // Skip files we can't stat
        console.warn(`Cannot stat ${fullPath}:`, error);
      }
    }

    // Sort directories first, then files, alphabetically
    fileEntries.sort((a, b) => {
      if (a.is_directory && !b.is_directory) return -1;
      if (!a.is_directory && b.is_directory) return 1;
      return a.name.localeCompare(b.name);
    });

    return fileEntries;
  }
}