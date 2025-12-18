import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT-INTENT] ${step}${detailsStr}`);
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
    const { chamado_id, payment_method_type = 'card' } = await req.json();
    if (!chamado_id) throw new Error("chamado_id is required");
    logStep("Processing chamado", { chamadoId: chamado_id, paymentMethodType: payment_method_type });

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

    // Initialize Stripe early to verify account capabilities
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Verify account capabilities from Stripe directly
    const stripeAccount = await stripe.accounts.retrieve(providerData.stripe_account_id);
    logStep("Stripe account retrieved", {
      chargesEnabled: stripeAccount.charges_enabled,
      payoutsEnabled: stripeAccount.payouts_enabled,
      detailsSubmitted: stripeAccount.details_submitted,
      capabilities: stripeAccount.capabilities,
    });

    // Update database with real status from Stripe
    await supabaseClient
      .from('provider_data')
      .update({
        stripe_charges_enabled: stripeAccount.charges_enabled,
        stripe_payouts_enabled: stripeAccount.payouts_enabled,
        stripe_details_submitted: stripeAccount.details_submitted,
        stripe_connected: stripeAccount.charges_enabled && stripeAccount.payouts_enabled,
        stripe_onboarding_completed: stripeAccount.details_submitted,
      })
      .eq('user_id', chamado.prestador_id);

    // Check if account can receive transfers
    if (!stripeAccount.capabilities?.transfers || stripeAccount.capabilities.transfers !== 'active') {
      throw new Error("O prestador precisa completar a verificação da conta Stripe para receber pagamentos. Peça ao prestador para acessar o perfil e clicar em 'Configurar Stripe'.");
    }

    if (!stripeAccount.charges_enabled) {
      throw new Error("A conta Stripe do prestador ainda não está habilitada para receber pagamentos. O prestador precisa completar o cadastro.");
    }

    logStep("Provider Stripe account verified", { 
      stripeAccountId: providerData.stripe_account_id,
      transfersEnabled: stripeAccount.capabilities?.transfers
    });

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

    // Stripe already initialized above

    // Check if customer exists or create new
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }
    logStep("Customer ready", { customerId });

    // Determine payment method types based on request
    const paymentMethodTypes = payment_method_type === 'pix' 
      ? ['pix'] 
      : ['card'];
    
    logStep("Creating PaymentIntent", { paymentMethodTypes });

    // Create PaymentIntent with automatic transfer
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCentavos,
      currency: "brl",
      customer: customerId,
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: providerData.stripe_account_id,
      },
      payment_method_types: paymentMethodTypes,
      metadata: {
        chamado_id: chamado_id,
        cliente_id: user.id,
        prestador_id: chamado.prestador_id,
        tipo_servico: chamado.tipo_servico,
        commission_percentage: commissionPercentage.toString(),
        payment_method_type: payment_method_type,
      },
    });

    logStep("PaymentIntent created", { 
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ? "present" : "missing",
    });

    // Update chamado with payment intent
    const { error: updateError } = await supabaseClient
      .from('chamados')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        commission_percentage: commissionPercentage,
        commission_amount: applicationFeeAmount / 100,
        provider_amount: (totalAmountCentavos - applicationFeeAmount) / 100,
        payment_provider: 'stripe',
      })
      .eq('id', chamado_id);

    if (updateError) {
      logStep("Error updating chamado", { error: updateError.message });
    }

    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: totalAmountCentavos,
      application_fee: applicationFeeAmount,
      publishable_key: Deno.env.get("VITE_STRIPE_PUBLIC_KEY"),
      payment_method_type: payment_method_type,
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
