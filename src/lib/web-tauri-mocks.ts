// Web-compatible mock implementations for Tauri functions
// This file provides browser-based alternatives to Tauri APIs

/**
 * Mock implementation of @tauri-apps/plugin-opener
 */
export const mockOpener = {
  /**
   * Opens a URL in the default browser
   */
  async openUrl(url: string): Promise<void> {
    console.log(`[WEB MODE] Opening URL: ${url}`);
    // Use window.open in web environment
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
};

/**
 * Mock implementation of @tauri-apps/plugin-dialog
 */
export const mockDialog = {
  /**
   * Opens a file/directory picker dialog
   */
  async open(options?: {
    directory?: boolean;
    multiple?: boolean;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | string[] | null> {
    console.log(`[WEB MODE] File dialog requested with options:`, options);
    
    return new Promise((resolve) => {
      // Create a temporary file input element
      const input = document.createElement('input');
      input.type = 'file';
      
      if (options?.directory) {
        // Directory picker (webkitdirectory)
        input.webkitdirectory = true;
        input.multiple = true;
      } else if (options?.multiple) {
        input.multiple = true;
      }
      
      // Set file type filters
      if (options?.filters && options.filters.length > 0) {
        const extensions = options.filters.flatMap(filter => 
          filter.extensions.map(ext => `.${ext}`)
        );
        input.accept = extensions.join(',');
      }
      
      input.onchange = (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (!files || files.length === 0) {
          resolve(null);
          return;
        }
        
        if (options?.directory) {
          // For directory mode, return the directory path (simulate)
          const firstFile = files[0];
          const pathParts = firstFile.webkitRelativePath.split('/');
          const directoryPath = pathParts.slice(0, -1).join('/');
          resolve(directoryPath || 'selected-directory');
        } else if (options?.multiple) {
          // Return array of file names for multiple selection
          resolve(Array.from(files).map(file => file.name));
        } else {
          // Return single file name
          resolve(files[0].name);
        }
        
        // Clean up
        document.body.removeChild(input);
      };
      
      input.oncancel = () => {
        resolve(null);
        document.body.removeChild(input);
      };
      
      // Add to DOM temporarily and trigger click
      input.style.display = 'none';
      document.body.appendChild(input);
      input.click();
    });
  },
  
  /**
   * Opens a save dialog
   */
  async save(options?: {
    filters?: Array<{ name: string; extensions: string[] }>;
    defaultPath?: string;
  }): Promise<string | null> {
    console.log(`[WEB MODE] Save dialog requested with options:`, options);
    
    // In web environment, we can't actually save to arbitrary locations
    // Instead, prompt the user for a filename and return it
    const filename = prompt(
      'Enter filename to save:', 
      options?.defaultPath || 'untitled'
    );
    
    return filename;
  }
};

/**
 * Mock implementation of @tauri-apps/api/core
 */
export const mockCore = {
  /**
   * Mock invoke function (already exists in api.ts but exporting for consistency)
   */
  async invoke(command: string, args?: any): Promise<any> {
    console.warn(`[WEB MODE] Backend command "${command}" called with args:`, args);
    
    // Return mock data or empty arrays for different commands
    switch (command) {
      case 'list_agents':
        return [];
      case 'list_projects': 
        return [];
      case 'get_project_sessions':
        return [];
      case 'get_claude_installations':
        return [];
      case 'load_session_history':
        return [];
      default:
        return null;
    }
  },
  
  /**
   * Converts a file path to a URL for web viewing
   */
  convertFileSrc(filePath: string): string {
    console.log(`[WEB MODE] Converting file source: ${filePath}`);
    
    // If it's already a data URL or web URL, return as-is
    if (filePath.startsWith('data:') || filePath.startsWith('http')) {
      return filePath;
    }
    
    // For web mode, we can't access arbitrary file paths
    // Return a placeholder or the original path
    return filePath;
  }
};

/**
 * Mock implementation of @tauri-apps/api/event
 */
export const mockEvent = {
  /**
   * Mock event listener function
   */
  async listen(event: string, handler: (event: any) => void): Promise<() => void> {
    console.log(`[WEB MODE] Event listener registered for: ${event}`);
    
    // Return a no-op unlisten function
    return () => {
      console.log(`[WEB MODE] Event listener unregistered for: ${event}`);
    };
  }
};

/**
 * Mock implementation of @tauri-apps/plugin-shell
 */
export const mockShell = {
  /**
   * Opens a URL or file with the system's default application
   */
  async open(path: string): Promise<void> {
    console.log(`[WEB MODE] Shell open requested for: ${path}`);
    
    // If it's a URL, open it
    if (path.startsWith('http') || path.startsWith('https')) {
      if (typeof window !== 'undefined') {
        window.open(path, '_blank', 'noopener,noreferrer');
      }
    } else {
      // For file paths, we can't open them in web mode
      console.warn(`[WEB MODE] Cannot open file path in web environment: ${path}`);
    }
  }
};

/**
 * Mock implementation of @tauri-apps/api/webviewWindow
 */
export const mockWebviewWindow = {
  /**
   * Gets the current webview window
   */
  getCurrentWebviewWindow(): MockWebviewWindow {
    console.log(`[WEB MODE] Getting current webview window`);
    return new MockWebviewWindow();
  }
};

/**
 * Mock WebviewWindow class
 */
class MockWebviewWindow {
  /**
   * Mock drag and drop event listener
   */
  async onDragDropEvent(handler: (event: any) => void): Promise<() => void> {
    console.log(`[WEB MODE] Drag drop event listener registered`);
    
    // In web environment, we can add actual drag/drop listeners to document
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      handler({ payload: { type: 'enter' } });
    };
    
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      handler({ payload: { type: 'over' } });
    };
    
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      handler({ payload: { type: 'leave' } });
    };
    
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files || []);
      handler({ 
        payload: { 
          type: 'drop', 
          files: files.map(file => file.name)
        } 
      });
    };
    
    // Add listeners to document
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    
    // Return cleanup function
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }
}

/**
 * Export individual functions for direct replacement
 */
export const openUrl = mockOpener.openUrl;
export const open = mockDialog.open;
export const save = mockDialog.save;
export const invoke = mockCore.invoke;
export const convertFileSrc = mockCore.convertFileSrc;
export const listen = mockEvent.listen;
export const shellOpen = mockShell.open;
export const getCurrentWebviewWindow = mockWebviewWindow.getCurrentWebviewWindow;

// TypeScript types for compatibility
export type UnlistenFn = () => void;