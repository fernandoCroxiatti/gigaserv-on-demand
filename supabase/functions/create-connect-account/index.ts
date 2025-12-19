import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CONNECT-ACCOUNT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Configuração do servidor incompleta. Contate o suporte.");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Você precisa estar logado para configurar a conta Stripe.");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }
    const user = userData.user;
    if (!user?.email) {
      throw new Error("Email não encontrado. Verifique seu cadastro.");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user is a provider
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('perfil_principal, name, phone, avatar_url')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.perfil_principal !== 'provider') {
      throw new Error("Apenas prestadores podem configurar conta Stripe.");
    }
    logStep("User is a provider", { name: profile.name });

    // Get provider data and check registration_complete
    const { data: providerData, error: providerError } = await supabaseClient
      .from('provider_data')
      .select('stripe_account_id, is_blocked, registration_complete, vehicle_plate, vehicle_type, terms_accepted')
      .eq('user_id', user.id)
      .single();

    if (providerError) {
      throw new Error("Dados do prestador não encontrados. Contate o suporte.");
    }

    if (providerData?.is_blocked) {
      throw new Error("Sua conta está bloqueada. Contate o suporte para mais informações.");
    }

    // CRITICAL: Check if registration is complete before allowing Stripe onboarding
    if (!providerData?.registration_complete) {
      logStep("Registration incomplete - blocking Stripe onboarding");
      throw new Error("Finalize seu cadastro como prestador antes de configurar os recebimentos.");
    }

    // Validate all required fields are filled
    if (!profile.name || !profile.phone || !profile.avatar_url) {
      logStep("Profile incomplete", { name: !!profile.name, phone: !!profile.phone, avatar: !!profile.avatar_url });
      throw new Error("Complete seu perfil (nome, telefone e foto) antes de configurar os recebimentos.");
    }

    if (!providerData.vehicle_plate || !providerData.vehicle_type) {
      logStep("Vehicle data incomplete", { plate: !!providerData.vehicle_plate, type: !!providerData.vehicle_type });
      throw new Error("Informe os dados do veículo antes de configurar os recebimentos.");
    }

    if (!providerData.terms_accepted) {
      logStep("Terms not accepted");
      throw new Error("Aceite os termos de uso antes de configurar os recebimentos.");
    }

    logStep("Registration complete - proceeding with Stripe", {
      registration_complete: providerData.registration_complete,
      has_stripe_account: !!providerData.stripe_account_id
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    let stripeAccountId = providerData?.stripe_account_id;

    // Step 1: Create Stripe account if doesn't exist
    if (!stripeAccountId) {
      logStep("Creating new Stripe Connect Express account");
      
      try {
        const account = await stripe.accounts.create({
          type: "express",
          country: "BR",
          email: user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: {
            user_id: user.id,
            provider_name: profile.name || 'Provider',
            app: 'gigasos',
          },
        });

        stripeAccountId = account.id;
        logStep("Stripe Express account created", { accountId: stripeAccountId });

        // Save to database with pending status
        const { error: updateError } = await supabaseClient
          .from('provider_data')
          .update({
            stripe_account_id: stripeAccountId,
            stripe_onboarding_completed: false,
            stripe_charges_enabled: false,
            stripe_payouts_enabled: false,
            stripe_details_submitted: false,
            stripe_connected: false,
            stripe_status: 'pending',
          })
          .eq('user_id', user.id);

        if (updateError) {
          logStep("Error saving stripe account to database", { error: updateError.message });
        }
      } catch (stripeError: any) {
        logStep("Stripe account creation error", { error: stripeError.message });
        throw new Error("Não foi possível criar conta Stripe. Tente novamente em alguns minutos.");
      }
    } else {
      logStep("Provider already has Stripe account", { accountId: stripeAccountId });
      
      // Verify account still exists in Stripe
      try {
        const existingAccount = await stripe.accounts.retrieve(stripeAccountId);
        logStep("Existing account retrieved", { 
          chargesEnabled: existingAccount.charges_enabled,
          payoutsEnabled: existingAccount.payouts_enabled
        });
      } catch (retrieveError: any) {
        logStep("Stripe account not found, recreating", { error: retrieveError.message });
        
        // Account was deleted or doesn't exist, create new one
        const account = await stripe.accounts.create({
          type: "express",
          country: "BR",
          email: user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: {
            user_id: user.id,
            provider_name: profile.name || 'Provider',
            app: 'gigasos',
          },
        });

        stripeAccountId = account.id;
        
        await supabaseClient
          .from('provider_data')
          .update({
            stripe_account_id: stripeAccountId,
            stripe_onboarding_completed: false,
            stripe_charges_enabled: false,
            stripe_payouts_enabled: false,
            stripe_details_submitted: false,
            stripe_connected: false,
            stripe_status: 'pending',
          })
          .eq('user_id', user.id);
      }
    }

    // Step 2: ALWAYS create a NEW onboarding link (never reuse old links)
    const origin = req.headers.get("origin") || "https://gigaserv-on-demand.lovable.app";
    
    logStep("Creating NEW account onboarding link", { origin, accountId: stripeAccountId });
    
    try {
      // Always generate a fresh onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${origin}/stripe/callback?type=refresh`,
        return_url: `${origin}/stripe/callback?type=success`,
        type: "account_onboarding",
      });

      logStep("Account onboarding link created successfully", { 
        url: accountLink.url,
        expiresAt: new Date(accountLink.expires_at * 1000).toISOString()
      });

      return new Response(JSON.stringify({ 
        url: accountLink.url,
        account_id: stripeAccountId,
        message: "Link de onboarding criado com sucesso"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (linkError: any) {
      logStep("Error creating account link", { error: linkError.message });
      throw new Error("Não foi possível gerar o link de cadastro. Tente novamente.");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido. Tente novamente.";
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ 
      error: errorMessage,
      user_message: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});