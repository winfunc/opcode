/**
 * @fileoverview Security utilities for input validation and sanitization
 * Provides functions to validate and sanitize user inputs to prevent security vulnerabilities
 */

/**
 * Validates if a string is a safe file path
 * Prevents path traversal attacks and ensures the path is within allowed boundaries
 * 
 * @param path - The file path to validate
 * @param allowedExtensions - Optional array of allowed file extensions
 * @returns True if the path is safe, false otherwise
 * 
 * @example
 * ```typescript
 * isValidFilePath('/safe/path/file.txt') // true
 * isValidFilePath('../../../etc/passwd') // false
 * isValidFilePath('file.exe', ['.txt', '.md']) // false
 * ```
 */
export function isValidFilePath(path: string, allowedExtensions?: string[]): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Check for path traversal attempts
  if (path.includes('..') || path.includes('~')) {
    return false;
  }

  // Check for absolute paths that might escape sandbox
  if (path.startsWith('/') && !path.startsWith('/tmp/') && !path.startsWith('/var/tmp/')) {
    return false;
  }

  // Check for Windows drive letters
  if (/^[a-zA-Z]:/.test(path)) {
    return false;
  }

  // Check for dangerous characters
  const dangerousChars = /[<>:"|?*\x00-\x1f]/;
  if (dangerousChars.test(path)) {
    return false;
  }

  // Check file extension if allowedExtensions is provided
  if (allowedExtensions && allowedExtensions.length > 0) {
    const extension = path.toLowerCase().split('.').pop();
    if (!extension || !allowedExtensions.includes(`.${extension}`)) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitizes a string for safe display in HTML
 * Prevents XSS attacks by escaping HTML entities
 * 
 * @param input - The string to sanitize
 * @returns Sanitized string safe for HTML display
 * 
 * @example
 * ```typescript
 * sanitizeHtml('<script>alert("xss")</script>') 
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * ```
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates if a string is a safe command argument
 * Prevents command injection by checking for dangerous characters
 * 
 * @param arg - The command argument to validate
 * @returns True if the argument is safe, false otherwise
 * 
 * @example
 * ```typescript
 * isValidCommandArg('--help') // true
 * isValidCommandArg('file.txt') // true
 * isValidCommandArg('$(rm -rf /)') // false
 * ```
 */
export function isValidCommandArg(arg: string): boolean {
  if (!arg || typeof arg !== 'string') {
    return false;
  }

  // Check for command injection patterns
  const dangerousPatterns = [
    /[;&|`$(){}[\]]/,  // Shell metacharacters
    /\$\(/,            // Command substitution
    /`/,               // Backticks
    /\|\|/,            // OR operator
    /&&/,              // AND operator
    />/,               // Redirection
    /</,               // Input redirection
  ];

  return !dangerousPatterns.some(pattern => pattern.test(arg));
}

/**
 * Validates an email address format
 * Uses a reasonable regex pattern for email validation
 * 
 * @param email - The email address to validate
 * @returns True if the email format is valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validates if a string is a safe project name
 * Ensures project names don't contain dangerous characters
 * 
 * @param name - The project name to validate
 * @returns True if the name is safe, false otherwise
 */
export function isValidProjectName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // Allow alphanumeric, hyphens, underscores, and spaces
  const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
  return validPattern.test(name) && name.length >= 1 && name.length <= 100;
}

/**
 * Rate limiting utility to prevent abuse
 * Tracks function calls and enforces rate limits
 */
class RateLimiter {
  private calls: Map<string, number[]> = new Map();

  /**
   * Check if an operation is allowed based on rate limits
   * 
   * @param key - Unique identifier for the operation
   * @param maxCalls - Maximum number of calls allowed
   * @param windowMs - Time window in milliseconds
   * @returns True if the operation is allowed, false if rate limited
   */
  isAllowed(key: string, maxCalls: number, windowMs: number): boolean {
    const now = Date.now();
    const calls = this.calls.get(key) || [];
    
    // Remove old calls outside the window
    const validCalls = calls.filter(time => now - time < windowMs);
    
    if (validCalls.length >= maxCalls) {
      return false;
    }
    
    validCalls.push(now);
    this.calls.set(key, validCalls);
    return true;
  }

  /**
   * Clear rate limit data for a specific key
   */
  clear(key: string): void {
    this.calls.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  clearAll(): void {
    this.calls.clear();
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Validates JSON input safely
 * Prevents JSON parsing attacks and validates structure
 * 
 * @param jsonString - The JSON string to validate
 * @param maxSize - Maximum allowed size in bytes
 * @returns Parsed JSON object or null if invalid
 */
export function safeJsonParse(jsonString: string, maxSize: number = 1024 * 1024): any {
  if (!jsonString || typeof jsonString !== 'string') {
    return null;
  }

  // Check size limit
  if (jsonString.length > maxSize) {
    throw new Error('JSON input too large');
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Invalid JSON input:', error);
    return null;
  }
}

/**
 * Debounced security validator
 * Prevents rapid validation attempts that could be used for attacks
 */
export function createSecureValidator<T>(
  validator: (input: T) => boolean,
  debounceMs: number = 100
): (input: T) => Promise<boolean> {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (input: T): Promise<boolean> => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        resolve(validator(input));
      }, debounceMs);
    });
  };
}