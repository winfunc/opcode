import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { I18nProvider } from "./components/I18nProvider";
import { AnalyticsErrorBoundary } from "./components/AnalyticsErrorBoundary";
import { replaceConsole } from "./lib/logger";
import { fontScaleManager } from "./lib/fontScale";
import { analytics, resourceMonitor } from "./lib/analytics";
import { PostHogProvider } from "posthog-js/react";
import "./assets/shimmer.css";
import "./styles.css";

// 初始化日志系统
replaceConsole();

// 初始化字体缩放
fontScaleManager;

// Initialize analytics before rendering
analytics.initialize();

// Start resource monitoring (check every 2 minutes)
resourceMonitor.startMonitoring(120000);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        defaults: '2025-05-24',
        capture_exceptions: true,
        debug: import.meta.env.MODE === "development",
      }}
    >
      <ErrorBoundary>
        <AnalyticsErrorBoundary>
          <I18nProvider>
            <App />
          </I18nProvider>
        </AnalyticsErrorBoundary>
      </ErrorBoundary>
    </PostHogProvider>
  </React.StrictMode>
);
