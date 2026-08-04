import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";
import { installToastGuard } from "./lib/toastGuard";

// Dedupe + offline-suppress error toasts app-wide before anything renders.
installToastGuard();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
