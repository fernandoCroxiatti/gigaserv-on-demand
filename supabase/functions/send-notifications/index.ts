import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Notification messages
const PROVIDER_MOTIVATIONAL_MESSAGES = [
  { title: 'Chamados na sua região', body: 'Chamados disponíveis na sua região agora.' },
  { title: 'Clientes próximos', body: 'Clientes próximos precisam de assistência.' },
  { title: 'Fique online', body: 'Fique online para receber novas oportunidades.' },
  { title: 'Movimento ativo', body: 'Movimento ativo na sua área neste momento.' },
  { title: 'Prestadores atendendo', body: 'Prestadores ativos estão atendendo chamados agora.' },
  { title: 'Novas oportunidades', body: 'Novos chamados podem surgir a qualquer momento.' }
];

const CLIENT_REENGAGEMENT_MESSAGES = [
  { title: 'Precisa de ajuda?', body: 'Precisa de assistência? O GIGA S.O.S está disponível.' },
  { title: 'Estamos aqui', body: 'Estamos prontos para ajudar quando você precisar.' },
  { title: 'GIGA S.O.S', body: 'Conte com o GIGA S.O.S para emergências veiculares.' }
];

function getRandomMessage<T>(messages: T[]): T {
  return messages[Math.floor(Math.random() * messages.length)];
}

function isWithinPreferredHours(): boolean {
  const now = new Date();
  const hour = now.getUTCHours() - 3; // Brazil timezone (UTC-3)
  const adjustedHour = hour < 0 ? hour + 24 : hour;
  return (adjustedHour >= 7 && adjustedHour <= 9) || (adjustedHour >= 17 && adjustedHour <= 19);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'scheduled';

    console.log('[send-notifications] Action:', action);

    if (action === 'scheduled') {
      // Scheduled notifications - run by cron
      await sendScheduledNotifications(supabase);
    } else if (action === 'manual') {
      // Manual trigger from admin
      const { targetType, message } = body;
      await sendManualNotifications(supabase, targetType, message);
    } else if (action === 'event') {
      // Event-based notification (chamado status change, etc.)
      const { userId, notificationType, title, messageBody, data } = body;
      await sendEventNotification(supabase, userId, notificationType, title, messageBody, data);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[send-notifications] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendScheduledNotifications(supabase: any) {
  console.log('[send-notifications] Running scheduled notifications...');
  
  // Only send during preferred hours
  if (!isWithinPreferredHours()) {
    console.log('[send-notifications] Outside preferred hours, skipping.');
    return;
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Provider motivational notifications (offline providers)
  const { data: offlineProviders } = await supabase
    .from('provider_data')
    .select('user_id')
    .eq('is_online', false)
    .eq('registration_complete', true);

  if (offlineProviders) {
    for (const provider of offlineProviders) {
      // Check if already sent today
      const { data: recentNotif } = await supabase
        .from('notification_history')
        .select('id')
        .eq('user_id', provider.user_id)
        .eq('notification_type', 'provider_motivational')
        .gte('sent_at', oneDayAgo.toISOString())
        .limit(1);

      if (!recentNotif || recentNotif.length === 0) {
        // Check user preferences
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('promotional, enabled')
          .eq('user_id', provider.user_id)
          .single();

        if (prefs?.enabled && prefs?.promotional !== false) {
          const message = getRandomMessage(PROVIDER_MOTIVATIONAL_MESSAGES);
          await sendPushToUser(supabase, provider.user_id, 'provider_motivational', message.title, message.body);
        }
      }
    }
  }

  // 2. Client reengagement (inactive for 7+ days)
  const { data: inactiveProfiles } = await supabase
    .from('profiles')
    .select('user_id, updated_at')
    .eq('perfil_principal', 'client')
    .lt('updated_at', sevenDaysAgo.toISOString());

  if (inactiveProfiles) {
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const profile of inactiveProfiles) {
      // Check if already sent this week
      const { data: recentNotif } = await supabase
        .from('notification_history')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('notification_type', 'client_reengagement')
        .gte('sent_at', oneWeekAgo.toISOString())
        .limit(1);

      if (!recentNotif || recentNotif.length === 0) {
        // Check user preferences
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('promotional, enabled')
          .eq('user_id', profile.user_id)
          .single();

        if (prefs?.enabled && prefs?.promotional !== false) {
          const message = getRandomMessage(CLIENT_REENGAGEMENT_MESSAGES);
          await sendPushToUser(supabase, profile.user_id, 'client_reengagement', message.title, message.body);
        }
      }
    }
  }

  console.log('[send-notifications] Scheduled notifications completed.');
}

async function sendManualNotifications(supabase: any, targetType: string, message: { title: string; body: string }) {
  console.log('[send-notifications] Sending manual notifications to:', targetType);
  
  let users: any[] = [];
  
  if (targetType === 'providers') {
    const { data } = await supabase
      .from('provider_data')
      .select('user_id')
      .eq('registration_complete', true);
    users = data || [];
  } else if (targetType === 'clients') {
    const { data } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('perfil_principal', 'client');
    users = data || [];
  } else if (targetType === 'all') {
    const { data } = await supabase
      .from('profiles')
      .select('user_id');
    users = data || [];
  }

  for (const user of users) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('enabled')
      .eq('user_id', user.user_id)
      .single();

    if (prefs?.enabled !== false) {
      await sendPushToUser(supabase, user.user_id, 'manual', message.title, message.body);
    }
  }

  console.log('[send-notifications] Manual notifications sent to', users.length, 'users.');
}

async function sendEventNotification(
  supabase: any,
  userId: string,
  notificationType: string,
  title: string,
  body: string,
  data?: any
) {
  console.log('[send-notifications] Sending event notification to:', userId);
  
  // Check user preferences for chamado updates
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('enabled, chamado_updates')
    .eq('user_id', userId)
    .single();

  if (prefs?.enabled === false) {
    console.log('[send-notifications] User has notifications disabled.');
    return;
  }

  if (notificationType.includes('chamado') && prefs?.chamado_updates === false) {
    console.log('[send-notifications] User has chamado updates disabled.');
    return;
  }

  await sendPushToUser(supabase, userId, notificationType, title, body, data);
}

async function sendPushToUser(
  supabase: any,
  userId: string,
  notificationType: string,
  title: string,
  body: string,
  data?: any
) {
  // Record in history
  await supabase.from('notification_history').insert({
    user_id: userId,
    notification_type: notificationType,
    title,
    body,
    data: data || null,
    sent_at: new Date().toISOString()
  });

  // For web push, we would need to get user's push subscription
  // and send via Web Push API. For now, we just log it.
  // In production, you would:
  // 1. Get user's subscription from notification_subscriptions
  // 2. Use web-push library to send the notification
  
  console.log('[send-notifications] Recorded notification for user:', userId, { title, body });
  
  // TODO: Implement actual web push when VAPID keys are configured
  // const { data: subscriptions } = await supabase
  //   .from('notification_subscriptions')
  //   .select('*')
  //   .eq('user_id', userId);
  
  // for (const sub of subscriptions || []) {
  //   await webpush.sendNotification(sub, JSON.stringify({ title, body, data }));
  // }
}
