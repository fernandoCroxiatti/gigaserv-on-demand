import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationPermissionModal } from './NotificationPermissionModal';
import { NotificationDisabledBanner } from './NotificationDisabledBanner';

interface NotificationProviderProps {
  children: React.ReactNode;
  activeProfile?: 'client' | 'provider';
}

export function NotificationProvider({ children, activeProfile = 'client' }: NotificationProviderProps) {
  const { user } = useAuth();
  const {
    permission,
    showPermissionModal,
    shouldAskPermission,
    triggerPermissionFlow,
    handlePermissionConfirm,
    handlePermissionDecline,
    registerServiceWorker,
    resubscribeToPush
  } = useNotifications();
  
  const hasTriggeredRef = useRef(false);
  const isFirstLoginRef = useRef(true);
  const hasResubscribedRef = useRef(false);

  // Register service worker and resubscribe on mount if permission granted
  useEffect(() => {
    if (permission === 'granted' && user?.id && !hasResubscribedRef.current) {
      hasResubscribedRef.current = true;
      console.log('[NotificationProvider] Permission granted, registering service worker and resubscribing...');
      
      // Register SW first, then resubscribe
      registerServiceWorker().then(() => {
        // Small delay to ensure SW is ready
        setTimeout(() => {
          resubscribeToPush();
        }, 1000);
      });
    }
  }, [permission, user?.id, registerServiceWorker, resubscribeToPush]);

  // Listen for login events (client) or online status (provider)
  useEffect(() => {
    if (!user || !shouldAskPermission || hasTriggeredRef.current) return;

    // For clients: trigger on first login
    if (activeProfile === 'client' && isFirstLoginRef.current) {
      // Delay slightly so user sees the app first
      const timer = setTimeout(() => {
        triggerPermissionFlow();
        hasTriggeredRef.current = true;
      }, 2000);
      
      isFirstLoginRef.current = false;
      return () => clearTimeout(timer);
    }
  }, [user, shouldAskPermission, activeProfile, triggerPermissionFlow]);

  // For providers: trigger when going online is handled separately in ProviderIdleView

  return (
    <>
      {children}
      
      {/* Permission denied banner - show discretely */}
      {permission === 'denied' && (
        <NotificationDisabledBanner />
      )}
      
      {/* Permission request modal */}
      <NotificationPermissionModal
        open={showPermissionModal}
        onConfirm={handlePermissionConfirm}
        onDecline={handlePermissionDecline}
        userType={activeProfile}
      />
    </>
  );
}
