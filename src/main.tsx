import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA installability (independent of notifications)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[PWA] Service worker registered for PWA:', registration.scope);
      })
      .catch((error) => {
        console.log('[PWA] Service worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
