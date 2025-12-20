import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-PAYMENT-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Parse request body
    const { chamado_id } = await req.json();
    if (!chamado_id) throw new Error("chamado_id is required");
    logStep("Checking payment status", { chamadoId: chamado_id });

    // Get chamado details - only for the authenticated user
    const { data: chamado, error: chamadoError } = await supabaseClient
      .from('chamados')
      .select('id, status, payment_status, payment_method, payment_completed_at, valor')
      .eq('id', chamado_id)
      .eq('cliente_id', user.id)
      .single();

    if (chamadoError || !chamado) {
      throw new Error("Chamado not found or not authorized");
    }

    logStep("Chamado found", { 
      status: chamado.status,
      paymentStatus: chamado.payment_status,
      paymentMethod: chamado.payment_method,
    });

    // Determine if payment is confirmed
    const isPaid = chamado.payment_status === 'paid_stripe' || chamado.payment_status === 'paid_mock';
    const isInService = chamado.status === 'in_service';

    return new Response(JSON.stringify({
      chamado_id: chamado.id,
      status: chamado.status,
      payment_status: chamado.payment_status,
      payment_method: chamado.payment_method,
      payment_completed_at: chamado.payment_completed_at,
      valor: chamado.valor,
      is_paid: isPaid,
      is_confirmed: isPaid && isInService,
    }), {
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
