import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface NotificationPreferences {
  enabled: boolean;
  permission_granted: boolean;
  chamado_updates: boolean;
  promotional: boolean;
}

// VAPID public key would be generated and stored in environment
// For web push, we need VAPID keys - for now using browser notifications API
const VAPID_PUBLIC_KEY = '';

export function useNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const permissionAskedRef = useRef(false);

  // Check current permission status
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Load user preferences
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase
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

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service workers not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (user?.id) {
        // Update preferences in database
        await supabase
          .from('notification_preferences')
          .upsert({
            user_id: user.id,
            permission_asked_at: new Date().toISOString(),
            permission_granted: result === 'granted',
            enabled: result === 'granted'
          }, {
            onConflict: 'user_id'
          });

        if (result === 'granted') {
          // Register service worker and subscribe to push
          await registerServiceWorker();
        }
      }

      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [user?.id, registerServiceWorker]);

  // Show permission modal (triggered at right moment)
  const triggerPermissionFlow = useCallback(() => {
    if (permissionAskedRef.current) return;
    if (permission !== 'default') return;
    
    permissionAskedRef.current = true;
    setShowPermissionModal(true);
  }, [permission]);

  // Handle permission modal confirm
  const handlePermissionConfirm = useCallback(async () => {
    setShowPermissionModal(false);
    await requestPermission();
  }, [requestPermission]);

  // Handle permission modal decline
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
      console.error('Error updating preferences:', err);
      return false;
    }
  }, [user?.id]);

  // Send local notification (when app is in foreground)
  const sendLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') return;
    
    try {
      new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  }, [permission]);

  // Check if should ask for permission
  const shouldAskPermission = permission === 'default' && !preferences?.permission_granted;

  return {
    permission,
    preferences,
    loading,
    showPermissionModal,
    shouldAskPermission,
    triggerPermissionFlow,
    handlePermissionConfirm,
    handlePermissionDecline,
    requestPermission,
    updatePreferences,
    sendLocalNotification,
    registerServiceWorker
  };
}
