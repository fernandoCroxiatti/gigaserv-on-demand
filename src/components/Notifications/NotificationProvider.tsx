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
    registerServiceWorker
  } = useNotifications();
  
  const hasTriggeredRef = useRef(false);
  const isFirstLoginRef = useRef(true);

  // Register service worker on mount if permission granted
  useEffect(() => {
    if (permission === 'granted') {
      registerServiceWorker();
    }
  }, [permission, registerServiceWorker]);

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
