import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PIX-CHECKOUT] ${step}${detailsStr}`);
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
    const { chamado_id } = await req.json();
    if (!chamado_id) throw new Error("chamado_id is required");
    logStep("Processing chamado for PIX Checkout", { chamadoId: chamado_id });

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
    logStep("Stripe account retrieved", {
      chargesEnabled: stripeAccount.charges_enabled,
      payoutsEnabled: stripeAccount.payouts_enabled,
      detailsSubmitted: stripeAccount.details_submitted,
    });

    // Check if account can receive transfers
    if (!stripeAccount.capabilities?.transfers || stripeAccount.capabilities.transfers !== 'active') {
      throw new Error("O prestador precisa completar a verificação da conta Stripe para receber pagamentos.");
    }

    if (!stripeAccount.charges_enabled) {
      throw new Error("A conta Stripe do prestador ainda não está habilitada para receber pagamentos.");
    }

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

    // Get origin for success/cancel URLs
    const origin = req.headers.get("origin") || "https://giga-sos.lovable.app";

    // Create Stripe Checkout Session for PIX
    // Using mode: 'payment' for one-time payments
    // payment_method_types: ['pix'] to exclusively use PIX
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['pix'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Serviço GIGA S.O.S - ${chamado.tipo_servico}`,
              description: `Atendimento em ${chamado.origem_address}`,
            },
            unit_amount: totalAmountCentavos,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_intent_data: {
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
          payment_method_type: 'pix',
        },
      },
      success_url: `${origin}/?pix_success=true&chamado_id=${chamado_id}`,
      cancel_url: `${origin}/?pix_canceled=true&chamado_id=${chamado_id}`,
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes expiration
      metadata: {
        chamado_id: chamado_id,
        cliente_id: user.id,
        prestador_id: chamado.prestador_id,
        tipo_servico: chamado.tipo_servico,
        payment_method_type: 'pix',
      },
    });

    logStep("Checkout Session created", { 
      sessionId: session.id,
      url: session.url,
      expiresAt: session.expires_at,
    });

    // Update chamado with checkout session info
    const { error: updateError } = await supabaseClient
      .from('chamados')
      .update({
        stripe_payment_intent_id: session.payment_intent as string || null,
        commission_percentage: commissionPercentage,
        commission_amount: applicationFeeAmount / 100,
        provider_amount: (totalAmountCentavos - applicationFeeAmount) / 100,
        payment_provider: 'stripe',
        payment_method: 'pix',
      })
      .eq('id', chamado_id);

    if (updateError) {
      logStep("Error updating chamado", { error: updateError.message });
    }

    // Return the checkout URL for redirection
    return new Response(JSON.stringify({
      checkout_url: session.url,
      session_id: session.id,
      expires_at: session.expires_at,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Check if it's a PIX not enabled error
    if (/pix/i.test(errorMessage) && /not.*enabled|invalid/i.test(errorMessage)) {
      return new Response(JSON.stringify({ 
        error: 'PIX não está disponível no momento. Por favor, use cartão de crédito.',
        error_code: 'pix_not_enabled',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
