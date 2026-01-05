import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PROVIDER-HEARTBEAT] ${step}${detailsStr}`);
};

// Input validation constants
const MAX_ADDRESS_LENGTH = 500;

// Validate coordinate bounds
function isValidLatitude(lat: unknown): lat is number {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
}

function isValidLongitude(lng: unknown): lng is number {
  return typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
}

// Sanitize and truncate string
function sanitizeAddress(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  return value.replace(/[<>]/g, '').substring(0, MAX_ADDRESS_LENGTH).trim();
}

type HeartbeatBody = {
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logStep("No/invalid authorization header");
      return new Response(
        JSON.stringify({ error: "Sessão expirada" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token.length < 10) {
      logStep("Invalid token format");
      return new Response(
        JSON.stringify({ error: "Sessão inválida" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    // Use anon client with auth header to validate token (avoids "Auth session missing!")
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    let userId: string | null = null;
    const authAny = authClient.auth as any;

    if (typeof authAny.getClaims === "function") {
      const { data: claimsData, error: claimsError } = await authAny.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        logStep("Auth error via getClaims", { message: claimsError?.message || "missing claims" });
        return new Response(
          JSON.stringify({ error: "Sessão expirada" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
          },
        );
      }
      userId = claimsData.claims.sub;
    } else {
      const { data: userData, error: userError } = await authClient.auth.getUser(token);
      if (userError || !userData?.user) {
        logStep("Auth error via getUser", { message: userError?.message || "missing user" });
        return new Response(
          JSON.stringify({ error: "Sessão expirada" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
          },
        );
      }
      userId = userData.user.id;
    }

    // Use service role for DB updates (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const nowIso = new Date().toISOString();

    let body: HeartbeatBody = {};
    try {
      body = (await req.json()) as HeartbeatBody;
    } catch {
      body = {};
    }

    logStep("Heartbeat received", {
      userId,
      hasLocation: !!(body.location?.lat && body.location?.lng),
      ts: nowIso,
    });

    // CRITICAL FIX: First check if provider is ACTUALLY online in DB
    // If provider manually went offline, heartbeat should NOT force them back online
    const { data: providerData, error: fetchError } = await adminClient
      .from("provider_data")
      .select("is_online")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      logStep("Error fetching provider status", { message: fetchError.message });
      return new Response(
        JSON.stringify({ error: "Erro ao verificar status" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    // If provider is offline in DB, don't update anything - respect their choice
    if (!providerData?.is_online) {
      logStep("Provider is offline in DB - ignoring heartbeat (respecting manual choice)", { userId });
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: "provider_offline", ts: nowIso }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // Provider IS online - update timestamp and location only (NOT is_online)
    const update: Record<string, unknown> = {
      updated_at: nowIso,
      last_activity: nowIso,
    };

    // Validate and apply location data with coordinate bounds checking
    if (body.location) {
      if (isValidLatitude(body.location.lat) && isValidLongitude(body.location.lng)) {
        update.current_lat = body.location.lat;
        update.current_lng = body.location.lng;
        const sanitizedAddress = sanitizeAddress(body.location.address);
        if (sanitizedAddress) {
          update.current_address = sanitizedAddress;
        }
        logStep("Location updated", { lat: body.location.lat, lng: body.location.lng });
      } else {
        logStep("Invalid coordinates rejected", { 
          lat: body.location.lat, 
          lng: body.location.lng 
        });
      }
    }

    const { error: updateErr } = await adminClient
      .from("provider_data")
      .update(update)
      .eq("user_id", userId);

    if (updateErr) {
      logStep("ERROR updating provider_data", { message: updateErr.message });
      throw updateErr;
    }

    return new Response(JSON.stringify({ ok: true, ts: nowIso }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR", { message: errorMessage, stack: errorStack });
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
