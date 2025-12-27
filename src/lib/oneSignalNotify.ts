import { supabase } from '@/integrations/supabase/client';

/**
 * Send a chamada notification to a provider
 * HIGH PRIORITY - Persistent until action
 */
export async function sendChamadaNotification(
  providerId: string,
  chamadoId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('onesignal-push', {
      body: {
        action: 'chamada',
        userId: providerId,
        chamadoId,
        title,
        body,
        data: {
          ...data,
          url: `/?chamado=${chamadoId}`,
        },
      },
    });

    if (error) {
      console.error('[OneSignalNotify] Error sending chamada notification:', error);
      return false;
    }

    console.log('[OneSignalNotify] Chamada notification sent to provider:', providerId);
    return true;
  } catch (error) {
    console.error('[OneSignalNotify] Error:', error);
    return false;
  }
}

/**
 * Cancel a chamada notification (when chamado is accepted/declined/expired)
 */
export async function cancelChamadaNotification(
  providerIds: string[],
  chamadoId: string
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('onesignal-push', {
      body: {
        action: 'cancel',
        userIds: providerIds,
        chamadoId,
        title: '',
        body: '',
      },
    });

    if (error) {
      console.error('[OneSignalNotify] Error cancelling notification:', error);
      return false;
    }

    console.log('[OneSignalNotify] Chamada notification cancelled for providers');
    return true;
  } catch (error) {
    console.error('[OneSignalNotify] Error:', error);
    return false;
  }
}

/**
 * Send a client notification (e.g., provider accepted)
 */
export async function sendClientNotification(
  clientId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('onesignal-push', {
      body: {
        action: 'aviso',
        userId: clientId,
        title,
        body,
        data,
      },
    });

    if (error) {
      console.error('[OneSignalNotify] Error sending client notification:', error);
      return false;
    }

    console.log('[OneSignalNotify] Client notification sent:', clientId);
    return true;
  } catch (error) {
    console.error('[OneSignalNotify] Error:', error);
    return false;
  }
}

/**
 * Send a promotional notification to multiple users
 */
export async function sendPromotionalNotification(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  scheduledAt?: Date
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('onesignal-push', {
      body: {
        action: 'promocao',
        userIds,
        title,
        body,
        data,
        scheduled_at: scheduledAt?.toISOString(),
      },
    });

    if (error) {
      console.error('[OneSignalNotify] Error sending promotional notification:', error);
      return false;
    }

    console.log('[OneSignalNotify] Promotional notification sent to', userIds.length, 'users');
    return true;
  } catch (error) {
    console.error('[OneSignalNotify] Error:', error);
    return false;
  }
}

/**
 * Send an informational notification to a single user
 */
export async function sendInfoNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('onesignal-push', {
      body: {
        action: 'aviso',
        userId,
        title,
        body,
        data,
      },
    });

    if (error) {
      console.error('[OneSignalNotify] Error sending info notification:', error);
      return false;
    }

    console.log('[OneSignalNotify] Info notification sent:', userId);
    return true;
  } catch (error) {
    console.error('[OneSignalNotify] Error:', error);
    return false;
  }
}
