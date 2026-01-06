import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { calculateProviderFee } from "../_shared/feeCalculator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

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

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      logStep("Rate limit exceeded", { userId: user.id });
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const chamado_id = body.chamado_id;
    const payment_method_type = body.payment_method_type || 'card';

    // Validate payment method type - only allow whitelisted values
    if (!['card', 'pix'].includes(payment_method_type)) {
      logStep("Invalid payment method type", { received: payment_method_type });
      return new Response(
        JSON.stringify({ error: "Tipo de pagamento inválido. Use 'card' ou 'pix'." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate chamado_id is present and is a valid UUID format
    if (!chamado_id || typeof chamado_id !== 'string') {
      logStep("Missing chamado_id");
      return new Response(
        JSON.stringify({ error: "chamado_id é obrigatório" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(chamado_id)) {
      logStep("Invalid chamado_id format", { received: chamado_id });
      return new Response(
        JSON.stringify({ error: "Formato de chamado_id inválido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

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

    // Get provider's Stripe account and custom fee settings
    const { data: providerData, error: providerError } = await supabaseClient
      .from('provider_data')
      .select('stripe_account_id, stripe_charges_enabled, is_blocked, payout_enabled, custom_fee_enabled, custom_fee_percentage, custom_fee_fixed')
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

    // =================================================================
    // USE CENTRALIZED FEE CALCULATOR - ISOLATED BY PROVIDER_ID
    // This ensures each provider gets their own correct fee rate
    // Priority: 1. Promotion, 2. Custom fee, 3. Global
    // =================================================================
    const feeCalculation = await calculateProviderFee(
      supabaseClient,
      chamado.prestador_id,
      chamado.valor
    );

    const commissionPercentage = feeCalculation.feePercentage;
    const totalAmountCentavos = feeCalculation.totalAmountCentavos;
    const applicationFeeAmount = feeCalculation.applicationFeeAmountCentavos;
    const feeSource = feeCalculation.feeSource;
    
    logStep("Fee calculated via centralized calculator", {
      providerId: chamado.prestador_id,
      serviceValue: chamado.valor,
      total: totalAmountCentavos,
      percentageFee: feeCalculation.percentageFeeAmountCentavos,
      fixedFee: feeCalculation.fixedFeeAmountCentavos,
      applicationFee: applicationFeeAmount,
      providerReceives: feeCalculation.providerReceivesCentavos,
      feeSource: feeSource,
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
    // IMPORTANT: Explicitly set payment_method_types instead of using automatic_payment_methods
    // This ensures PIX works correctly in Brazil via PaymentIntent (not Checkout)
    const paymentMethodTypes: ('card' | 'pix')[] = payment_method_type === 'pix' 
      ? ['pix'] 
      : ['card'];
    
    logStep("Creating PaymentIntent", { 
      paymentMethodTypes, 
      paymentMethodType: payment_method_type,
      currency: 'brl',
      automaticPaymentMethodsDisabled: true,
    });

    // PIX expiration in seconds (15 minutes = 900 seconds)
    const PIX_EXPIRATION_SECONDS = 900;

    // Build payment intent options - NEVER use automatic_payment_methods
    // This ensures full control over payment methods and PIX works correctly
    const paymentIntentOptions: Stripe.PaymentIntentCreateParams = {
      amount: totalAmountCentavos,
      currency: "brl", // Required for PIX - must be BRL
      customer: customerId,
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: providerData.stripe_account_id,
      },
      // CRITICAL: Explicitly define payment_method_types instead of automatic_payment_methods
      // This is required for PIX to work correctly in-app
      payment_method_types: paymentMethodTypes,
      // Explicitly disable automatic_payment_methods to avoid conflicts
      // automatic_payment_methods: { enabled: false }, // Not needed when payment_method_types is set
      metadata: {
        chamado_id: chamado_id,
        cliente_id: user.id,
        prestador_id: chamado.prestador_id,
        tipo_servico: chamado.tipo_servico,
        commission_percentage: commissionPercentage.toString(),
        payment_method_type: payment_method_type,
        fee_source: feeSource,
      },
    };

    // Add PIX-specific options for expiration (15 minutes)
    // This generates QR Code and copy-paste code directly via PaymentIntent
    if (payment_method_type === 'pix') {
      paymentIntentOptions.payment_method_options = {
        pix: {
          expires_after_seconds: PIX_EXPIRATION_SECONDS,
        },
      };
      logStep("PIX configuration", { 
        expiresAfterSeconds: PIX_EXPIRATION_SECONDS,
        expiresIn: '15 minutes',
        willGenerateQRCode: true,
        willGenerateCopyPasteCode: true,
      });
    }

    // Create PaymentIntent with explicit payment methods (NOT automatic)
    // Stripe Connect: payment goes to platform, then transfer to provider
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // If PIX is not enabled for the platform account, Stripe rejects the payment method type.
      // In this case, return a user-friendly error so the frontend can disable PIX.
      if (
        payment_method_type === 'pix' &&
        /payment method type\s+"pix"\s+is invalid/i.test(msg)
      ) {
        logStep('PIX not enabled on platform account', { message: msg });
        return new Response(
          JSON.stringify({
            error:
              'PIX indisponível no momento. Ative PIX na sua conta de pagamentos para usar este método.',
            error_code: 'pix_not_enabled',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      throw err;
    }

    logStep("PaymentIntent created", { 
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ? "present" : "missing",
      status: paymentIntent.status,
      paymentMethodTypes: paymentIntent.payment_method_types,
    });

    // Update chamado with payment intent
    const { error: updateError } = await supabaseClient
      .from('chamados')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        commission_percentage: feeCalculation.feePercentage,
        commission_amount: feeCalculation.applicationFeeAmountCentavos / 100,
        provider_amount: feeCalculation.providerReceivesCentavos / 100,
        payment_provider: 'stripe',
        payment_method: payment_method_type, // Track the payment method used
      })
      .eq('id', chamado_id);

    if (updateError) {
      logStep("Error updating chamado", { error: updateError.message });
    }

    // Log success for debugging
    logStep("PaymentIntent ready for client", {
      paymentIntentId: paymentIntent.id,
      paymentMethod: payment_method_type,
      amountBRL: (feeCalculation.totalAmountCentavos / 100).toFixed(2),
      applicationFeeBRL: (feeCalculation.applicationFeeAmountCentavos / 100).toFixed(2),
      providerReceivesBRL: (feeCalculation.providerReceivesCentavos / 100).toFixed(2),
      feeSource: feeCalculation.feeSource,
    });

    // Response includes all data needed for frontend to handle payment
    // For PIX: client will use confirmPixPayment to get QR code and copy-paste code
    // For Card: client will use PaymentElement with confirmPayment
    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: feeCalculation.totalAmountCentavos,
      application_fee: feeCalculation.applicationFeeAmountCentavos,
      fee_source: feeCalculation.feeSource,
      publishable_key: Deno.env.get("VITE_STRIPE_PUBLIC_KEY"),
      payment_method_type: payment_method_type,
      currency: 'brl',
      // Additional info for PIX
      pix_expires_in_seconds: payment_method_type === 'pix' ? 900 : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR", { message: errorMessage, stack: errorStack });
    // Return generic message to client, keep details in server logs
    return new Response(JSON.stringify({ error: "Erro ao processar pagamento. Tente novamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
