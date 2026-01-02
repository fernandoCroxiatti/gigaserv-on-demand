import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting for notification endpoints
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_GLOBAL = 500; // 500 notifications per hour globally
const RATE_LIMIT_MAX_PER_USER = 20; // 20 per user per hour

let globalNotificationCount = 0;
let globalResetTime = Date.now() + RATE_LIMIT_WINDOW_MS;

function checkGlobalRateLimit(): boolean {
  const now = Date.now();
  if (now > globalResetTime) {
    globalNotificationCount = 0;
    globalResetTime = now + RATE_LIMIT_WINDOW_MS;
  }
  if (globalNotificationCount >= RATE_LIMIT_MAX_GLOBAL) {
    return false;
  }
  globalNotificationCount++;
  return true;
}

function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_PER_USER) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

// Check if within preferred notification hours (08h-20h Brazil time)
function isWithinPreferredHours(): boolean {
  const now = new Date();
  // Brazil is UTC-3
  const hour = now.getUTCHours() - 3;
  const adjustedHour = hour < 0 ? hour + 24 : hour;
  // Allow notifications between 08:00 and 20:00
  return adjustedHour >= 8 && adjustedHour <= 20;
}

// Send notification via OneSignal
async function sendOneSignalNotification(
  userId: string,
  title: string,
  body: string,
  notificationType: string,
  data?: Record<string, unknown>,
  scheduledAt?: Date
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
          action: notificationType === 'chamada' ? 'chamada' : 'promocao',
          user_id: userId,
          title,
          body,
          data,
          scheduled_at: scheduledAt?.toISOString(),
        }),
      }
    );
    
    if (!response.ok) {
      const errText = await response.text();
      console.error('[send-notifications] OneSignal push failed:', errText);
      return false;
    }
    
    console.log('[send-notifications] OneSignal notification sent to:', userId.substring(0, 8));
    return true;
  } catch (error) {
    console.error('[send-notifications] OneSignal error:', error);
    return false;
  }
}

// deno-lint-ignore no-explicit-any
async function sendPushToUser(supabase: any, userId: string, notificationType: string, title: string, body: string, data?: Record<string, unknown>) {
  if (!checkUserRateLimit(userId)) {
    console.log('[send-notifications] User rate limit exceeded for:', userId.substring(0, 8));
    return;
  }

  const success = await sendOneSignalNotification(userId, title, body, notificationType, data);
  
  if (success) {
    await supabase
      .from('notification_history')
      .insert({
        user_id: userId,
        notification_type: notificationType,
        title,
        body,
        data,
      });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check global rate limit first
    if (!checkGlobalRateLimit()) {
      console.log('[send-notifications] Global rate limit exceeded');
      return new Response(
        JSON.stringify({ error: 'Sistema de notificações temporariamente sobrecarregado. Tente novamente em alguns minutos.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // deno-lint-ignore no-explicit-any
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'scheduled';

    // Input validation constants
    const MAX_TITLE_LENGTH = 100;
    const MAX_BODY_LENGTH = 500;
    const VALID_ACTIONS = ['scheduled', 'manual', 'event'];
    const VALID_TARGET_TYPES = ['providers', 'clients', 'all'];

    // Validate action
    if (!VALID_ACTIONS.includes(action)) {
      console.log('[send-notifications] Invalid action:', action);
      return new Response(
        JSON.stringify({ error: 'Ação inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-notifications] Action:', action);

    if (action === 'scheduled') {
      await sendScheduledNotifications(supabase);
    } else if (action === 'manual') {
      const { targetType, message, scheduledAt } = body;
      
      // Validate targetType
      if (!targetType || !VALID_TARGET_TYPES.includes(targetType)) {
        return new Response(
          JSON.stringify({ error: 'Tipo de destinatário inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Validate and sanitize message
      if (!message || typeof message.title !== 'string' || typeof message.body !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Título e corpo da mensagem são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const sanitizedMessage = {
        title: message.title.substring(0, MAX_TITLE_LENGTH).trim(),
        body: message.body.substring(0, MAX_BODY_LENGTH).trim(),
      };
      
      // Parse scheduled date if provided
      const scheduledDate = scheduledAt ? new Date(scheduledAt) : undefined;
      
      await sendManualNotifications(supabase, targetType, sanitizedMessage, scheduledDate);
    } else if (action === 'event') {
      const { userId, notificationType, title, messageBody, data } = body;
      
      // Validate required fields
      if (!userId || typeof userId !== 'string') {
        return new Response(
          JSON.stringify({ error: 'userId é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Sanitize title and body
      const sanitizedTitle = typeof title === 'string' ? title.substring(0, MAX_TITLE_LENGTH).trim() : 'Notificação';
      const sanitizedBody = typeof messageBody === 'string' ? messageBody.substring(0, MAX_BODY_LENGTH).trim() : '';
      
      await sendPushToUser(supabase, userId, notificationType || 'generic', sanitizedTitle, sanitizedBody, data);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[send-notifications] Error:', { message: errorMessage, stack: errorStack });
    return new Response(
      JSON.stringify({ error: 'Erro ao enviar notificação. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
      console.log('[send-notifications] User is not a registered provider:', userId.substring(0, 8));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[send-notifications] Error validating provider:', err);
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
      console.log('[send-notifications] User profile not found or invalid:', userId.substring(0, 8));
      return false;
    }
    return profile.perfil_principal === 'client';
  } catch (err) {
    console.error('[send-notifications] Error validating client:', err);
    return false;
  }
}

// deno-lint-ignore no-explicit-any
async function sendScheduledNotifications(supabase: any) {
  console.log('[send-notifications] Running scheduled notifications...');
  
  if (!isWithinPreferredHours()) {
    console.log('[send-notifications] Outside preferred hours, skipping.');
    return;
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ===== PROVIDER MOTIVATIONAL NOTIFICATIONS =====
  // Only query from provider_data table (already ensures they are providers)
  const { data: offlineProviders } = await supabase
    .from('provider_data')
    .select('user_id')
    .eq('is_online', false)
    .eq('registration_complete', true);

  if (offlineProviders) {
    for (const provider of offlineProviders) {
      // FAIL-SAFE: Double-check user is actually a provider before sending
      const isProvider = await validateUserIsProvider(supabase, provider.user_id);
      if (!isProvider) {
        console.log('[send-notifications] BLOCKED: Skipping non-provider user:', provider.user_id.substring(0, 8));
        continue;
      }

      const { data: recentNotif } = await supabase
        .from('notification_history')
        .select('id')
        .eq('user_id', provider.user_id)
        .eq('notification_type', 'provider_motivational')
        .gte('sent_at', oneDayAgo.toISOString())
        .limit(1);

      if (!recentNotif || recentNotif.length === 0) {
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('promotional, enabled')
          .eq('user_id', provider.user_id)
          .single();

        if (prefs?.enabled && prefs?.promotional !== false) {
          const message = getRandomMessage(PROVIDER_MOTIVATIONAL_MESSAGES);
          console.log('[send-notifications] Sending provider_motivational to verified provider:', provider.user_id.substring(0, 8));
          await sendPushToUser(supabase, provider.user_id, 'provider_motivational', message.title, message.body);
        }
      }
    }
  }

  // ===== CLIENT REENGAGEMENT NOTIFICATIONS =====
  const { data: inactiveProfiles } = await supabase
    .from('profiles')
    .select('user_id, updated_at, perfil_principal')
    .eq('perfil_principal', 'client')
    .lt('updated_at', sevenDaysAgo.toISOString());

  if (inactiveProfiles) {
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const profile of inactiveProfiles) {
      // FAIL-SAFE: Double-check user is actually a client before sending
      const isClient = await validateUserIsClient(supabase, profile.user_id);
      if (!isClient) {
        console.log('[send-notifications] BLOCKED: Skipping non-client user:', profile.user_id.substring(0, 8));
        continue;
      }

      const { data: recentNotif } = await supabase
        .from('notification_history')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('notification_type', 'client_reengagement')
        .gte('sent_at', oneWeekAgo.toISOString())
        .limit(1);

      if (!recentNotif || recentNotif.length === 0) {
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('promotional, enabled')
          .eq('user_id', profile.user_id)
          .single();

        if (prefs?.enabled && prefs?.promotional !== false) {
          const message = getRandomMessage(CLIENT_REENGAGEMENT_MESSAGES);
          console.log('[send-notifications] Sending client_reengagement to verified client:', profile.user_id.substring(0, 8));
          await sendPushToUser(supabase, profile.user_id, 'client_reengagement', message.title, message.body);
        }
      }
    }
  }

  console.log('[send-notifications] Scheduled notifications completed.');
}

// deno-lint-ignore no-explicit-any
async function sendManualNotifications(supabase: any, targetType: string, message: { title: string; body: string }, scheduledAt?: Date, adminId?: string) {
  console.log('[send-notifications] Sending manual notifications to:', targetType, scheduledAt ? `scheduled for ${scheduledAt.toISOString()}` : 'immediate');
  
  // If scheduled, save to scheduled_notifications table
  if (scheduledAt && scheduledAt > new Date()) {
    const { data: scheduled, error: scheduleError } = await supabase
      .from('scheduled_notifications')
      .insert({
        title: message.title,
        body: message.body,
        target_type: targetType,
        scheduled_at: scheduledAt.toISOString(),
        status: 'pending',
        created_by: adminId,
        data: { targetType },
      })
      .select()
      .single();

    if (scheduleError) {
      console.error('[send-notifications] Error scheduling notification:', scheduleError);
      throw scheduleError;
    }

    console.log('[send-notifications] Notification scheduled with ID:', scheduled.id);
    return;
  }
  
  // deno-lint-ignore no-explicit-any
  let users: any[] = [];
  
  if (targetType === 'providers') {
    // Get only registered providers from provider_data
    const { data } = await supabase
      .from('provider_data')
      .select('user_id')
      .eq('registration_complete', true);
    users = data || [];
  } else if (targetType === 'clients') {
    // Get only clients from profiles
    const { data } = await supabase
      .from('profiles')
      .select('user_id, perfil_principal')
      .eq('perfil_principal', 'client');
    users = data || [];
  } else {
    // all users - no type filtering
    const { data } = await supabase
      .from('profiles')
      .select('user_id');
    users = data || [];
  }

  console.log('[send-notifications] Candidates before validation:', users.length);

  let successCount = 0;
  let blockedCount = 0;
  
  for (const user of users) {
    // ===== MANDATORY USER TYPE VALIDATION =====
    // For provider-targeted notifications: MUST validate user is actually a provider
    if (targetType === 'providers') {
      const isProvider = await validateUserIsProvider(supabase, user.user_id);
      if (!isProvider) {
        console.log('[send-notifications] BLOCKED: User is not a provider:', user.user_id.substring(0, 8));
        blockedCount++;
        continue;
      }
    }
    
    // For client-targeted notifications: MUST validate user is actually a client
    if (targetType === 'clients') {
      const isClient = await validateUserIsClient(supabase, user.user_id);
      if (!isClient) {
        console.log('[send-notifications] BLOCKED: User is not a client:', user.user_id.substring(0, 8));
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
        message.title,
        message.body,
        'manual_broadcast',
        { targetType }
      );
      
      if (success) {
        successCount++;
        // Log to history
        await supabase
          .from('notification_history')
          .insert({
            user_id: user.user_id,
            notification_type: 'manual_broadcast',
            title: message.title,
            body: message.body,
            data: { targetType },
          });
      }
    }
  }

  console.log('[send-notifications] Manual notifications completed. Sent:', successCount, '/', users.length, '| Blocked:', blockedCount);
}
