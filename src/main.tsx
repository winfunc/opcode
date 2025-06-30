import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";
import "./assets/shimmer.css";

const ROOT_ELEMENT_ID = "root";

ReactDOM.createRoot(document.getElementById(ROOT_ELEMENT_ID) as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);