import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { calculateProviderFee } from "../_shared/feeCalculator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// UUID v4 format validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

interface RecordFeeRequest {
  chamado_id: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RECORD-SERVICE-FEE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { chamado_id }: RecordFeeRequest = await req.json();

    // Validate chamado_id is present
    if (!chamado_id) {
      return new Response(
        JSON.stringify({ error: "chamado_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate chamado_id format (UUID)
    if (!isValidUUID(chamado_id)) {
      logStep("Invalid chamado_id format", { chamado_id });
      return new Response(
        JSON.stringify({ error: "Formato de chamado_id inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Processing chamado", { chamado_id });

    // Get chamado details
    const { data: chamado, error: chamadoError } = await supabaseAdmin
      .from("chamados")
      .select("*")
      .eq("id", chamado_id)
      .single();

    if (chamadoError || !chamado) {
      logStep("Chamado not found", { error: chamadoError });
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
      logStep("Fee already recorded", { chamado_id, fee_id: existingFee.id });
      return new Response(
        JSON.stringify({ message: "Fee already recorded", fee_id: existingFee.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const providerId = chamado.prestador_id;
    const serviceValue = Number(chamado.valor) || 0;
    
    if (!providerId || serviceValue <= 0) {
      logStep("Invalid chamado data", { providerId, serviceValue });
      return new Response(
        JSON.stringify({ error: "Invalid chamado: missing provider or value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Calculating fee for provider", { providerId, serviceValue });

    // =================================================================
    // USE CENTRALIZED FEE CALCULATOR - ISOLATED BY PROVIDER_ID
    // This ensures each provider gets their own correct fee rate
    // =================================================================
    const feeCalculation = await calculateProviderFee(
      supabaseAdmin,
      providerId,
      serviceValue
    );

    const feePercentage = feeCalculation.feePercentage;
    const feeAmount = feeCalculation.applicationFeeAmountCentavos / 100; // Convert to BRL
    const providerNetAmount = feeCalculation.providerReceivesCentavos / 100; // Convert to BRL

    logStep("Fee calculated", {
      providerId,
      serviceValue,
      feePercentage,
      feeAmount,
      providerNetAmount,
      feeSource: feeCalculation.feeSource,
    });

    // INVARIANT CHECKS (required for compliance)
    if (feeAmount < 0 || providerNetAmount < 0) {
      logStep("Invariant violation: negative values", { feeAmount, providerNetAmount });
      return new Response(
        JSON.stringify({ error: "Cálculo inválido: valores negativos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check sum invariant with tolerance
    const sum = Math.round((feeAmount + providerNetAmount) * 100) / 100;
    if (Math.abs(sum - serviceValue) > 0.01) {
      logStep("Invariant violation: sum mismatch", { sum, serviceValue });
      return new Response(
        JSON.stringify({ error: "Erro de arredondamento no cálculo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine fee type based on payment method
    const isStripePayment = chamado.payment_provider === "stripe" && 
                           (chamado.payment_status === "paid_stripe" || 
                            chamado.payment_method === "card");
    const isDirectPayment = chamado.direct_payment_to_provider === true;

    const feeType = isStripePayment && !isDirectPayment ? "STRIPE" : "MANUAL_PIX";

    // Create fee record with complete audit data
    const feeData = {
      chamado_id: chamado_id,
      provider_id: providerId,
      service_value: serviceValue,
      fee_percentage: feePercentage,
      fee_amount: feeAmount,
      fee_type: feeType,
      status: feeType === "STRIPE" ? "PAGO" : "DEVENDO",
    };

    logStep("Creating fee record", feeData);

    const { data: newFee, error: feeError } = await supabaseAdmin
      .from("provider_fees")
      .insert(feeData)
      .select()
      .single();

    if (feeError) {
      logStep("Error creating fee", { error: feeError });
      return new Response(
        JSON.stringify({ error: "Failed to create fee record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If MANUAL_PIX, update provider's pending balance and check warning threshold
    if (feeType === "MANUAL_PIX") {
      const { data: providerData } = await supabaseAdmin
        .from("provider_data")
        .select("pending_fee_balance, financial_status, max_debt_limit, pending_fee_warning_sent_at")
        .eq("user_id", providerId)
        .single();

      const currentBalance = Number(providerData?.pending_fee_balance) || 0;
      const newBalance = currentBalance + feeAmount;
      const maxLimit = Number(providerData?.max_debt_limit) || 400;
      const percentUsed = (newBalance / maxLimit) * 100;

      await supabaseAdmin
        .from("provider_data")
        .update({
          pending_fee_balance: newBalance,
          financial_status: "DEVENDO",
        })
        .eq("user_id", providerId);

      logStep("Updated provider balance", { 
        providerId, 
        newBalance, 
        percentUsed: `${percentUsed.toFixed(1)}%` 
      });

      // Check if should send 70% warning notification
      if (percentUsed >= 70 && percentUsed < 100) {
        const lastWarning = providerData?.pending_fee_warning_sent_at;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        // Only send if not warned in last 24 hours
        if (!lastWarning || lastWarning < oneDayAgo) {
          logStep("Sending 70% warning notification", { providerId, percentUsed });
          
          try {
            // Send push notification
            await supabaseAdmin.functions.invoke('send-notifications', {
              body: {
                action: 'event',
                userId: providerId,
                notificationType: 'pending_fee_warning',
                title: '⚠️ Atenção: Limite de Pendência',
                messageBody: `Você atingiu ${percentUsed.toFixed(0)}% do seu limite. Saldo pendente: R$ ${newBalance.toFixed(2)}. Regularize para continuar atendendo.`,
                data: {
                  type: 'pending_fee_warning',
                  pendingBalance: newBalance,
                  maxLimit: maxLimit,
                  percentUsed: percentUsed
                }
              }
            });
            
            // Update warning sent timestamp
            await supabaseAdmin
              .from("provider_data")
              .update({ pending_fee_warning_sent_at: new Date().toISOString() })
              .eq("user_id", providerId);
              
            logStep("Warning notification sent", { providerId });
          } catch (notifError) {
            logStep("Failed to send warning notification", { error: notifError });
          }
        }
      }
    }

    // Update chamado with commission info (using provider-specific rate)
    await supabaseAdmin
      .from("chamados")
      .update({
        commission_percentage: feePercentage,
        commission_amount: feeAmount,
        provider_amount: serviceValue - feeAmount,
      })
      .eq("id", chamado_id);

    logStep("Fee recorded successfully", {
      chamado_id,
      feeType,
      feeAmount,
      feePercentage,
      feeSource: feeCalculation.feeSource,
    });

    return new Response(
      JSON.stringify({
        success: true,
        fee: newFee,
        fee_type: feeType,
        fee_amount: feeAmount,
        fee_percentage: feePercentage,
        fee_source: feeCalculation.feeSource,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR", { message: errorMessage, stack: errorStack });
    return new Response(
      JSON.stringify({ error: "Erro ao registrar taxa. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
