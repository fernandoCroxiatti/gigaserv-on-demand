import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * SAFE BOOT SEQUENCE FOR ANDROID RELEASE BUILDS
 * 
 * Critical: NO async operations or native API calls before React renders.
 * The app must display immediately to prevent Android from killing it.
 * 
 * Order of operations:
 * 1. Import CSS (synchronous)
 * 2. Render React app immediately (shows SafeSplashScreen)
 * 3. AFTER render, register service worker (web only)
 * 4. Safe initialization hook handles the rest
 */

// STEP 1: Render React app IMMEDIATELY
// This ensures Android sees content right away
const rootElement = document.getElementById("root");

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
} else {
  // Fallback: create root element if missing (shouldn't happen)
  console.error('[Boot] Root element not found, creating fallback');
  const fallbackRoot = document.createElement('div');
  fallbackRoot.id = 'root';
  document.body.appendChild(fallbackRoot);
  createRoot(fallbackRoot).render(<App />);
}

// STEP 2: Register service worker AFTER render (web only, deferred)
// This runs after the app is visible to prevent blocking the boot
if (typeof window !== 'undefined') {
  // Use requestIdleCallback or setTimeout to defer this work
  const registerServiceWorker = () => {
    // Dynamic import to prevent Capacitor from blocking boot
    import('@capacitor/core').then(({ Capacitor }) => {
      const isNative = Capacitor.isNativePlatform();
      
      if (!isNative && "serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((registration) => {
            console.log("[PWA] Service worker registered:", registration.scope);
          })
          .catch((error) => {
            console.log("[PWA] Service worker registration failed:", error);
          });
      }
    }).catch(() => {
      // Capacitor not available, try registering SW anyway for web
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
      }
    });
  };

  // Defer service worker registration to not block app boot
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(registerServiceWorker, { timeout: 3000 });
  } else {
    setTimeout(registerServiceWorker, 1000);
  }
}
