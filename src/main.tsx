import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA installability (web only; do not run inside Capacitor WebView)
const isNative = typeof Capacitor?.isNativePlatform === "function" ? Capacitor.isNativePlatform() : false;

if (!isNative && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[PWA] Service worker registered for PWA:", registration.scope);
      })
      .catch((error) => {
        console.log("[PWA] Service worker registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
