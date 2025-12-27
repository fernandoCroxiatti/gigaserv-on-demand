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

// Input validation constants
const MAX_ADDRESS_LENGTH = 500;
const VALID_SERVICE_TYPES = ['guincho', 'borracharia', 'mecanica', 'chaveiro'];
const VALID_VEHICLE_TYPES = [
  'carro_passeio', 'carro_utilitario', 'pickup', 'van', 'moto',
  'caminhao_toco', 'caminhao_34', 'truck', 'carreta', 'cavalinho',
  'onibus', 'micro_onibus', 'outro'
];

// Validate coordinate bounds
function isValidLatitude(lat: unknown): lat is number {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
}

function isValidLongitude(lng: unknown): lng is number {
  return typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
}

// Sanitize and truncate string
function sanitizeString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  // Remove potentially dangerous characters and truncate
  return value.replace(/[<>]/g, '').substring(0, maxLength).trim();
}

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

    // Validate required fields
    if (!body.tipo_servico || !VALID_SERVICE_TYPES.includes(body.tipo_servico)) {
      logStep("Invalid service type", { received: body.tipo_servico });
      return new Response(JSON.stringify({ error: "Tipo de serviço inválido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate coordinates
    if (!isValidLatitude(body.origem_lat) || !isValidLongitude(body.origem_lng)) {
      logStep("Invalid origin coordinates", { lat: body.origem_lat, lng: body.origem_lng });
      return new Response(JSON.stringify({ error: "Coordenadas de origem inválidas" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate destination coordinates if provided
    if (body.destino_lat !== null && body.destino_lat !== undefined) {
      if (!isValidLatitude(body.destino_lat)) {
        logStep("Invalid destination latitude", { lat: body.destino_lat });
        return new Response(JSON.stringify({ error: "Latitude de destino inválida" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }
    if (body.destino_lng !== null && body.destino_lng !== undefined) {
      if (!isValidLongitude(body.destino_lng)) {
        logStep("Invalid destination longitude", { lng: body.destino_lng });
        return new Response(JSON.stringify({ error: "Longitude de destino inválida" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    // Validate vehicle type if provided
    if (body.vehicle_type && !VALID_VEHICLE_TYPES.includes(body.vehicle_type)) {
      logStep("Invalid vehicle type", { received: body.vehicle_type });
      return new Response(JSON.stringify({ error: "Tipo de veículo inválido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Sanitize addresses
    const origemAddress = sanitizeString(body.origem_address, MAX_ADDRESS_LENGTH) || "";
    const destinoAddress = sanitizeString(body.destino_address, MAX_ADDRESS_LENGTH);

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
      origem_address: origemAddress,
      destino_lat: body.destino_lat ?? null,
      destino_lng: body.destino_lng ?? null,
      destino_address: destinoAddress,
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

    // ===== SEND ONESIGNAL PUSH NOTIFICATIONS TO ELIGIBLE PROVIDERS =====
    const serviceLabels: Record<string, string> = {
      guincho: 'Guincho',
      borracharia: 'Borracharia',
      mecanica: 'Mecânica',
      chaveiro: 'Chaveiro',
    };
    const serviceLabel = serviceLabels[body.tipo_servico] || body.tipo_servico;

    // Send push notification to each eligible provider via OneSignal
    const notificationPromises = eligibleProviders.map(async (providerId) => {
      try {
        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/onesignal-push`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              action: "chamada",
              user_id: providerId,
              chamado_id: chamado.id,
              title: `Nova Chamada de ${serviceLabel}!`,
              body: origemAddress || "Cliente aguardando atendimento",
              data: {
                chamadoId: chamado.id,
                tipoServico: body.tipo_servico,
                origemLat: body.origem_lat,
                origemLng: body.origem_lng,
              },
            }),
          }
        );
        
        if (!response.ok) {
          const errText = await response.text();
          logStep("WARN: OneSignal push failed for provider", { providerId: providerId.substring(0, 8), error: errText });
        } else {
          logStep("OneSignal push sent", { providerId: providerId.substring(0, 8) });
        }
      } catch (err) {
        logStep("WARN: OneSignal push error", { providerId: providerId.substring(0, 8), error: String(err) });
      }
    });

    // Fire and forget - don't block response
    Promise.all(notificationPromises).catch((err) => {
      logStep("WARN: Some notifications failed", { error: String(err) });
    });

    return new Response(JSON.stringify({ chamado, eligibleProvidersCount: eligibleProviders.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR", { message: errorMessage, stack: errorStack });
    // Return generic message to client, keep details in server logs
    return new Response(JSON.stringify({ error: "Erro ao criar chamado. Tente novamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
