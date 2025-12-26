import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[TOGGLE-PROVIDER-ONLINE] ${step}${detailsStr}`);
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

type ToggleBody = {
  online: boolean;
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body = (await req.json()) as ToggleBody;
    const nowIso = new Date().toISOString();

    logStep("Toggle request", {
      userId: user.id,
      online: body.online,
      hasLocation: !!(body.location?.lat && body.location?.lng),
    });

    // Update profile active_profile when going online
    if (body.online) {
      await supabaseClient
        .from("profiles")
        .update({ active_profile: "provider" })
        .eq("user_id", user.id);
    }

    const update: Record<string, unknown> = {
      is_online: body.online,
      updated_at: nowIso,
    };

    // Validate and apply location data with coordinate bounds checking
    if (body.online && body.location) {
      if (isValidLatitude(body.location.lat) && isValidLongitude(body.location.lng)) {
        update.current_lat = body.location.lat;
        update.current_lng = body.location.lng;
        const sanitizedAddress = sanitizeAddress(body.location.address);
        if (sanitizedAddress) {
          update.current_address = sanitizedAddress;
        }
      } else {
        logStep("Invalid coordinates rejected", { 
          lat: body.location.lat, 
          lng: body.location.lng 
        });
      }
    }

    const { error: updateErr } = await supabaseClient
      .from("provider_data")
      .update(update)
      .eq("user_id", user.id);

    if (updateErr) {
      logStep("ERROR updating provider_data", { message: updateErr.message });
      throw updateErr;
    }

    logStep("Status changed", {
      userId: user.id,
      newStatus: body.online ? "ONLINE" : "OFFLINE",
      ts: nowIso,
    });

    return new Response(JSON.stringify({ ok: true, online: body.online, ts: nowIso }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR", { message: errorMessage, stack: errorStack });
    // Return generic message to client, keep details in server logs
    return new Response(JSON.stringify({ error: "Erro ao atualizar status. Tente novamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
