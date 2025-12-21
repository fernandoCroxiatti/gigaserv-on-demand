import { useState, useEffect, useCallback, useRef } from 'react';

export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!isSupported) return false;

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
  }, [isSupported]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsActive(false);
      console.log('[WakeLock] Screen wake lock released');
    }
  }, []);

  // Auto-request wake lock on mount and handle visibility changes
  useEffect(() => {
    if (!isSupported) return;

    // Request wake lock immediately
    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isSupported, requestWakeLock, releaseWakeLock]);

  return { isSupported, isActive, requestWakeLock, releaseWakeLock };
}
