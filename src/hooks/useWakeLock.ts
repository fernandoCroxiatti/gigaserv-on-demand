import { useState, useEffect, useCallback, useRef } from 'react';
import { safeLocalStorage } from '@/lib/safeStorage';

const WAKE_LOCK_ENABLED_KEY = 'giga-sos-wake-lock-enabled';

// Get saved preference from localStorage (safe for WebView)
function getWakeLockPreference(): boolean {
  const saved = safeLocalStorage.getItem(WAKE_LOCK_ENABLED_KEY);
  return saved === null ? true : saved === 'true'; // Default: enabled
}

// Save preference to localStorage (safe for WebView)
export function setWakeLockPreference(enabled: boolean): void {
  safeLocalStorage.setItem(WAKE_LOCK_ENABLED_KEY, String(enabled));
  // Dispatch event to notify other components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wakeLockPreferenceChange', { detail: enabled }));
  }
}

export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isEnabled, setIsEnabled] = useState(getWakeLockPreference);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!isSupported || !isEnabled) return false;

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);
      
      wakeLockRef.current.addEventListener('release', () => {
        setIsActive(false);
      });

      console.log('[WakeLock] Screen wake lock activated');
      return true;
    } catch (err) {
      console.warn('[WakeLock] Failed to acquire wake lock:', err);
      return false;
    }
  }, [isSupported, isEnabled]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsActive(false);
      console.log('[WakeLock] Screen wake lock released');
    }
  }, []);

  // Toggle wake lock enabled state
  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    setWakeLockPreference(enabled);
    
    if (!enabled) {
      releaseWakeLock();
    }
  }, [releaseWakeLock]);

  // Listen for preference changes from other components
  useEffect(() => {
    const handlePreferenceChange = (e: CustomEvent<boolean>) => {
      setIsEnabled(e.detail);
      if (!e.detail) {
        releaseWakeLock();
      }
    };

    window.addEventListener('wakeLockPreferenceChange', handlePreferenceChange as EventListener);
    return () => {
      window.removeEventListener('wakeLockPreferenceChange', handlePreferenceChange as EventListener);
    };
  }, [releaseWakeLock]);

  // Auto-request wake lock on mount and handle visibility changes
  useEffect(() => {
    if (!isSupported || !isEnabled) return;

    // Request wake lock immediately
    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current && isEnabled) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isSupported, isEnabled, requestWakeLock, releaseWakeLock]);

  return { isSupported, isActive, isEnabled, setEnabled, requestWakeLock, releaseWakeLock };
}
