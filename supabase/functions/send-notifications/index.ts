import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function isWithinPreferredHours(): boolean {
  const now = new Date();
  const hour = now.getUTCHours() - 3;
  const adjustedHour = hour < 0 ? hour + 24 : hour;
  return (adjustedHour >= 7 && adjustedHour <= 9) || (adjustedHour >= 17 && adjustedHour <= 19);
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
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[send-notifications] VAPID keys not configured, skipping web push');
    return false;
  }

  try {
    const endpoint = subscription.endpoint;
    const audience = new URL(endpoint).origin;
    
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
        salt: new Uint8Array(0).buffer,
        info: new TextEncoder().encode('Content-Encoding: aes128gcm\0').buffer
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
        salt: new Uint8Array(0).buffer,
        info: new TextEncoder().encode('Content-Encoding: nonce\0').buffer
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // deno-lint-ignore no-explicit-any
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'scheduled';

    console.log('[send-notifications] Action:', action);

    if (action === 'scheduled') {
      await sendScheduledNotifications(supabase);
    } else if (action === 'manual') {
      const { targetType, message } = body;
      await sendManualNotifications(supabase, targetType, message);
    } else if (action === 'event') {
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

  const payload = {
    title,
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: notificationType,
    data: data || {},
    requireInteraction: notificationType.includes('chamado'),
    vibrate: notificationType.includes('chamado') ? [300, 100, 300] : [200, 100, 200]
  };

  let anySent = false;
  for (const sub of subscriptions) {
    const sent = await sendWebPush(sub, payload);
    if (sent) anySent = true;
  }

  console.log('[send-notifications] Push sent to user:', userId, { title, anySent });
  return anySent;
}
