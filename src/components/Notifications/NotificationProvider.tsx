import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationPermissionModal } from './NotificationPermissionModal';
import { NotificationDisabledBanner } from './NotificationDisabledBanner';
import { useServiceWorkerAlertSync } from '@/hooks/useServiceWorkerAlertSync';

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
    isNative,
    triggerPermissionFlow,
    handlePermissionConfirm,
    handlePermissionDecline,
    registerServiceWorker,
    resubscribeToPush
  } = useNotifications();
  
  const hasTriggeredRef = useRef(false);
  const hasResubscribedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  
  // Hook to sync ride alerts between Service Worker and app (Uber-style continuous sound)
  useServiceWorkerAlertSync();

  // Reset trigger when user changes (logout/login)
  useEffect(() => {
    if (user?.id !== userIdRef.current) {
      console.log('[NotificationProvider] User changed, resetting trigger');
      hasTriggeredRef.current = false;
      hasResubscribedRef.current = false;
      userIdRef.current = user?.id || null;
    }
  }, [user?.id]);

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

  // FORCE permission popup for all users who haven't granted permission
  useEffect(() => {
    console.log('[NotificationProvider] Checking popup conditions:', {
      loading,
      userId: user?.id,
      hasTriggered: hasTriggeredRef.current,
      shouldAskPermission,
      hasAskedPermission,
      permission,
      isNative
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
    
    // Prevent triggering multiple times per session
    if (hasTriggeredRef.current) {
      console.log('[NotificationProvider] Already triggered popup this session');
      return;
    }
    
    // For native apps: always show if shouldAskPermission is true
    // For web: only show if browser permission is 'default' (not denied at browser level)
    let shouldShowPopup = false;
    
    if (isNative) {
      // Native: show popup if we should ask (never asked or weekly retry)
      shouldShowPopup = shouldAskPermission;
      console.log('[NotificationProvider] Native app - shouldAskPermission:', shouldAskPermission);
    } else {
      // Web: show popup if shouldAskPermission AND browser permission is default
      shouldShowPopup = shouldAskPermission && permission === 'default';
      console.log('[NotificationProvider] Web app - shouldAskPermission:', shouldAskPermission, 'browserPermission:', permission);
    }
    
    console.log('[NotificationProvider] Final decision - should show popup?', shouldShowPopup);
    
    if (shouldShowPopup) {
      console.log('[NotificationProvider] Showing permission popup NOW');
      hasTriggeredRef.current = true;
      // Small delay to ensure UI is ready after navigation
      setTimeout(() => {
        console.log('[NotificationProvider] Triggering permission flow...');
        triggerPermissionFlow();
      }, 1000);
    }
  }, [loading, user?.id, shouldAskPermission, hasAskedPermission, triggerPermissionFlow, permission, isNative]);

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
