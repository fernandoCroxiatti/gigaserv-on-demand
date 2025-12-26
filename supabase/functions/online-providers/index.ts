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

    // 2) Fetch active online providers from provider_data (single source of truth)
    const { data: providerData, error: providerError } = await supabaseClient
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
        updated_at
      `,
      )
      .eq("is_online", true)
      .gte("updated_at", thresholdIso)
      .not("current_lat", "is", null)
      .not("current_lng", "is", null);

    if (providerError) {
      logStep("ERROR fetching providers", { message: providerError.message });
      return new Response(JSON.stringify({ error: providerError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!providerData || providerData.length === 0) {
      logStep("No online providers found", { thresholdIso });
      return new Response(JSON.stringify({ providers: [], thresholdIso }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3) Fetch profiles for online providers (separate query to avoid join issues)
    const userIds = providerData.map((p) => p.user_id);
    const { data: profilesData, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("user_id, name, avatar_url, perfil_principal")
      .in("user_id", userIds);

    if (profilesError) {
      logStep("WARN fetching profiles", { message: profilesError.message });
    }

    // Create a map for fast lookup
    const profilesMap = new Map(
      (profilesData || []).map((p) => [p.user_id, p])
    );

    // 4) Combine data and filter only providers
    const providers = providerData
      .map((p) => {
        const profile = profilesMap.get(p.user_id);
        return {
          ...p,
          profiles: profile || null,
        };
      })
      .filter((p) => p.profiles?.perfil_principal === "provider");

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
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR", { message: errorMessage, stack: errorStack });
    // Return generic message to client, keep details in server logs
    return new Response(JSON.stringify({ error: "Erro ao buscar prestadores. Tente novamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
