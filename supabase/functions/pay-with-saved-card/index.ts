import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PAY-WITH-SAVED-CARD] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const { chamado_id, payment_method_id } = await req.json();
    if (!chamado_id) throw new Error("chamado_id is required");
    if (!payment_method_id) throw new Error("payment_method_id is required");
    logStep("Processing payment", { chamadoId: chamado_id, paymentMethodId: payment_method_id });

    // Get chamado details
    const { data: chamado, error: chamadoError } = await supabaseClient
      .from('chamados')
      .select('*')
      .eq('id', chamado_id)
      .eq('cliente_id', user.id)
      .single();

    if (chamadoError || !chamado) {
      throw new Error("Chamado not found or not authorized");
    }

    if (chamado.payment_status === 'paid_stripe' || chamado.payment_status === 'paid_mock') {
      throw new Error("Payment already completed");
    }

    if (!chamado.valor || chamado.valor <= 0) {
      throw new Error("Chamado has no valid price");
    }

    if (!chamado.prestador_id) {
      throw new Error("Chamado has no assigned provider");
    }

    logStep("Chamado found", { 
      valor: chamado.valor, 
      prestadorId: chamado.prestador_id,
      tipoServico: chamado.tipo_servico 
    });

    // Get provider's Stripe account
    const { data: providerData, error: providerError } = await supabaseClient
      .from('provider_data')
      .select('stripe_account_id, stripe_charges_enabled, is_blocked, payout_enabled')
      .eq('user_id', chamado.prestador_id)
      .single();

    if (providerError || !providerData) {
      throw new Error("Prestador não encontrado");
    }

    if (!providerData.stripe_account_id) {
      throw new Error("Prestador ainda não configurou conta Stripe. Aguarde a configuração.");
    }

    if (providerData.is_blocked) {
      throw new Error("Prestador está bloqueado");
    }

    if (providerData.payout_enabled === false) {
      throw new Error("Pagamentos ao prestador estão suspensos");
    }

    logStep("Provider Stripe account found", { 
      stripeAccountId: providerData.stripe_account_id 
    });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Verify account capabilities from Stripe directly
    const stripeAccount = await stripe.accounts.retrieve(providerData.stripe_account_id);
    
    if (!stripeAccount.capabilities?.transfers || stripeAccount.capabilities.transfers !== 'active') {
      throw new Error("O prestador precisa completar a verificação da conta Stripe para receber pagamentos.");
    }

    if (!stripeAccount.charges_enabled) {
      throw new Error("A conta Stripe do prestador ainda não está habilitada para receber pagamentos.");
    }

    logStep("Provider Stripe account verified");

    // Get customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("Nenhum cliente Stripe encontrado. Adicione um cartão primeiro.");
    }
    const customerId = customers.data[0].id;
    logStep("Customer found", { customerId });

    // Verify the payment method belongs to this customer
    const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);
    if (paymentMethod.customer !== customerId) {
      throw new Error("Este cartão não pertence a você");
    }
    logStep("Payment method verified", { brand: paymentMethod.card?.brand, last4: paymentMethod.card?.last4 });

    // Get app commission percentage
    const { data: settings } = await supabaseClient
      .from('app_settings')
      .select('value')
      .eq('key', 'app_commission_percentage')
      .single();

    const commissionPercentage = settings?.value?.value || 15;
    logStep("Commission percentage", { percentage: commissionPercentage });

    // Calculate amounts (in centavos)
    const totalAmountCentavos = Math.round(chamado.valor * 100);
    const applicationFeeAmount = Math.round(totalAmountCentavos * (commissionPercentage / 100));
    
    logStep("Payment amounts calculated", {
      total: totalAmountCentavos,
      applicationFee: applicationFeeAmount,
      providerReceives: totalAmountCentavos - applicationFeeAmount,
    });

    // Create PaymentIntent with saved card
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCentavos,
      currency: "brl",
      customer: customerId,
      payment_method: payment_method_id,
      off_session: false,
      confirm: true,
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: providerData.stripe_account_id,
      },
      metadata: {
        chamado_id: chamado_id,
        cliente_id: user.id,
        prestador_id: chamado.prestador_id,
        tipo_servico: chamado.tipo_servico,
        commission_percentage: commissionPercentage.toString(),
        payment_method_type: 'saved_card',
      },
    });

    logStep("PaymentIntent created and confirmed", { 
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });

    // Check if payment requires additional action (3D Secure)
    if (paymentIntent.status === 'requires_action') {
      logStep("Payment requires 3D Secure authentication");
      
      // Update chamado with payment intent
      await supabaseClient
        .from('chamados')
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          commission_percentage: commissionPercentage,
          commission_amount: applicationFeeAmount / 100,
          provider_amount: (totalAmountCentavos - applicationFeeAmount) / 100,
          payment_provider: 'stripe',
          payment_method: 'saved_card',
        })
        .eq('id', chamado_id);

      return new Response(JSON.stringify({
        requires_action: true,
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Payment succeeded
    if (paymentIntent.status === 'succeeded') {
      logStep("Payment succeeded immediately");

      // Update chamado
      await supabaseClient
        .from('chamados')
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          commission_percentage: commissionPercentage,
          commission_amount: applicationFeeAmount / 100,
          provider_amount: (totalAmountCentavos - applicationFeeAmount) / 100,
          payment_provider: 'stripe',
          payment_method: 'saved_card',
          payment_status: 'paid_stripe',
          payment_completed_at: new Date().toISOString(),
          status: 'in_service',
        })
        .eq('id', chamado_id);

      return new Response(JSON.stringify({
        success: true,
        payment_intent_id: paymentIntent.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Unexpected status
    throw new Error(`Status de pagamento inesperado: ${paymentIntent.status}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
