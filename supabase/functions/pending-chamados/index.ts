import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PENDING-CHAMADOS] ${step}${detailsStr}`);
};

// Haversine distance in km
const toRad = (deg: number) => (deg * Math.PI) / 180;
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate provider
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

    const providerId = user.id;

    // Get provider data
    const { data: providerData, error: providerError } = await supabaseClient
      .from("provider_data")
      .select("*")
      .eq("user_id", providerId)
      .single();

    if (providerError || !providerData) {
      logStep("Provider not found", { providerId });
      return new Response(JSON.stringify({ error: "Provider not found", chamados: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if provider is online
    if (!providerData.is_online) {
      logStep("Provider is offline", { providerId });
      return new Response(JSON.stringify({ chamados: [], reason: "offline" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if provider can accept (not blocked)
    if (providerData.permanently_blocked || providerData.fraud_flagged || providerData.financial_blocked) {
      logStep("Provider is blocked", { providerId, reason: "blocked" });
      return new Response(JSON.stringify({ chamados: [], reason: "blocked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const services = (providerData.services_offered as string[]) || ["guincho"];
    const radarRange = providerData.radar_range || 15;
    const providerLat = providerData.current_lat ? Number(providerData.current_lat) : null;
    const providerLng = providerData.current_lng ? Number(providerData.current_lng) : null;

    if (providerLat === null || providerLng === null) {
      logStep("Provider has no location", { providerId });
      return new Response(JSON.stringify({ chamados: [], reason: "no_location" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get all searching chamados from the queue
    const { data: searchingChamados, error: chamadoError } = await supabaseClient
      .from("chamados")
      .select("*")
      .eq("status", "searching")
      .is("prestador_id", null)
      .neq("cliente_id", providerId) // Don't show own chamados
      .order("created_at", { ascending: true }); // FIFO - oldest first

    if (chamadoError) {
      logStep("Error fetching chamados", { error: chamadoError.message });
      throw chamadoError;
    }

    logStep("Found searching chamados in queue", { 
      total: searchingChamados?.length || 0,
      providerId: providerId.substring(0, 8)
    });

    // Filter chamados eligible for this provider
    const eligibleChamados = [];
    for (const chamado of searchingChamados || []) {
      // Skip if provider already declined
      const declinedIds = chamado.declined_provider_ids || [];
      if (declinedIds.includes(providerId)) {
        continue;
      }

      // Check if provider offers this service
      if (!services.includes(chamado.tipo_servico)) {
        continue;
      }

      // Check if within radar range
      const distance = haversineKm(
        providerLat,
        providerLng,
        Number(chamado.origem_lat),
        Number(chamado.origem_lng)
      );

      if (distance <= radarRange) {
        eligibleChamados.push({
          ...chamado,
          distance_km: Math.round(distance * 10) / 10,
        });
      }
    }

    logStep("Eligible chamados for provider", {
      providerId: providerId.substring(0, 8),
      eligibleCount: eligibleChamados.length,
      chamadoIds: eligibleChamados.map(c => c.id.substring(0, 8)),
    });

    // Return the first eligible chamado (FIFO)
    // Provider will show one at a time
    return new Response(JSON.stringify({ 
      chamados: eligibleChamados,
      firstChamado: eligibleChamados.length > 0 ? eligibleChamados[0] : null,
      queueSize: eligibleChamados.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR", { message: errorMessage, stack: errorStack });
    // Return generic message to client, keep details in server logs
    return new Response(JSON.stringify({ error: "Erro ao buscar chamados. Tente novamente.", chamados: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
