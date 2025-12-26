import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ONLINE-PROVIDERS] ${step}${detailsStr}`);
};

const HEARTBEAT_TIMEOUT_MS = 15_000;

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

    const now = Date.now();
    const thresholdIso = new Date(now - HEARTBEAT_TIMEOUT_MS).toISOString();

    // 1) Cleanup: mark stale online providers as offline (prevents ghost online across sessions)
    const { data: staleProviders, error: staleErr } = await supabaseClient
      .from("provider_data")
      .select("user_id, updated_at")
      .eq("is_online", true)
      .lt("updated_at", thresholdIso)
      .limit(500);

    if (staleErr) {
      logStep("WARN stale select failed", { message: staleErr.message });
    }

    if (staleProviders && staleProviders.length > 0) {
      const staleIds = staleProviders.map((p) => p.user_id);
      logStep("Stale providers detected", { count: staleIds.length, thresholdIso });

      const { data: updatedRows, error: offlineErr } = await supabaseClient
        .from("provider_data")
        .update({ is_online: false })
        .in("user_id", staleIds)
        .select("user_id");

      if (offlineErr) {
        logStep("ERROR marking providers OFFLINE", { message: offlineErr.message });
      } else {
        logStep("Providers marked OFFLINE automatically", { count: updatedRows?.length || 0 });
      }
    }

    // 2) Fetch active online providers from the central backend (single source of truth)
    const { data, error } = await supabaseClient
      .from("provider_data")
      .select(
        `
        user_id,
        current_lat,
        current_lng,
        current_address,
        rating,
        total_services,
        services_offered,
        radar_range,
        is_online,
        updated_at,
        profiles!inner(name, avatar_url, perfil_principal)
      `,
      )
      .eq("is_online", true)
      .gte("updated_at", thresholdIso)
      .not("current_lat", "is", null)
      .not("current_lng", "is", null);

    if (error) {
      logStep("ERROR fetching providers", { message: error.message });
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const providers = (data || []).filter((p: any) => p.profiles?.perfil_principal === "provider");

    logStep("Providers returned", {
      requester: user.id,
      count: providers.length,
      thresholdIso,
    });

    return new Response(JSON.stringify({ providers, thresholdIso }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
