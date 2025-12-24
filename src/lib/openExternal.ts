/**
 * Safe external link/URL handler.
 * - In native (Capacitor): uses Capacitor Browser plugin
 * - In web: falls back to window.open or window.location
 */

import { Capacitor } from '@capacitor/core';

let browserPlugin: typeof import('@capacitor/browser').Browser | null = null;

async function getBrowser() {
  if (browserPlugin) return browserPlugin;

  try {
    const mod = await import('@capacitor/browser');
    browserPlugin = mod.Browser;
    return browserPlugin;
  } catch {
    return null;
  }
}

/**
 * Open an external URL safely.
 * @param url - The URL to open
 * @param options - { inApp?: boolean } - whether to open in an in-app browser (default true for native)
 */
export async function openExternal(url: string, options?: { inApp?: boolean }): Promise<void> {
  if (!url) return;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const browser = await getBrowser();
    if (browser) {
      await browser.open({ url, windowName: '_blank' });
      return;
    }
  }

  // Fallback for web or if Browser plugin is unavailable
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    // Last resort
    window.location.href = url;
  }
}

/**
 * Navigate to an external URL that replaces the current page (e.g., Stripe onboarding redirect).
 * In native, uses openExternal then optionally closes in-app browser on return.
 */
export async function redirectExternal(url: string): Promise<void> {
  if (!url) return;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    // Open in system browser so redirect callbacks work
    const browser = await getBrowser();
    if (browser) {
      await browser.open({ url, windowName: '_system' });
      return;
    }
  }

  // Web: traditional redirect
  window.location.href = url;
}

/**
 * Open a tel: or mailto: link safely.
 */
export function openPhoneOrEmail(uri: string): void {
  if (!uri) return;

  try {
    // On native WebView, using location.href for tel:/mailto: usually works
    window.location.href = uri;
  } catch {
    // ignore
  }
}
