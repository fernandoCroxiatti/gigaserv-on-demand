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
    hasAskedPermission,
    loading,
    triggerPermissionFlow,
    handlePermissionConfirm,
    handlePermissionDecline,
    registerServiceWorker,
    resubscribeToPush
  } = useNotifications();
  
  const hasTriggeredRef = useRef(false);
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

  // FORCE permission popup on first app open - no delay
  useEffect(() => {
    // Wait for loading to complete and user to be logged in
    if (loading || !user?.id || hasTriggeredRef.current) return;
    
    // If never asked before, show popup immediately
    if (shouldAskPermission && hasAskedPermission === false) {
      console.log('[NotificationProvider] First time user - showing permission popup immediately');
      hasTriggeredRef.current = true;
      // Small delay to ensure UI is ready
      setTimeout(() => {
        triggerPermissionFlow();
      }, 500);
    }
  }, [loading, user?.id, shouldAskPermission, hasAskedPermission, triggerPermissionFlow]);

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
