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

// VAPID keys for Web Push
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@gigasos.com.br';

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

// Check if within preferred notification hours (08h-20h Brazil time)
function isWithinPreferredHours(): boolean {
  const now = new Date();
  // Brazil is UTC-3
  const hour = now.getUTCHours() - 3;
  const adjustedHour = hour < 0 ? hour + 24 : hour;
  // Allow notifications between 08:00 and 20:00
  return adjustedHour >= 8 && adjustedHour <= 20;
}

// Base64URL encoding helpers
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - base64.length % 4) % 4;
  const padded = base64 + '='.repeat(padding);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Generate VAPID JWT token
async function generateVapidJwt(audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: VAPID_SUBJECT
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = base64UrlDecode(VAPID_PRIVATE_KEY);
  
  // Import as raw key for ECDSA P-256
  const privateKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(privateKeyBytes).buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

// Send Web Push notification
async function sendWebPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: object): Promise<boolean> {
  console.log('[send-notifications] Attempting web push to:', subscription.endpoint.substring(0, 50) + '...');
  
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[send-notifications] VAPID keys not configured!');
    console.log('[send-notifications] VAPID_PUBLIC_KEY present:', !!VAPID_PUBLIC_KEY);
    console.log('[send-notifications] VAPID_PRIVATE_KEY present:', !!VAPID_PRIVATE_KEY);
    return false;
  }

  if (!subscription.p256dh || !subscription.auth || subscription.p256dh === 'fcm' || subscription.auth === 'fcm') {
    console.log('[send-notifications] Skipping FCM subscription (not web push):', subscription.endpoint.substring(0, 30));
    return false;
  }

  try {
    const endpoint = subscription.endpoint;
    const audience = new URL(endpoint).origin;
    console.log('[send-notifications] Push audience:', audience);
    
    // Generate VAPID authorization header
    const jwt = await generateVapidJwt(audience);
    const vapidHeader = `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`;

    // Get encryption keys
    const p256dh = base64UrlDecode(subscription.p256dh);
    const auth = base64UrlDecode(subscription.auth);

    // Generate local ECDH key pair
    const localKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );

    // Export local public key
    const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
    const localPublicKeyBytes = new Uint8Array(localPublicKeyRaw);

    // Import subscriber's public key
    const subscriberPublicKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(p256dh).buffer as ArrayBuffer,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberPublicKey },
      localKeyPair.privateKey,
      256
    );

    // Create IKM
    const sharedSecretKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'HKDF',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive PRK
    const infoBytes = new Uint8Array([
      ...new TextEncoder().encode('WebPush: info\0'),
      ...p256dh,
      ...localPublicKeyBytes
    ]);
    
    const prkBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(auth).buffer as ArrayBuffer,
        info: new Uint8Array(infoBytes).buffer as ArrayBuffer
      },
      sharedSecretKey,
      256
    );

    const prkKey = await crypto.subtle.importKey(
      'raw',
      prkBits,
      'HKDF',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive CEK
    const cek = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new ArrayBuffer(0),
        info: new TextEncoder().encode('Content-Encoding: aes128gcm\0').buffer as ArrayBuffer
      },
      prkKey,
      { name: 'AES-GCM', length: 128 },
      false,
      ['encrypt']
    );

    // Derive nonce
    const nonceBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new ArrayBuffer(0),
        info: new TextEncoder().encode('Content-Encoding: nonce\0').buffer as ArrayBuffer
      },
      prkKey,
      96
    );
    const nonce = new Uint8Array(nonceBits);

    // Prepare plaintext
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const plaintext = new Uint8Array(payloadBytes.length + 1);
    plaintext.set(payloadBytes);
    plaintext[payloadBytes.length] = 2;

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      cek,
      plaintext
    );
    const encryptedBytes = new Uint8Array(encrypted);

    // Build header
    const recordSize = 4096;
    const header = new Uint8Array(5 + 65);
    const headerView = new DataView(header.buffer);
    headerView.setUint32(0, recordSize, false);
    header[4] = 65;
    header.set(localPublicKeyBytes, 5);

    // Combine
    const body = new Uint8Array(header.length + encryptedBytes.length);
    body.set(header);
    body.set(encryptedBytes, header.length);

    // Send
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': vapidHeader,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400'
      },
      body: body
    });

    if (response.ok || response.status === 201) {
      console.log('[send-notifications] Web push sent successfully');
      return true;
    } else {
      const errorText = await response.text();
      console.error('[send-notifications] Web push failed:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('[send-notifications] Web push error:', error);
    return false;
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
      const { targetType, message } = body;
      
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
      
      await sendManualNotifications(supabase, targetType, sanitizedMessage);
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
      
      await sendEventNotification(supabase, userId, notificationType || 'generic', sanitizedTitle, sanitizedBody, data);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[send-notifications] Error:', { message: errorMessage, stack: errorStack });
    // Return generic message to client, keep details in server logs
    return new Response(
      JSON.stringify({ error: 'Erro ao enviar notificação. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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

  const { data: offlineProviders } = await supabase
    .from('provider_data')
    .select('user_id')
    .eq('is_online', false)
    .eq('registration_complete', true);

  if (offlineProviders) {
    for (const provider of offlineProviders) {
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
          await sendPushToUser(supabase, provider.user_id, 'provider_motivational', message.title, message.body);
        }
      }
    }
  }

  const { data: inactiveProfiles } = await supabase
    .from('profiles')
    .select('user_id, updated_at')
    .eq('perfil_principal', 'client')
    .lt('updated_at', sevenDaysAgo.toISOString());

  if (inactiveProfiles) {
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const profile of inactiveProfiles) {
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
          await sendPushToUser(supabase, profile.user_id, 'client_reengagement', message.title, message.body);
        }
      }
    }
  }

  console.log('[send-notifications] Scheduled notifications completed.');
}

// deno-lint-ignore no-explicit-any
async function sendManualNotifications(supabase: any, targetType: string, message: { title: string; body: string }) {
  console.log('[send-notifications] Sending manual notifications to:', targetType);
  
  // deno-lint-ignore no-explicit-any
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

  let sentCount = 0;
  for (const user of users) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('enabled')
      .eq('user_id', user.user_id)
      .single();

    if (prefs?.enabled !== false) {
      const sent = await sendPushToUser(supabase, user.user_id, 'manual', message.title, message.body);
      if (sent) sentCount++;
    }
  }

  console.log('[send-notifications] Manual notifications sent to', sentCount, 'of', users.length, 'users.');
}

async function sendEventNotification(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  notificationType: string,
  title: string,
  body: string,
  // deno-lint-ignore no-explicit-any
  data?: any
) {
  console.log('[send-notifications] Sending event notification to:', userId);
  
  // Check per-user rate limit
  if (!checkUserRateLimit(userId)) {
    console.log('[send-notifications] User rate limit exceeded:', userId);
    return;
  }

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
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  notificationType: string,
  title: string,
  body: string,
  // deno-lint-ignore no-explicit-any
  data?: any
): Promise<boolean> {
  // Record in history
  await supabase.from('notification_history').insert({
    user_id: userId,
    notification_type: notificationType,
    title,
    body,
    data: data || null,
    sent_at: new Date().toISOString()
  });

  // Get user's push subscriptions
  const { data: subscriptions } = await supabase
    .from('notification_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (!subscriptions || subscriptions.length === 0) {
    console.log('[send-notifications] No subscriptions found for user:', userId);
    return false;
  }

  // Build deep link URL based on notification type
  const getDeepLinkUrl = (type: string, notifData: Record<string, unknown> | undefined): string => {
    const baseUrl = '/';
    
    // Deep link mapping by notification type
    if (type.includes('new_chamado') || type.includes('chamado_received')) {
      return notifData?.chamadoId ? `/?chamado=${notifData.chamadoId}` : '/';
    }
    if (type.includes('provider_accepted') || type.includes('chamado_accepted')) {
      return notifData?.chamadoId ? `/?chamado=${notifData.chamadoId}` : '/';
    }
    if (type.includes('payment')) {
      return '/profile?tab=payments';
    }
    if (type.includes('stripe') || type.includes('payout')) {
      return '/profile?tab=bank';
    }
    if (type.includes('fee') || type.includes('pending')) {
      return '/profile?tab=fees';
    }
    if (type.includes('provider_motivational')) {
      return '/'; // Main provider screen
    }
    if (type.includes('client_reengagement')) {
      return '/'; // Main client screen
    }
    
    return baseUrl;
  };

  const deepLinkUrl = getDeepLinkUrl(notificationType, data);

  // Determine if this is a HIGH PRIORITY chamado notification
  const isChamadoNotification = 
    notificationType.includes('chamado') || 
    notificationType.includes('new_chamado') ||
    notificationType.includes('chamado_received');

  const payload = {
    title,
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: isChamadoNotification ? `chamado-urgent-${Date.now()}` : notificationType,
    priority: isChamadoNotification ? 'high' : 'default',
    data: {
      ...(data || {}),
      url: deepLinkUrl,
      notificationType,
      timestamp: Date.now(),
      priority: isChamadoNotification ? 'high' : 'default'
    },
    requireInteraction: isChamadoNotification,
    renotify: isChamadoNotification,
    vibrate: isChamadoNotification 
      ? [500, 200, 500, 200, 500, 200, 500] // Long intense pattern for chamados
      : [200, 100, 200],
    // Add action buttons for chamado notifications
    actions: isChamadoNotification 
      ? [
          { action: 'accept', title: '✓ Aceitar' },
          { action: 'decline', title: '✕ Recusar' }
        ]
      : [],
    silent: false
  };

  let anySent = false;
  for (const sub of subscriptions) {
    const sent = await sendWebPush(sub, payload);
    if (sent) anySent = true;
  }

  console.log('[send-notifications] Push sent to user:', userId, { 
    title, 
    anySent, 
    priority: isChamadoNotification ? 'HIGH' : 'normal' 
  });
  return anySent;
}
