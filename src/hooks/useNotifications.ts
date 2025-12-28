/**
 * Legacy useNotifications hook - DEPRECATED
 * 
 * This hook is kept for backward compatibility but all notification
 * functionality has been migrated to OneSignal via useOneSignal hook.
 * 
 * Components should migrate to using useOneSignal instead.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { 
  isNativeApp, 
  isPushAvailable, 
  requestNativePushPermission, 
  setupPushListeners,
  removeAllDeliveredNotifications
} from '@/lib/capacitorPush';
import { requestOneSignalPermission } from '@/lib/oneSignal';

interface NotificationPreferences {
  enabled: boolean;
  permission_granted: boolean;
  chamado_updates: boolean;
  promotional: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Check if running in native app
  const isNative = isNativeApp();

  // Check current permission status
  useEffect(() => {
    if (isNative) {
      setPermission('default');
    } else if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    setLoading(false);
  }, [isNative]);

  // Load user preferences
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        const { data } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          setPreferences({
            enabled: data.enabled,
            permission_granted: data.permission_granted || false,
            chamado_updates: data.chamado_updates,
            promotional: data.promotional
          });
        }
      } catch (err) {
        console.error('Error loading notification preferences:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user?.id]);

  // Request permission - now uses OneSignal
  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.log('[useNotifications] Redirecting to OneSignal permission request');
    
    const granted = await requestOneSignalPermission();
    setPermission(granted ? 'granted' : 'denied');
    
    // Update preferences in database
    if (user?.id) {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          permission_asked_at: new Date().toISOString(),
          permission_granted: granted,
          enabled: granted,
          chamado_updates: true,
          promotional: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });
      
      if (error) {
        console.error('[useNotifications] Error saving preferences:', error);
      }
    }
    
    return granted;
  }, [user?.id]);

  // Update preferences
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (!error) {
        setPreferences(prev => prev ? { ...prev, ...updates } : null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useNotifications] Error updating preferences:', err);
      return false;
    }
  }, [user?.id]);

  // Legacy methods - kept for compatibility but no-op
  const registerServiceWorker = useCallback(async () => {
    // OneSignal handles its own service worker
    console.log('[useNotifications] registerServiceWorker called - handled by OneSignal');
    return null;
  }, []);

  const resubscribeToPush = useCallback(async () => {
    // OneSignal handles subscription
    console.log('[useNotifications] resubscribeToPush called - handled by OneSignal');
  }, []);

  const triggerPermissionFlow = useCallback(() => {
    setShowPermissionModal(true);
  }, []);

  const handlePermissionConfirm = useCallback(async () => {
    setShowPermissionModal(false);
    await requestPermission();
  }, [requestPermission]);

  const handlePermissionDecline = useCallback(async () => {
    setShowPermissionModal(false);
    
    if (user?.id) {
      await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          permission_asked_at: new Date().toISOString(),
          permission_granted: false,
          enabled: false
        }, {
          onConflict: 'user_id'
        });
    }
  }, [user?.id]);

  const sendLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    // OneSignal handles notifications
    console.log('[useNotifications] sendLocalNotification - handled by OneSignal');
  }, []);

  return {
    permission,
    preferences,
    loading,
    showPermissionModal,
    shouldAskPermission: false, // OneSignal handles this
    hasAskedPermission: true,
    isNative,
    fcmToken: null,
    triggerPermissionFlow,
    handlePermissionConfirm,
    handlePermissionDecline,
    requestPermission,
    updatePreferences,
    sendLocalNotification,
    registerServiceWorker,
    resubscribeToPush
  };
}
