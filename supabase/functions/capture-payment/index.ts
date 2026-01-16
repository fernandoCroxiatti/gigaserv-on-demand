/**
 * CAPTURE-PAYMENT Edge Function
 * 
 * Captures an authorized card payment when the service is finished.
 * This is part of the card payment hold/capture flow:
 * 1. Authorization (hold) happens when client selects card payment
 * 2. Capture happens when service is finished (this function)
 * 3. If cancelled, authorization is released (cancel-payment-authorization function)
 * 
 * IMPORTANT: This function ONLY handles CARD payments via Stripe.
 * Direct payments (PIX, cash) are NOT processed by Stripe.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CAPTURE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Parse request body
    const { chamado_id } = await req.json();
    if (!chamado_id) throw new Error("chamado_id is required");
    logStep("Processing capture", { chamadoId: chamado_id });

    // Get chamado details
    const { data: chamado, error: chamadoError } = await supabaseClient
      .from('chamados')
      .select('*')
      .eq('id', chamado_id)
      .single();

    if (chamadoError || !chamado) {
      throw new Error("Chamado not found");
    }

    // CRITICAL: Only process card payments via Stripe
    // Direct payments (PIX direto, cash) should NOT go through Stripe
    if (chamado.direct_payment_to_provider === true) {
      logStep("Skipping capture - direct payment to provider", { chamadoId: chamado_id });
      return new Response(JSON.stringify({
        success: true,
        message: "Pagamento direto ao prestador - nenhuma captura Stripe necessária",
        is_direct_payment: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if payment method is card
    if (chamado.payment_method !== 'card' && chamado.payment_method !== 'saved_card') {
      logStep("Skipping capture - not a card payment", { 
        paymentMethod: chamado.payment_method,
        chamadoId: chamado_id 
      });
      return new Response(JSON.stringify({
        success: true,
        message: "Pagamento não é por cartão - nenhuma captura Stripe necessária",
        payment_method: chamado.payment_method,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if there's a payment intent to capture
    if (!chamado.stripe_payment_intent_id) {
      throw new Error("Nenhum PaymentIntent encontrado para captura");
    }

    // Check if already captured
    if (chamado.payment_status === 'paid_stripe' && chamado.payment_captured_at) {
      logStep("Payment already captured", { chamadoId: chamado_id });
      return new Response(JSON.stringify({
        success: true,
        message: "Pagamento já foi capturado anteriormente",
        already_captured: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(chamado.stripe_payment_intent_id);
    logStep("PaymentIntent retrieved", { 
      id: paymentIntent.id, 
      status: paymentIntent.status,
      captureMethod: paymentIntent.capture_method,
    });

    // Check if it's in a capturable state
    if (paymentIntent.status === 'succeeded') {
      // Already captured (automatic capture or already manually captured)
      logStep("Payment already succeeded/captured", { paymentIntentId: paymentIntent.id });
      
      // Update database to ensure consistency
      await supabaseClient
        .from('chamados')
        .update({
          payment_status: 'paid_stripe',
          payment_captured_at: new Date().toISOString(),
          payment_completed_at: new Date().toISOString(),
        })
        .eq('id', chamado_id);

      return new Response(JSON.stringify({
        success: true,
        message: "Pagamento já foi capturado",
        payment_intent_id: paymentIntent.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (paymentIntent.status !== 'requires_capture') {
      throw new Error(`PaymentIntent não está em estado capturável. Status atual: ${paymentIntent.status}`);
    }

    // Capture the payment
    logStep("Capturing payment", { paymentIntentId: paymentIntent.id, amount: paymentIntent.amount });
    
    const capturedPaymentIntent = await stripe.paymentIntents.capture(paymentIntent.id);
    
    logStep("Payment captured successfully", { 
      paymentIntentId: capturedPaymentIntent.id, 
      status: capturedPaymentIntent.status,
      amountCaptured: capturedPaymentIntent.amount,
    });

    // Update chamado with captured payment info
    const { error: updateError } = await supabaseClient
      .from('chamados')
      .update({
        payment_status: 'paid_stripe',
        payment_captured_at: new Date().toISOString(),
        payment_completed_at: new Date().toISOString(),
      })
      .eq('id', chamado_id);

    if (updateError) {
      logStep("Error updating chamado after capture", { error: updateError.message });
      // Don't throw - payment was captured successfully
    }

    return new Response(JSON.stringify({
      success: true,
      payment_intent_id: capturedPaymentIntent.id,
      amount_captured: capturedPaymentIntent.amount,
      status: capturedPaymentIntent.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR", { message: errorMessage, stack: errorStack });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
