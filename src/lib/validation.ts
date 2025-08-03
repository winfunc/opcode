import { z } from 'zod';

/**
 * Schema for validating file paths
 * Prevents path traversal attacks and null bytes
 */
export const FilePathSchema = z.string()
  .min(1, "Path cannot be empty")
  .refine((path) => !path.includes('..'), "Path traversal not allowed")
  .refine((path) => !path.includes('\0'), "Null bytes not allowed in path")
  .refine((path) => !path.includes('~'), "Home directory shortcuts not allowed");

/**
 * Schema for validating project paths
 */
export const ProjectPathSchema = FilePathSchema
  .refine((path) => path.startsWith('/'), "Project path must be absolute");

/**
 * Schema for validating prompts
 */
export const PromptSchema = z.string()
  .min(1, "Prompt cannot be empty")
  .max(10000, "Prompt is too long (max 10000 characters)")
  .refine((prompt) => !prompt.includes('\0'), "Null bytes not allowed in prompt");

/**
 * Schema for validating model names
 */
export const ModelSchema = z.enum([
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022'
], {
  errorMap: () => ({ message: "Invalid model selected" })
});

/**
 * Schema for validating session IDs
 */
export const SessionIdSchema = z.string()
  .uuid("Invalid session ID format");

/**
 * Schema for Claude command execution
 */
export const ClaudeCommandSchema = z.object({
  projectPath: ProjectPathSchema,
  prompt: PromptSchema,
  model: ModelSchema,
});

/**
 * Schema for resuming Claude sessions
 */
export const ResumeClaudeSchema = z.object({
  projectPath: ProjectPathSchema,
  sessionId: SessionIdSchema,
  prompt: PromptSchema,
  model: ModelSchema,
});

/**
 * Schema for agent creation
 */
export const AgentSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(100),
  system_prompt: z.string().min(1).max(5000),
  default_task: z.string().max(1000).optional(),
  model: ModelSchema,
  enable_file_read: z.boolean(),
  enable_file_write: z.boolean(),
  enable_network: z.boolean(),
  hooks: z.string().optional(),
});

/**
 * Schema for file operations
 */
export const FileOperationSchema = z.object({
  filePath: FilePathSchema,
  content: z.string().optional(),
});

/**
 * Schema for directory listing
 */
export const DirectoryListSchema = z.object({
  directoryPath: FilePathSchema,
});

/**
 * Schema for search operations
 */
export const SearchSchema = z.object({
  basePath: FilePathSchema,
  query: z.string().min(1).max(100),
});

/**
 * Validation helper functions
 */
export function validateClaudeCommand(data: unknown) {
  try {
    return ClaudeCommandSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function validateResumeCommand(data: unknown) {
  try {
    return ResumeClaudeSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function validateAgent(data: unknown) {
  try {
    return AgentSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function validateFilePath(path: string): string {
  try {
    return FilePathSchema.parse(path);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid file path: ${error.errors[0].message}`);
    }
    throw error;
  }
}

export function validateProjectPath(path: string): string {
  try {
    return ProjectPathSchema.parse(path);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid project path: ${error.errors[0].message}`);
    }
    throw error;
  }
}

/**
 * Sanitize user input for display
 */
export function sanitizeForDisplay(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
}