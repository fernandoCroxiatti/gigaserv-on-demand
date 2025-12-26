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
