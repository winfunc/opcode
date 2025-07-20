import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  // Base configuration for all files
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        // DOM Types
        HTMLInputElement: "readonly",
        HTMLAudioElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLIFrameElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLParagraphElement: "readonly",
        HTMLHeadingElement: "readonly",
        HTMLSpanElement: "readonly",
        HTMLLabelElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLElement: "readonly",
        Element: "readonly",
        Node: "readonly",
        // Event Types
        Event: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        CustomEvent: "readonly",
        EventListener: "readonly",
        EventTarget: "readonly",
        // Other Browser APIs
        Audio: "readonly",
        URL: "readonly",
        FileList: "readonly",
        File: "readonly",
        Blob: "readonly",
        FormData: "readonly",
        XMLHttpRequest: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        Headers: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        // Timer functions
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        // Animation functions
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        // Other globals
        prompt: "readonly",
        confirm: "readonly",
        alert: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
      react: react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // ESLint recommended rules
      ...js.configs.recommended.rules,

      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // React rules
      "react/react-in-jsx-scope": "off", // Not needed with React 17+
      "react/prop-types": "off", // Using TypeScript for prop validation
      "react/jsx-uses-react": "off", // Not needed with React 17+
      "react/jsx-uses-vars": "error",

      // React Hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React Refresh rules
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // General rules
      "no-console": "warn",
      "no-debugger": "error",
      "no-unused-vars": "off", // Using @typescript-eslint/no-unused-vars instead
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  // Test files configuration
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  // Ignore patterns
  {
    ignores: [
      "dist/**",
      "src-tauri/**",
      "node_modules/**",
      ".git/**",
      "build/**",
      "coverage/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
];
