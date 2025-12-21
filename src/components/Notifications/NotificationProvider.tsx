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

  // FORCE permission popup on first app open
  useEffect(() => {
    console.log('[NotificationProvider] Checking popup conditions:', {
      loading,
      userId: user?.id,
      hasTriggered: hasTriggeredRef.current,
      shouldAskPermission,
      hasAskedPermission,
      permission
    });
    
    // Wait for loading to complete
    if (loading) {
      console.log('[NotificationProvider] Still loading preferences...');
      return;
    }
    
    // Wait for user to be logged in
    if (!user?.id) {
      console.log('[NotificationProvider] No user logged in yet');
      return;
    }
    
    // Prevent triggering multiple times
    if (hasTriggeredRef.current) {
      console.log('[NotificationProvider] Already triggered popup');
      return;
    }
    
    // Show popup if: never asked (hasAskedPermission === false) OR hasAskedPermission is still null (new user)
    // AND permission is still 'default' (not granted/denied)
    const shouldShowPopup = (hasAskedPermission === false || hasAskedPermission === null) && permission === 'default';
    
    console.log('[NotificationProvider] Should show popup?', shouldShowPopup);
    
    if (shouldShowPopup) {
      console.log('[NotificationProvider] First time user - showing permission popup NOW');
      hasTriggeredRef.current = true;
      // Small delay to ensure UI is ready after navigation
      setTimeout(() => {
        console.log('[NotificationProvider] Triggering permission flow...');
        triggerPermissionFlow();
      }, 800);
    }
  }, [loading, user?.id, hasAskedPermission, triggerPermissionFlow, permission]);

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
