import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useServiceWorkerAlertSync } from '@/hooks/useServiceWorkerAlertSync';

interface NotificationProviderProps {
  children: React.ReactNode;
  activeProfile?: 'client' | 'provider';
}

/**
 * Notifications runtime:
 * - NEVER requests permission automatically (permission is requested explicitly from the login flow)
 * - When permission is granted, it ensures SW registration + push resubscription
 * - Detects if Auth.tsx granted permission and picks up push registration
 * - No visual UI (no banner/modal) to keep app UX neutral
 */
export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth();
  const { permission, registerServiceWorker, resubscribeToPush } = useNotifications();

  const hasResubscribedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  // Sync ride alerts between Service Worker and app (Uber-style continuous sound)
  useServiceWorkerAlertSync();

  // Reset when user changes (logout/login)
  useEffect(() => {
    if (user?.id !== userIdRef.current) {
      hasResubscribedRef.current = false;
      userIdRef.current = user?.id || null;
    }
  }, [user?.id]);

  // Check for pending permission granted flag from Auth.tsx
  // (Auth requests permission; here we only do SW/subscription setup AFTER grant.)
  useEffect(() => {
    if (!user?.id) return;

    try {
      const pending = localStorage.getItem('gigasos:notif_perm_granted_pending');
      if (pending !== '1') return;

      localStorage.removeItem('gigasos:notif_perm_granted_pending');

      // If user granted permission outside the notifications hook,
      // our internal `permission` state might still be stale.
      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
        console.log('[NotificationProvider] Permission granted (pending). Ensuring push registration...');

        hasResubscribedRef.current = true;
        registerServiceWorker().then(() => {
          setTimeout(() => {
            resubscribeToPush();
          }, 500);
        });
      }
    } catch {
      // ignore storage errors
    }
  }, [user?.id, registerServiceWorker, resubscribeToPush]);

  // Register service worker and resubscribe when permission is granted
  useEffect(() => {
    if (permission === 'granted' && user?.id && !hasResubscribedRef.current) {
      hasResubscribedRef.current = true;

      registerServiceWorker().then(() => {
        setTimeout(() => {
          resubscribeToPush();
        }, 500);
      });
    }
  }, [permission, user?.id, registerServiceWorker, resubscribeToPush]);

  return <>{children}</>;
}
