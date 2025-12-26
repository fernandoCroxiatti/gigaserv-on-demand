import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { spaNavigate } from '@/lib/spaNavigation';
import { setNotificationPermissionRequester } from '@/lib/notificationPermissionRequester';
import { 
  isNativeApp, 
  isPushAvailable, 
  requestNativePushPermission, 
  setupPushListeners,
  removeAllDeliveredNotifications
} from '@/lib/capacitorPush';

interface NotificationPreferences {
  enabled: boolean;
  permission_granted: boolean;
  chamado_updates: boolean;
  promotional: boolean;
}

// VAPID public key - must match the one in edge function secrets
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [hasAskedPermission, setHasAskedPermission] = useState<boolean | null>(null);
  const permissionAskedRef = useRef(false);
  const nativeListenersCleanupRef = useRef<(() => void) | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  // Check if running in native app
  const isNative = isNativeApp();

  // Reset refs when user changes (important for login/logout)
  useEffect(() => {
    if (user?.id !== lastUserIdRef.current) {
      console.log('[useNotifications] User changed from', lastUserIdRef.current, 'to', user?.id);
      lastUserIdRef.current = user?.id || null;
      permissionAskedRef.current = false;
      setHasAskedPermission(null);
      setLoading(true);
    }
  }, [user?.id]);

  // Check current permission status
  useEffect(() => {
    if (isNative) {
      // For native, we'll check when requesting
      setPermission('default');
    } else if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, [isNative]);

  // Save FCM token to database - MUST be defined before the useEffect that uses it
  const saveFcmToken = useCallback(async (token: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notification_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: `fcm://${token}`,
          p256dh: 'fcm',
          auth: 'fcm',
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,endpoint'
        });

      if (error) {
        console.error('[useNotifications] Error saving FCM token:', error);
      } else {
        console.log('[useNotifications] FCM token saved to database');
      }
    } catch (error) {
      console.error('[useNotifications] Error saving FCM token:', error);
    }
  }, [user?.id]);

  // Deep link navigation handler
  const handleDeepLinkNavigation = useCallback((data: Record<string, unknown>) => {
    const url = data?.url as string;
    const chamadoId = data?.chamadoId as string;
    const notificationType = data?.notificationType as string;

    console.log('[useNotifications] Deep link navigation:', { url, chamadoId, notificationType });

    // Prefer SPA navigation (no reload) for internal routes
    if (url && url.startsWith('/')) {
      spaNavigate(url);
      return;
    }

    if (chamadoId) {
      spaNavigate(`/?chamado=${chamadoId}`);
      return;
    }

    if (notificationType?.includes('payment')) {
      spaNavigate('/profile?tab=payments');
      return;
    }

    if (notificationType?.includes('fee') || notificationType?.includes('pending')) {
      spaNavigate('/profile?tab=fees');
      return;
    }

    spaNavigate('/');
  }, []);

  // Setup native push listeners
  useEffect(() => {
    if (!isNative || !user?.id) return;

    const cleanup = setupPushListeners(
      // On token received
      async (token: string) => {
        console.log('[useNotifications] FCM token received:', token);
        setFcmToken(token);
        
        // Save FCM token to database
        await saveFcmToken(token);
      },
      // On notification received (foreground)
      (notification) => {
        console.log('[useNotifications] Native notification received:', notification);
        // Show in-app toast for foreground notifications
        const data = notification.data || {};
        const title = notification.title || 'Notificação';
        const body = notification.body || '';
        
        // Import toast dynamically to avoid circular deps
        import('sonner').then(({ toast }) => {
          toast(title, {
            description: body,
            action: data.url ? {
              label: 'Ver',
              onClick: () => handleDeepLinkNavigation(data)
            } : undefined,
            duration: 5000
          });
        });
      },
      // On notification action (user tapped)
      (action) => {
        console.log('[useNotifications] Notification action:', action);
        // Navigate based on notification data
        const data = action.notification.data || {};
        handleDeepLinkNavigation(data);
        
        // Clear delivered notifications
        removeAllDeliveredNotifications();
      }
    );

    nativeListenersCleanupRef.current = cleanup;

    return () => {
      if (nativeListenersCleanupRef.current) {
        nativeListenersCleanupRef.current();
      }
    };
  }, [isNative, user?.id, saveFcmToken, handleDeepLinkNavigation]);

  // Load user preferences
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        console.log('[useNotifications] Loading preferences for user:', user.id);
        const { data, error } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('[useNotifications] Preferences loaded:', data);

        if (data) {
          setPreferences({
            enabled: data.enabled,
            permission_granted: data.permission_granted || false,
            chamado_updates: data.chamado_updates,
            promotional: data.promotional
          });
          
          // Check if we should ask again (weekly retry for declined)
          if (data.permission_asked_at) {
            const askedAt = new Date(data.permission_asked_at);
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            // If permission was granted, don't ask again
            if (data.permission_granted === true) {
              console.log('[useNotifications] Permission already granted, not asking again');
              setHasAskedPermission(true);
            } 
            // If declined more than a week ago, ask again
            else if (askedAt < oneWeekAgo) {
              console.log('[useNotifications] Permission declined more than 1 week ago, will ask again');
              setHasAskedPermission(false);
            } 
            // If declined recently, don't ask
            else {
              console.log('[useNotifications] Permission declined recently, waiting for 1 week');
              setHasAskedPermission(true);
            }
          } else {
            // Never asked before
            console.log('[useNotifications] Never asked permission before');
            setHasAskedPermission(false);
          }
        } else {
          // No preferences record means never asked
          console.log('[useNotifications] No preferences record, first time user');
          setHasAskedPermission(false);
        }
      } catch (err) {
        console.error('Error loading notification preferences:', err);
        setHasAskedPermission(false);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user?.id]);

  // Register service worker and get push subscription (Web Push)
  const registerServiceWorker = useCallback(async () => {
    if (isNative || !('serviceWorker' in navigator)) {
      console.log('[useNotifications] Service workers not available');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('[useNotifications] Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('[useNotifications] Service Worker registration failed:', error);
      return null;
    }
  }, [isNative]);

  // Subscribe to Web Push
  const subscribeToPush = useCallback(async (registration: ServiceWorkerRegistration) => {
    if (!VAPID_PUBLIC_KEY) {
      console.error('[useNotifications] VAPID public key not configured - check VITE_VAPID_PUBLIC_KEY');
      return null;
    }

    try {
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      
      let subscription = await registration.pushManager.getSubscription();
      console.log('[useNotifications] Existing subscription:', subscription ? 'found' : 'none');
      
      if (!subscription) {
        console.log('[useNotifications] Creating new subscription with VAPID key...');
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer
        });
        console.log('[useNotifications] Web Push subscription created successfully');
      }

      return subscription;
    } catch (error) {
      console.error('[useNotifications] Web Push subscription failed:', error);
      return null;
    }
  }, []);

  // Save Web Push subscription to database
  const savePushSubscription = useCallback(async (subscription: PushSubscription) => {
    if (!user?.id) {
      console.error('[useNotifications] Cannot save subscription - no user ID');
      return;
    }

    try {
      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh || '';
      const auth = subscriptionJson.keys?.auth || '';

      if (!p256dh || !auth) {
        console.error('[useNotifications] Invalid subscription keys - missing p256dh or auth');
        return;
      }

      console.log('[useNotifications] Saving subscription to database...', {
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        hasP256dh: !!p256dh,
        hasAuth: !!auth
      });

      const { error } = await supabase
        .from('notification_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'endpoint'
        });

      if (error) {
        console.error('[useNotifications] Error saving push subscription:', error);
      } else {
        console.log('[useNotifications] ✅ Web Push subscription saved successfully!');
      }
    } catch (error) {
      console.error('[useNotifications] Error saving push subscription:', error);
    }
  }, [user?.id]);

  // Request notification permission (handles both native and web)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.log('[useNotifications] Requesting permission, isNative:', isNative);

    try {
      let granted = false;

      if (isNative && isPushAvailable()) {
        // Native push permission
        granted = await requestNativePushPermission();
        console.log('[useNotifications] Native permission result:', granted);
      } else if ('Notification' in window) {
        // Web push permission
        const result = await Notification.requestPermission();
        setPermission(result);
        granted = result === 'granted';
        console.log('[useNotifications] Web permission result:', result);

        if (granted) {
          // Register service worker and subscribe to push
          const registration = await registerServiceWorker();
          if (registration) {
            const subscription = await subscribeToPush(registration);
            if (subscription) {
              await savePushSubscription(subscription);
            }
          }
        }
      }

      // Update preferences in database
      if (user?.id) {
        await supabase
          .from('notification_preferences')
          .upsert({
            user_id: user.id,
            permission_asked_at: new Date().toISOString(),
            permission_granted: granted,
            enabled: granted
          }, {
            onConflict: 'user_id'
          });
      }

      return granted;
    } catch (error) {
      console.error('[useNotifications] Error requesting permission:', error);
      return false;
    }
  }, [isNative, user?.id, registerServiceWorker, subscribeToPush, savePushSubscription]);

  // Expose requester to login flow (no UI, one place to request permission)
  useEffect(() => {
    setNotificationPermissionRequester(requestPermission);
    return () => setNotificationPermissionRequester(null);
  }, [requestPermission]);

  // Show permission modal (triggered at right moment)
  const triggerPermissionFlow = useCallback(() => {
    console.log('[useNotifications] triggerPermissionFlow called, permissionAskedRef:', permissionAskedRef.current);
    
    // For native: always allow showing modal (system handles actual permission)
    // For web: only show if browser permission is still 'default'
    if (!isNative && permission !== 'default') {
      console.log('[useNotifications] Web browser already has permission decision:', permission);
      return;
    }
    
    // Prevent showing modal multiple times in same render cycle
    if (permissionAskedRef.current) {
      console.log('[useNotifications] Modal already shown this session');
      return;
    }
    
    console.log('[useNotifications] Opening permission modal');
    permissionAskedRef.current = true;
    setShowPermissionModal(true);
  }, [isNative, permission]);

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
      console.error('[useNotifications] Error updating preferences:', err);
      return false;
    }
  }, [user?.id]);

  // Send local notification (when app is in foreground - web only)
  const sendLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (isNative || permission !== 'granted') return;
    
    try {
      new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options
      });
    } catch (error) {
      console.error('[useNotifications] Error sending local notification:', error);
    }
  }, [isNative, permission]);

  // Check if should ask for permission
  // TRUE if: never asked, OR declined but it's been more than a week
  // For native: always can ask (system will handle)
  // For web: only if permission is 'default' (not already denied at browser level)
  const shouldAskPermission = hasAskedPermission === false && (isNative || permission === 'default');

  // Re-subscribe to push (useful after re-opening app)
  const resubscribeToPush = useCallback(async () => {
    console.log('[useNotifications] Resubscribe called, isNative:', isNative, 'permission:', permission, 'userId:', user?.id);
    
    if (isNative) {
      // For native, just request permission again which will re-register
      if (isPushAvailable()) {
        await requestNativePushPermission();
      }
      return;
    }

    if (permission !== 'granted') {
      console.log('[useNotifications] Cannot resubscribe - permission not granted');
      return;
    }
    
    if (!user?.id) {
      console.log('[useNotifications] Cannot resubscribe - no user');
      return;
    }
    
    try {
      console.log('[useNotifications] Waiting for service worker to be ready...');
      const registration = await navigator.serviceWorker.ready;
      console.log('[useNotifications] Service worker ready, subscribing to push...');
      
      const subscription = await subscribeToPush(registration);
      if (subscription) {
        await savePushSubscription(subscription);
        console.log('[useNotifications] ✅ Resubscribe completed successfully');
      } else {
        console.error('[useNotifications] Failed to get subscription');
      }
    } catch (error) {
      console.error('[useNotifications] Error in resubscribeToPush:', error);
    }
  }, [isNative, permission, user?.id, subscribeToPush, savePushSubscription]);

  return {
    permission,
    preferences,
    loading,
    showPermissionModal,
    shouldAskPermission,
    hasAskedPermission,
    isNative,
    fcmToken,
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
