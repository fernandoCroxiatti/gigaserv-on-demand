import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecordFeeRequest {
  chamado_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { chamado_id }: RecordFeeRequest = await req.json();

    if (!chamado_id) {
      return new Response(
        JSON.stringify({ error: "chamado_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get chamado details
    const { data: chamado, error: chamadoError } = await supabaseAdmin
      .from("chamados")
      .select("*")
      .eq("id", chamado_id)
      .single();

    if (chamadoError || !chamado) {
      console.error("Error fetching chamado:", chamadoError);
      return new Response(
        JSON.stringify({ error: "Chamado not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if fee already exists for this chamado
    const { data: existingFee } = await supabaseAdmin
      .from("provider_fees")
      .select("id")
      .eq("chamado_id", chamado_id)
      .single();

    if (existingFee) {
      console.log("Fee already recorded for chamado:", chamado_id);
      return new Response(
        JSON.stringify({ message: "Fee already recorded", fee_id: existingFee.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const providerId = chamado.prestador_id;
    const serviceValue = Number(chamado.valor) || 0;
    
    if (!providerId || serviceValue <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid chamado: missing provider or value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get commission percentage from app_settings
    const { data: commissionSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "commission_percentage")
      .single();

    const commissionPercentage = commissionSetting?.value 
      ? Number(commissionSetting.value) 
      : 15; // Default 15%

    const feeAmount = (serviceValue * commissionPercentage) / 100;

    // Determine fee type based on payment method
    const isStripePayment = chamado.payment_provider === "stripe" && 
                           (chamado.payment_status === "paid_stripe" || 
                            chamado.payment_method === "card");
    const isDirectPayment = chamado.direct_payment_to_provider === true;

    const feeType = isStripePayment && !isDirectPayment ? "STRIPE" : "MANUAL_PIX";

    // Create fee record
    const feeData = {
      chamado_id: chamado_id,
      provider_id: providerId,
      service_value: serviceValue,
      fee_percentage: commissionPercentage,
      fee_amount: feeAmount,
      fee_type: feeType,
      status: feeType === "STRIPE" ? "PAGO" : "DEVENDO", // Stripe fees are automatically paid
    };

    const { data: newFee, error: feeError } = await supabaseAdmin
      .from("provider_fees")
      .insert(feeData)
      .select()
      .single();

    if (feeError) {
      console.error("Error creating fee:", feeError);
      return new Response(
        JSON.stringify({ error: "Failed to create fee record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If MANUAL_PIX, update provider's pending balance
    if (feeType === "MANUAL_PIX") {
      const { data: providerData } = await supabaseAdmin
        .from("provider_data")
        .select("pending_fee_balance, financial_status")
        .eq("user_id", providerId)
        .single();

      const currentBalance = Number(providerData?.pending_fee_balance) || 0;
      const newBalance = currentBalance + feeAmount;

      await supabaseAdmin
        .from("provider_data")
        .update({
          pending_fee_balance: newBalance,
          financial_status: "DEVENDO",
        })
        .eq("user_id", providerId);

      console.log(`Updated provider ${providerId} pending balance: ${newBalance}`);
    }

    // Update chamado with commission info
    await supabaseAdmin
      .from("chamados")
      .update({
        commission_percentage: commissionPercentage,
        commission_amount: feeAmount,
        provider_amount: serviceValue - feeAmount,
      })
      .eq("id", chamado_id);

    console.log(`Fee recorded for chamado ${chamado_id}: type=${feeType}, amount=${feeAmount}`);

    return new Response(
      JSON.stringify({
        success: true,
        fee: newFee,
        fee_type: feeType,
        fee_amount: feeAmount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in record-service-fee:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
