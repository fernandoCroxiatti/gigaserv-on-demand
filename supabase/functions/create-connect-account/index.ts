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
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user is a provider
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('perfil_principal, name')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.perfil_principal !== 'provider') {
      throw new Error("User is not a provider");
    }
    logStep("User is a provider", { name: profile.name });

    // Check if provider already has a Stripe account
    const { data: providerData, error: providerError } = await supabaseClient
      .from('provider_data')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (providerError) {
      throw new Error(`Error fetching provider data: ${providerError.message}`);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    let stripeAccountId = providerData?.stripe_account_id;

    if (!stripeAccountId) {
      // Create new Stripe Connect Express account
      logStep("Creating new Stripe Connect account");
      
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
        },
      });

      stripeAccountId = account.id;
      logStep("Stripe account created", { accountId: stripeAccountId });

      // Save to database
      const { error: updateError } = await supabaseClient
        .from('provider_data')
        .update({
          stripe_account_id: stripeAccountId,
          stripe_onboarding_completed: false,
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
          stripe_details_submitted: false,
        })
        .eq('user_id', user.id);

      if (updateError) {
        logStep("Error saving stripe account to database", { error: updateError.message });
      }
    } else {
      logStep("Provider already has Stripe account", { accountId: stripeAccountId });
    }

    // Create account link for onboarding
    const origin = req.headers.get("origin") || "https://gigaserv-on-demand.lovable.app";
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/profile?stripe=refresh`,
      return_url: `${origin}/profile?stripe=success`,
      type: "account_onboarding",
    });

    logStep("Account link created", { url: accountLink.url });

    return new Response(JSON.stringify({ 
      url: accountLink.url,
      account_id: stripeAccountId 
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
