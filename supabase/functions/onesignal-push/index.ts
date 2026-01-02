import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OneSignal configuration
const ONESIGNAL_APP_ID = '2ca423ff-e288-4804-92b3-8d64f58fa918';
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') || '';

// Notification channels
const CHANNEL_CHAMADAS = 'chamadas';
const CHANNEL_PROMOCOES = 'promocoes';

interface NotificationPayload {
  action: 'chamada' | 'promocao' | 'aviso' | 'cancel';
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  chamadoId?: string;
  scheduled_at?: string; // ISO date for scheduled notifications
}

interface OneSignalNotification {
  app_id: string;
  include_aliases?: {
    external_id: string[];
  };
  target_channel?: string;
  contents: { en: string; pt: string };
  headings: { en: string; pt: string };
  data?: Record<string, unknown>;
  android_channel_id?: string;
  priority?: number;
  ttl?: number;
  collapse_id?: string;
  android_visibility?: number;
  android_sound?: string;
  ios_sound?: string;
  send_after?: string;
  // Persistent notification settings
  android_accent_color?: string;
  android_led_color?: string;
  android_group?: string;
  thread_id?: string;
  web_push_topic?: string;
  // Cancel notification
  isTargetingAll?: boolean;
  included_segments?: string[];
}

async function sendOneSignalNotification(notification: OneSignalNotification): Promise<boolean> {
  if (!ONESIGNAL_REST_API_KEY) {
    console.error('[onesignal-push] REST API key not configured');
    return false;
  }

  try {
    console.log('[onesignal-push] Sending notification:', JSON.stringify(notification, null, 2));

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notification),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('[onesignal-push] Notification sent successfully:', result);
      return true;
    } else {
      console.error('[onesignal-push] Failed to send notification:', result);
      return false;
    }
  } catch (error) {
    console.error('[onesignal-push] Error sending notification:', error);
    return false;
  }
}

async function cancelNotification(notificationId: string): Promise<boolean> {
  if (!ONESIGNAL_REST_API_KEY) {
    console.error('[onesignal-push] REST API key not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://onesignal.com/api/v1/notifications/${notificationId}?app_id=${ONESIGNAL_APP_ID}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
      }
    );

    if (response.ok) {
      console.log('[onesignal-push] Notification cancelled:', notificationId);
      return true;
    } else {
      const result = await response.json();
      console.error('[onesignal-push] Failed to cancel notification:', result);
      return false;
    }
  } catch (error) {
    console.error('[onesignal-push] Error cancelling notification:', error);
    return false;
  }
}

// Helper to validate user type before sending provider-specific notifications
// deno-lint-ignore no-explicit-any
async function validateUserType(
  supabase: any,
  userId: string,
  requiredType: 'provider' | 'client'
): Promise<boolean> {
  try {
    if (requiredType === 'provider') {
      // Check if user exists in provider_data with registration complete
      const { data: providerData, error } = await supabase
        .from('provider_data')
        .select('user_id, registration_complete')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error || !providerData) {
        console.log('[onesignal-push] User is not a registered provider:', userId.substring(0, 8));
        return false;
      }
      return true;
    } else {
      // Check if user has client profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('perfil_principal')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error || !profile) {
        console.log('[onesignal-push] User profile not found:', userId.substring(0, 8));
        return false;
      }
      return profile.perfil_principal === 'client';
    }
  } catch (err) {
    console.error('[onesignal-push] Error validating user type:', err);
    return false;
  }
}

// Filter user IDs by type - returns only valid users for the notification type
// deno-lint-ignore no-explicit-any
async function filterUsersByType(
  supabase: any,
  userIds: string[],
  requiredType: 'provider' | 'client' | null
): Promise<string[]> {
  if (!requiredType || userIds.length === 0) return userIds;
  
  const validUserIds: string[] = [];
  for (const uid of userIds) {
    const isValid = await validateUserType(supabase, uid, requiredType);
    if (isValid) {
      validUserIds.push(uid);
    } else {
      console.log(`[onesignal-push] BLOCKED: User ${uid.substring(0, 8)} is not a ${requiredType}`);
    }
  }
  return validUserIds;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    console.log('[onesignal-push] Received payload:', payload);

    const { action, userId, userIds, title, body, data, chamadoId, scheduled_at } = payload;

    // Get target user IDs
    let targetUserIds: string[] = userIds || (userId ? [userId] : []);
    
    if (targetUserIds.length === 0 && action !== 'cancel') {
      return new Response(
        JSON.stringify({ error: 'No target users specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== USER TYPE VALIDATION =====
    // For 'chamada' action: MUST be sent ONLY to providers (fail-safe)
    if (action === 'chamada') {
      console.log('[onesignal-push] Validating provider user types for chamada notification...');
      targetUserIds = await filterUsersByType(supabase, targetUserIds, 'provider');
      
      if (targetUserIds.length === 0) {
        console.log('[onesignal-push] No valid providers to notify after validation');
        return new Response(
          JSON.stringify({ success: false, message: 'No valid providers to notify' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('[onesignal-push] Valid providers after filter:', targetUserIds.length);
    }

    let success = false;

    if (action === 'chamada') {
      // HIGH PRIORITY chamada notification - persistent until action
      const notification: OneSignalNotification = {
        app_id: ONESIGNAL_APP_ID,
        include_aliases: {
          external_id: targetUserIds,
        },
        target_channel: 'push',
        headings: { en: title, pt: title },
        contents: { en: body, pt: body },
        data: {
          ...data,
          chamadoId,
          type: 'chamada',
          timestamp: Date.now(),
        },
        // High priority settings for chamadas
        priority: 10, // Highest priority
        ttl: 120, // 2 minutes TTL
        android_visibility: 1, // Public visibility on lock screen
        android_channel_id: CHANNEL_CHAMADAS,
        android_sound: 'default', // System default sound
        ios_sound: 'default',
        // Persistent notification - use chamadoId as collapse_id to replace/cancel
        collapse_id: chamadoId,
        android_group: 'chamadas',
        thread_id: 'chamadas',
        web_push_topic: chamadoId, // For web push replacement
        android_accent_color: 'FF22C55E', // Primary green color
        android_led_color: 'FF22C55E',
      };

      success = await sendOneSignalNotification(notification);

      // Store notification ID for later cancellation
      if (success && chamadoId) {
        await supabase
          .from('chamados')
          .update({ onesignal_notification_id: chamadoId })
          .eq('id', chamadoId);
      }

    } else if (action === 'promocao' || action === 'aviso') {
      // Normal priority promotional/informational notification
      const notification: OneSignalNotification = {
        app_id: ONESIGNAL_APP_ID,
        include_aliases: {
          external_id: targetUserIds,
        },
        target_channel: 'push',
        headings: { en: title, pt: title },
        contents: { en: body, pt: body },
        data: {
          ...data,
          type: action,
          timestamp: Date.now(),
        },
        // Normal priority for promotions
        priority: 5,
        android_channel_id: CHANNEL_PROMOCOES,
        // No explicit sound for promotions (uses channel default)
        // Scheduled send if specified
        ...(scheduled_at && { send_after: scheduled_at }),
      };

      success = await sendOneSignalNotification(notification);

    } else if (action === 'cancel' && chamadoId) {
      // Cancel a chamada notification when handled
      // OneSignal doesn't support direct cancellation by collapse_id,
      // but we can send a silent replacement notification
      const notification: OneSignalNotification = {
        app_id: ONESIGNAL_APP_ID,
        include_aliases: {
          external_id: targetUserIds.length > 0 ? targetUserIds : ['*'],
        },
        target_channel: 'push',
        headings: { en: '', pt: '' },
        contents: { en: '', pt: '' },
        collapse_id: chamadoId,
        web_push_topic: chamadoId,
        ttl: 1, // Expire immediately
        priority: 1,
      };
      
      // Note: Sending an empty notification with same collapse_id replaces the previous one
      // This effectively "cancels" the persistent notification
      success = await sendOneSignalNotification(notification);
    }

    // Record in notification history
    if (success && targetUserIds.length > 0) {
      for (const uid of targetUserIds) {
        await supabase.from('notification_history').insert({
          user_id: uid,
          notification_type: action,
          title,
          body,
          data: data || null,
          sent_at: new Date().toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({ success, message: success ? 'Notification sent' : 'Failed to send notification' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[onesignal-push] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
