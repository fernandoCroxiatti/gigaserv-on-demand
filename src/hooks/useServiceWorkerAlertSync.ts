import { useEffect, useCallback } from 'react';
import { startRideAlertLoop, stopRideAlertLoop } from '@/lib/rideAlertSound';
import { playNotificationSound } from '@/lib/notificationSound';

/**
 * Hook to synchronize ride alert sound between Service Worker push notifications
 * and the app. This enables Uber-style continuous sound that works even when
 * the app is in background (via SW) and seamlessly transitions to in-app sound.
 * 
 * Also handles single alert sounds for client notifications (provider_accepted).
 */
export function useServiceWorkerAlertSync() {
  // Handle messages from Service Worker
  const handleServiceWorkerMessage = useCallback((event: MessageEvent) => {
    const { type, action } = event.data || {};

    if (type === 'RIDE_ALERT_SOUND') {
      console.log('[SW-Alert-Sync] Received alert command:', action);

      switch (action) {
        case 'START_ALERT':
        case 'CONTINUE_ALERT':
          // Start/continue the alert sound loop (provider chamado)
          startRideAlertLoop();
          break;

        case 'SINGLE_ALERT':
          // Play single alert sound (client provider_accepted)
          // This uses the simple notification sound, not the loop
          playNotificationSound();
          break;

        case 'STOP_ALERT':
        case 'USER_ACCEPTED':
        case 'USER_DECLINED':
        case 'NOTIFICATION_DISMISSED':
          // Stop the alert sound
          stopRideAlertLoop();
          break;

        default:
          console.log('[SW-Alert-Sync] Unknown action:', action);
      }
    }

    // Handle notification click navigation
    if (type === 'NOTIFICATION_CLICKED') {
      console.log('[SW-Alert-Sync] Notification clicked, stopping alert');
      stopRideAlertLoop();
    }
  }, []);

  // Notify Service Worker when chamado is handled locally
  const notifyServiceWorkerChamadoHandled = useCallback((action: 'accepted' | 'declined' | 'expired') => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      console.log('[SW-Alert-Sync] Notifying SW that chamado was handled:', action);
      navigator.serviceWorker.controller.postMessage({
        type: 'CHAMADO_HANDLED',
        action
      });
    }
    // Also stop local sound
    stopRideAlertLoop();
  }, []);

  // Stop alert from anywhere (e.g., when navigating away)
  const stopAlert = useCallback(() => {
    console.log('[SW-Alert-Sync] Manual stop requested');
    
    // Stop local sound
    stopRideAlertLoop();
    
    // Notify SW to stop as well
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'STOP_CHAMADO_ALERT'
      });
    }
  }, []);

  // Set up listener for SW messages
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    console.log('[SW-Alert-Sync] Setting up Service Worker message listener');
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [handleServiceWorkerMessage]);

  return {
    notifyServiceWorkerChamadoHandled,
    stopAlert
  };
}
