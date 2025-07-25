import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { I18nProvider } from "./components/I18nProvider";
import { replaceConsole } from "./lib/logger";
import { fontScaleManager } from "./lib/fontScale";
import "./assets/shimmer.css";
import "./styles.css";

// 初始化日志系统
replaceConsole();

// 初始化字体缩放
fontScaleManager;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
