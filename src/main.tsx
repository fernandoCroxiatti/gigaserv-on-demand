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
// In native (Capacitor/WebView) we DISABLE SW and clear aggressive caches.
if (typeof window !== 'undefined') {
  // Mark "mounted" after initial render so storage access can be safely gated
  setTimeout(() => {
    (window as any).__APP_MOUNTED__ = true;
  }, 0);

  // Global error handlers (captures unhandled promise rejections, etc.)
  window.addEventListener('error', (event) => {
    console.error('[GlobalError] window.error:', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[GlobalError] unhandledrejection:', event.reason);
  });

  const registerOrDisableServiceWorker = () => {
    // Dynamic import to prevent Capacitor from blocking boot
    import('@capacitor/core')
      .then(async ({ Capacitor }) => {
        const isNative = Capacitor.isNativePlatform();

        if (isNative) {
          // Disable SW + clear caches to prevent stale bundles/crashes in WebView
          try {
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.unregister()));
            }
          } catch (e) {
            console.log('[PWA] SW cleanup skipped:', e);
          }

          try {
            if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            }
          } catch (e) {
            console.log('[PWA] Cache cleanup skipped:', e);
          }

          return;
        }

        if (!isNative && 'serviceWorker' in navigator) {
          navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then((registration) => {
              console.log('[PWA] Service worker registered:', registration.scope);
            })
            .catch((error) => {
              console.log('[PWA] Service worker registration failed:', error);
            });
        }
      })
      .catch(() => {
        // If Capacitor isn't available, assume web and try registering SW
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
        }
      });
  };

  // Defer SW/caching work to not block app boot
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(registerOrDisableServiceWorker, { timeout: 3000 });
  } else {
    setTimeout(registerOrDisableServiceWorker, 1000);
  }
}
