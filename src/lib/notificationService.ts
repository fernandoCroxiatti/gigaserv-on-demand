import { supabase } from '@/integrations/supabase/client';
import { PROVIDER_EVENT_MESSAGES, CLIENT_STATUS_MESSAGES } from './notificationMessages';

// Send notification for chamado events
export async function sendChamadoNotification(
  userId: string,
  eventType: keyof typeof PROVIDER_EVENT_MESSAGES | keyof typeof CLIENT_STATUS_MESSAGES,
  isProvider: boolean,
  chamadoId?: string
) {
  try {
    let notification: { title: string; body: string; priority?: string; tag?: string };
    
    if (isProvider && eventType in PROVIDER_EVENT_MESSAGES) {
      notification = PROVIDER_EVENT_MESSAGES[eventType as keyof typeof PROVIDER_EVENT_MESSAGES];
    } else if (!isProvider && eventType in CLIENT_STATUS_MESSAGES) {
      notification = CLIENT_STATUS_MESSAGES[eventType as keyof typeof CLIENT_STATUS_MESSAGES];
    } else {
      console.warn(`Unknown notification event type: ${eventType}`);
      return;
    }

    // Send via edge function
    await supabase.functions.invoke('send-notifications', {
      body: {
        action: 'event',
        userId,
        notificationType: `chamado_${eventType}`,
        title: notification.title,
        messageBody: notification.body,
        data: chamadoId ? { chamadoId, url: '/' } : undefined
      }
    });

    console.log(`[Notifications] Sent ${eventType} notification to user ${userId}`);
  } catch (error) {
    console.error('[Notifications] Error sending notification:', error);
  }
}

// Show local browser notification (for foreground)
export function showLocalNotification(title: string, body: string, options?: NotificationOptions) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...options
    });
  } catch (error) {
    console.error('[Notifications] Error showing local notification:', error);
  }
}
