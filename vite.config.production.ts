import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

// 生产环境配置
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Path resolution
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // 生产环境优化
  define: {
    // 移除开发环境的调试代码
    __DEV__: false,
    "process.env.NODE_ENV": '"production"',
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  // 生产环境构建配置
  build: {
    // 增加 chunk 大小警告限制
    chunkSizeWarningLimit: 2000,

    // 启用压缩
    minify: "terser",

    // Terser 配置 - 移除 console 和 debugger
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.debug", "console.info"],
      },
    },

    rollupOptions: {
      output: {
        // 手动分块以优化加载
        manualChunks: {
          // Vendor chunks
          "react-vendor": ["react", "react-dom"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-switch",
            "@radix-ui/react-popover",
          ],
          "editor-vendor": ["@uiw/react-md-editor"],
          "syntax-vendor": ["react-syntax-highlighter"],
          // Tauri and other utilities
          tauri: ["@tauri-apps/api", "@tauri-apps/plugin-dialog", "@tauri-apps/plugin-shell"],
          utils: ["date-fns", "clsx", "tailwind-merge"],
        },
      },
    },
  },
}));
