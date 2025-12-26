import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHAMADO] ${step}${detailsStr}`);
};

type CreateChamadoBody = {
  tipo_servico: string;
  origem_lat: number;
  origem_lng: number;
  origem_address: string;
  destino_lat?: number | null;
  destino_lng?: number | null;
  destino_address?: string | null;
  vehicle_type?: string | null;
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

    const body = (await req.json()) as CreateChamadoBody;

    logStep("Creating chamado", {
      clienteId: user.id,
      tipoServico: body.tipo_servico,
      origemLat: body.origem_lat,
      origemLng: body.origem_lng,
    });

    // Insert chamado
    const insertData: Record<string, unknown> = {
      cliente_id: user.id,
      tipo_servico: body.tipo_servico,
      status: "searching",
      origem_lat: body.origem_lat,
      origem_lng: body.origem_lng,
      origem_address: body.origem_address,
      destino_lat: body.destino_lat ?? null,
      destino_lng: body.destino_lng ?? null,
      destino_address: body.destino_address ?? null,
    };

    if (body.vehicle_type) {
      insertData.vehicle_type = body.vehicle_type;
    }

    const { data: chamado, error: insertErr } = await supabaseClient
      .from("chamados")
      .insert(insertData)
      .select()
      .single();

    if (insertErr) {
      logStep("ERROR inserting chamado", { message: insertErr.message });
      throw insertErr;
    }

    logStep("Chamado created", { chamadoId: chamado.id });

    // ===== BROADCAST GLOBAL: find online providers and log =====
    const HEARTBEAT_TIMEOUT_MS = 15_000;
    const thresholdIso = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS).toISOString();

    const { data: onlineProviders, error: provErr } = await supabaseClient
      .from("provider_data")
      .select("user_id, current_lat, current_lng, radar_range, services_offered")
      .eq("is_online", true)
      .gte("updated_at", thresholdIso)
      .not("current_lat", "is", null)
      .not("current_lng", "is", null);

    if (provErr) {
      logStep("WARN fetching online providers", { message: provErr.message });
    }

    // Simple Haversine distance check
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

    const eligibleProviders: string[] = [];

    for (const prov of onlineProviders || []) {
      const services = (prov.services_offered as string[]) || [];
      if (!services.includes(body.tipo_servico)) continue;

      const dist = haversineKm(
        body.origem_lat,
        body.origem_lng,
        Number(prov.current_lat),
        Number(prov.current_lng),
      );
      const range = prov.radar_range || 15;
      if (dist <= range) {
        eligibleProviders.push(prov.user_id);
      }
    }

    logStep("BROADCAST nova corrida", {
      chamadoId: chamado.id,
      tipoServico: body.tipo_servico,
      eligibleProvidersCount: eligibleProviders.length,
      eligibleProviderIds: eligibleProviders.map((id) => id.substring(0, 8)),
    });

    return new Response(JSON.stringify({ chamado, eligibleProvidersCount: eligibleProviders.length }), {
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
