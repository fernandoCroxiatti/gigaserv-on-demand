import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuspiciousPatternAlert {
  patternId: string;
  patternType: string;
  clientId: string;
  providerId: string;
  chamadoId?: string;
  severity: string;
  detectionReason: string;
  details?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const alertData: SuspiciousPatternAlert = await req.json();

    console.log("[notify-admin-suspicious] Received alert:", JSON.stringify(alertData, null, 2));

    // Validate required fields
    if (!alertData.patternId || !alertData.severity) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patternId and severity" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only process high severity alerts
    if (alertData.severity !== "high") {
      console.log("[notify-admin-suspicious] Skipping non-high severity alert:", alertData.severity);
      return new Response(
        JSON.stringify({ message: "Only high severity alerts trigger notifications" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all admins
    const { data: adminRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      console.error("[notify-admin-suspicious] Error fetching admins:", rolesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch admins" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("[notify-admin-suspicious] No admins found to notify");
      return new Response(
        JSON.stringify({ message: "No admins to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client and provider names for the alert
    let clientName = "Desconhecido";
    let providerName = "Desconhecido";

    if (alertData.clientId) {
      const { data: clientProfile } = await supabaseAdmin
        .from("profiles")
        .select("name")
        .eq("user_id", alertData.clientId)
        .single();
      if (clientProfile) clientName = clientProfile.name;
    }

    if (alertData.providerId) {
      const { data: providerProfile } = await supabaseAdmin
        .from("profiles")
        .select("name")
        .eq("user_id", alertData.providerId)
        .single();
      if (providerProfile) providerName = providerProfile.name;
    }

    // Build notification content
    const title = "⚠️ Padrão Suspeito de Alta Severidade";
    const body = `Cliente: ${clientName}\nPrestador: ${providerName}\nMotivo: ${alertData.detectionReason || alertData.patternType}\nAção sugerida: Revisão manual`;

    let notifiedCount = 0;

    // Send notification to each admin
    for (const admin of adminRoles) {
      try {
        await supabaseAdmin.functions.invoke("send-notifications", {
          body: {
            action: "event",
            userId: admin.user_id,
            notificationType: "admin_suspicious_pattern",
            title,
            messageBody: body,
            data: {
              patternId: alertData.patternId,
              patternType: alertData.patternType,
              clientId: alertData.clientId,
              clientName,
              providerId: alertData.providerId,
              providerName,
              chamadoId: alertData.chamadoId,
              severity: alertData.severity,
              detectionReason: alertData.detectionReason,
              type: "suspicious_pattern_high_severity",
              url: "/admin/suspicious",
            },
          },
        });
        notifiedCount++;
        console.log(`[notify-admin-suspicious] Notified admin ${admin.user_id}`);
      } catch (err) {
        console.error(`[notify-admin-suspicious] Error notifying admin ${admin.user_id}:`, err);
      }
    }

    console.log(`[notify-admin-suspicious] Notified ${notifiedCount} of ${adminRoles.length} admins`);

    return new Response(
      JSON.stringify({
        success: true,
        notifiedAdmins: notifiedCount,
        alertDetails: {
          patternId: alertData.patternId,
          clientName,
          providerName,
          severity: alertData.severity,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[notify-admin-suspicious] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Erro ao notificar administrador." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
