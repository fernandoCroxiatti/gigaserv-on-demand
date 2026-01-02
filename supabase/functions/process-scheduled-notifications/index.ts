import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Send notification via OneSignal
async function sendOneSignalNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/onesignal-push`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          action: 'promocao',
          user_id: userId,
          title,
          body,
          data,
        }),
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error('[process-scheduled] OneSignal error:', error);
    return false;
  }
}

// Helper to validate user type before sending notifications
// deno-lint-ignore no-explicit-any
async function validateUserIsProvider(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data: providerData, error } = await supabase
      .from('provider_data')
      .select('user_id, registration_complete')
      .eq('user_id', userId)
      .eq('registration_complete', true)
      .maybeSingle();
    
    if (error || !providerData) {
      return false;
    }
    return true;
  } catch (err) {
    console.error('[process-scheduled] Error validating provider:', err);
    return false;
  }
}

// deno-lint-ignore no-explicit-any
async function validateUserIsClient(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('perfil_principal')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error || !profile || !profile.perfil_principal) {
      return false;
    }
    return profile.perfil_principal === 'client';
  } catch (err) {
    console.error('[process-scheduled] Error validating client:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[process-scheduled] Checking for pending scheduled notifications...');

    // Get notifications that are scheduled for now or earlier
    const now = new Date().toISOString();
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('[process-scheduled] Error fetching notifications:', fetchError);
      throw fetchError;
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('[process-scheduled] No pending notifications to process');
      return new Response(
        JSON.stringify({ processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-scheduled] Found', pendingNotifications.length, 'notifications to process');

    let processedCount = 0;

    for (const notification of pendingNotifications) {
      try {
        // Get target users based on target_type
        let users: { user_id: string }[] = [];
        
        if (notification.target_type === 'providers') {
          // Get only registered providers from provider_data
          const { data } = await supabase
            .from('provider_data')
            .select('user_id')
            .eq('registration_complete', true);
          users = data || [];
        } else if (notification.target_type === 'clients') {
          // Get only clients from profiles
          const { data } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('perfil_principal', 'client');
          users = data || [];
        } else {
          const { data } = await supabase
            .from('profiles')
            .select('user_id');
          users = data || [];
        }
        
        console.log('[process-scheduled] Candidates before validation:', users.length, 'for target_type:', notification.target_type);

        let sentCount = 0;
        let blockedCount = 0;
        
        for (const user of users) {
          // ===== MANDATORY USER TYPE VALIDATION =====
          // For provider-targeted notifications: MUST validate user is actually a provider
          if (notification.target_type === 'providers') {
            const isProvider = await validateUserIsProvider(supabase, user.user_id);
            if (!isProvider) {
              console.log('[process-scheduled] BLOCKED: User is not a provider:', user.user_id.substring(0, 8));
              blockedCount++;
              continue;
            }
          }
          
          // For client-targeted notifications: MUST validate user is actually a client
          if (notification.target_type === 'clients') {
            const isClient = await validateUserIsClient(supabase, user.user_id);
            if (!isClient) {
              console.log('[process-scheduled] BLOCKED: User is not a client:', user.user_id.substring(0, 8));
              blockedCount++;
              continue;
            }
          }

          // Check user preferences
          const { data: prefs } = await supabase
            .from('notification_preferences')
            .select('promotional, enabled')
            .eq('user_id', user.user_id)
            .single();

          if (prefs?.enabled && prefs?.promotional !== false) {
            const success = await sendOneSignalNotification(
              user.user_id,
              notification.title,
              notification.body,
              { scheduledNotificationId: notification.id }
            );
            
            if (success) {
              sentCount++;
              
              // Log to notification_history
              await supabase
                .from('notification_history')
                .insert({
                  user_id: user.user_id,
                  notification_type: 'scheduled_broadcast',
                  title: notification.title,
                  body: notification.body,
                  data: { scheduledNotificationId: notification.id },
                });
            }
          }
        }
        
        console.log('[process-scheduled] Notification', notification.id, '| Blocked:', blockedCount);

        // Update notification status to sent
        await supabase
          .from('scheduled_notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            recipients_count: users.length,
            sent_count: sentCount,
          })
          .eq('id', notification.id);

        console.log('[process-scheduled] Notification', notification.id, 'sent to', sentCount, '/', users.length, 'users');
        processedCount++;
      } catch (error) {
        console.error('[process-scheduled] Error processing notification', notification.id, error);
        
        // Mark as failed
        await supabase
          .from('scheduled_notifications')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            failure_reason: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', notification.id);
      }
    }

    return new Response(
      JSON.stringify({ processed: processedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[process-scheduled] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
