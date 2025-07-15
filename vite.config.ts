import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Path resolution
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Web development server configuration
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0", // Bind to all interfaces for network access
    open: true, // Auto-open browser
  },

  // Build configuration for code splitting
  build: {
    // Increase chunk size warning limit to 2000 KB
    chunkSizeWarningLimit: 2000,
    
    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-tooltip', '@radix-ui/react-switch', '@radix-ui/react-popover'],
          'editor-vendor': ['@uiw/react-md-editor'],
          'syntax-vendor': ['react-syntax-highlighter'],
          // Utilities
          'utils': ['date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
}));
