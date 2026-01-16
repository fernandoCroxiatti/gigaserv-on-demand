/**
 * CANCEL-PAYMENT-AUTHORIZATION Edge Function
 * 
 * Cancels an authorized (held) card payment when the service is cancelled.
 * This releases the funds back to the customer's card.
 * 
 * This is part of the card payment hold/capture flow:
 * 1. Authorization (hold) happens when client selects card payment
 * 2. If cancelled before completion, authorization is released (this function)
 * 3. If service completes, payment is captured (capture-payment function)
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
  console.log(`[CANCEL-PAYMENT-AUTH] ${step}${detailsStr}`);
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
    const { chamado_id, reason } = await req.json();
    if (!chamado_id) throw new Error("chamado_id is required");
    logStep("Processing cancellation", { chamadoId: chamado_id, reason });

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
      logStep("Skipping cancellation - direct payment to provider", { chamadoId: chamado_id });
      return new Response(JSON.stringify({
        success: true,
        message: "Pagamento direto ao prestador - nenhum cancelamento Stripe necessário",
        is_direct_payment: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if payment method is card
    if (chamado.payment_method !== 'card' && chamado.payment_method !== 'saved_card') {
      logStep("Skipping cancellation - not a card payment", { 
        paymentMethod: chamado.payment_method,
        chamadoId: chamado_id 
      });
      return new Response(JSON.stringify({
        success: true,
        message: "Pagamento não é por cartão - nenhum cancelamento Stripe necessário",
        payment_method: chamado.payment_method,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if there's a payment intent to cancel
    if (!chamado.stripe_payment_intent_id) {
      logStep("No payment intent to cancel", { chamadoId: chamado_id });
      return new Response(JSON.stringify({
        success: true,
        message: "Nenhum pagamento para cancelar",
        no_payment: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if already cancelled or refunded
    if (chamado.payment_canceled_at || chamado.payment_status === 'refunded') {
      logStep("Payment already cancelled/refunded", { chamadoId: chamado_id });
      return new Response(JSON.stringify({
        success: true,
        message: "Pagamento já foi cancelado/estornado anteriormente",
        already_cancelled: true,
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

    let finalStatus = 'canceled';
    let message = '';

    // Handle based on payment intent status
    switch (paymentIntent.status) {
      case 'requires_capture':
        // Authorization is in place - cancel to release the hold
        logStep("Canceling authorization (releasing hold)", { paymentIntentId: paymentIntent.id });
        await stripe.paymentIntents.cancel(paymentIntent.id, {
          cancellation_reason: 'requested_by_customer',
        });
        message = "Autorização cancelada - valor liberado para o cliente";
        finalStatus = 'canceled';
        break;

      case 'succeeded':
        // Payment was already captured - need to refund
        logStep("Payment was captured - creating refund", { paymentIntentId: paymentIntent.id });
        await stripe.refunds.create({
          payment_intent: paymentIntent.id,
          reason: 'requested_by_customer',
        });
        message = "Pagamento estornado ao cliente";
        finalStatus = 'refunded';
        break;

      case 'canceled':
        // Already cancelled
        logStep("Payment already cancelled in Stripe", { paymentIntentId: paymentIntent.id });
        message = "Pagamento já estava cancelado";
        finalStatus = 'canceled';
        break;

      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        // Payment not completed - just cancel
        logStep("Canceling incomplete payment", { paymentIntentId: paymentIntent.id, status: paymentIntent.status });
        await stripe.paymentIntents.cancel(paymentIntent.id);
        message = "Pagamento incompleto cancelado";
        finalStatus = 'canceled';
        break;

      default:
        logStep("Unexpected payment status", { status: paymentIntent.status });
        throw new Error(`Status de pagamento inesperado: ${paymentIntent.status}`);
    }

    logStep("Payment cancellation processed", { 
      paymentIntentId: paymentIntent.id, 
      finalStatus,
      message,
    });

    // Update chamado with cancelled payment info
    const { error: updateError } = await supabaseClient
      .from('chamados')
      .update({
        payment_status: finalStatus,
        payment_canceled_at: new Date().toISOString(),
      })
      .eq('id', chamado_id);

    if (updateError) {
      logStep("Error updating chamado after cancellation", { error: updateError.message });
      // Don't throw - cancellation was processed successfully
    }

    return new Response(JSON.stringify({
      success: true,
      payment_intent_id: paymentIntent.id,
      status: finalStatus,
      message,
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
