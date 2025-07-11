/**
 * Tauri API shim for web environment
 * 
 * This module provides mock implementations of Tauri APIs
 * when running in a web browser instead of the desktop app.
 */

// Check if we're in Tauri environment
export const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window;

// Mock shell module
export const shell = {
  open: async (url: string) => {
    window.open(url, '_blank');
  }
};

// Mock dialog module
export const dialog = {
  open: async (options?: any) => {
    // Use native file input for web
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (options?.multiple) input.multiple = true;
      if (options?.filters?.[0]?.extensions) {
        input.accept = options.filters[0].extensions.map((ext: string) => `.${ext}`).join(',');
      }
      input.onchange = () => {
        const files = Array.from(input.files || []).map(f => f.name);
        resolve(options?.multiple ? files : files[0]);
      };
      input.click();
    });
  },
  save: async (options?: any) => {
    // Web doesn't have save dialog, return a default path
    return options?.defaultPath || 'download.txt';
  },
  message: async (message: string, options?: any) => {
    alert(message);
  }
};

// Mock updater module
export const updater = {
  checkUpdate: async () => ({ shouldUpdate: false })
};

// Export Tauri-compatible API
export const tauriShim = {
  shell,
  dialog,
  updater,
  isTauri
};