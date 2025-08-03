import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AnalyticsErrorBoundary } from "./components/AnalyticsErrorBoundary";
import { resourceMonitor } from "./lib/analytics";
import { PostHogProvider } from "posthog-js/react";
import "./assets/shimmer.css";
import "./styles.css";

// Analytics will be initialized after user consent
// analytics.initialize();

// Start resource monitoring (check every 2 minutes)
resourceMonitor.startMonitoring(120000);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        capture_exceptions: true,
        debug: import.meta.env.MODE === "development",
        opt_out_capturing_by_default: true, // Disabled by default until consent
      }}
    >
      <ErrorBoundary>
        <AnalyticsErrorBoundary>
          <App />
        </AnalyticsErrorBoundary>
      </ErrorBoundary>
    </PostHogProvider>
  </React.StrictMode>,
);
