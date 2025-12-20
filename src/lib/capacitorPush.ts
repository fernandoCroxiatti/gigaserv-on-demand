import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

// Check if running in native app
export const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
};

// Check if push notifications are available
export const isPushAvailable = (): boolean => {
  return isNativeApp() && Capacitor.isPluginAvailable('PushNotifications');
};

// Request native push permission
export const requestNativePushPermission = async (): Promise<boolean> => {
  if (!isPushAvailable()) {
    console.log('[CapacitorPush] Not available on this platform');
    return false;
  }

  try {
    // Check current permission status
    const permStatus = await PushNotifications.checkPermissions();
    console.log('[CapacitorPush] Current permission:', permStatus.receive);

    if (permStatus.receive === 'prompt') {
      // Request permission
      const result = await PushNotifications.requestPermissions();
      console.log('[CapacitorPush] Permission result:', result.receive);
      
      if (result.receive === 'granted') {
        await registerNativePush();
        return true;
      }
      return false;
    } else if (permStatus.receive === 'granted') {
      await registerNativePush();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[CapacitorPush] Error requesting permission:', error);
    return false;
  }
};

// Register for push notifications
export const registerNativePush = async (): Promise<void> => {
  if (!isPushAvailable()) return;

  try {
    await PushNotifications.register();
    console.log('[CapacitorPush] Registered for push notifications');
  } catch (error) {
    console.error('[CapacitorPush] Registration error:', error);
  }
};

// Setup push notification listeners
export const setupPushListeners = (
  onTokenReceived: (token: string) => void,
  onNotificationReceived: (notification: PushNotificationSchema) => void,
  onNotificationAction: (action: ActionPerformed) => void
): (() => void) => {
  if (!isPushAvailable()) {
    return () => {};
  }

  // Listen for registration token
  const tokenListener = PushNotifications.addListener('registration', (token: Token) => {
    console.log('[CapacitorPush] Token received:', token.value);
    onTokenReceived(token.value);
  });

  // Listen for registration errors
  const errorListener = PushNotifications.addListener('registrationError', (error) => {
    console.error('[CapacitorPush] Registration error:', error);
  });

  // Listen for incoming notifications (app in foreground)
  const notificationListener = PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      console.log('[CapacitorPush] Notification received:', notification);
      onNotificationReceived(notification);
    }
  );

  // Listen for notification actions (user tapped notification)
  const actionListener = PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      console.log('[CapacitorPush] Action performed:', action);
      onNotificationAction(action);
    }
  );

  // Return cleanup function
  return () => {
    tokenListener.then(l => l.remove());
    errorListener.then(l => l.remove());
    notificationListener.then(l => l.remove());
    actionListener.then(l => l.remove());
  };
};

// Get delivered notifications
export const getDeliveredNotifications = async () => {
  if (!isPushAvailable()) return [];
  
  try {
    const result = await PushNotifications.getDeliveredNotifications();
    return result.notifications;
  } catch (error) {
    console.error('[CapacitorPush] Error getting notifications:', error);
    return [];
  }
};

// Remove all delivered notifications
export const removeAllDeliveredNotifications = async (): Promise<void> => {
  if (!isPushAvailable()) return;
  
  try {
    await PushNotifications.removeAllDeliveredNotifications();
    console.log('[CapacitorPush] All notifications removed');
  } catch (error) {
    console.error('[CapacitorPush] Error removing notifications:', error);
  }
};
