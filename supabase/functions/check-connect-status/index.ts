import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-CONNECT-STATUS] ${step}${detailsStr}`);
};

// Map Stripe account state to status enum
function determineStripeStatus(account: Stripe.Account): 'pending' | 'verified' | 'restricted' {
  // Verified: Can charge and receive payouts
  if (account.charges_enabled && account.payouts_enabled) {
    return 'verified';
  }
  
  // Restricted: Has requirements that need attention
  if (account.requirements?.currently_due?.length || 
      account.requirements?.past_due?.length ||
      account.requirements?.disabled_reason) {
    return 'restricted';
  }
  
  // Pending: Waiting for Stripe to verify
  return 'pending';
}

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
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get provider data
    const { data: providerData, error: providerError } = await supabaseClient
      .from('provider_data')
      .select('stripe_account_id, stripe_onboarding_completed, stripe_charges_enabled, stripe_payouts_enabled, stripe_status')
      .eq('user_id', user.id)
      .single();

    if (providerError) {
      logStep("No provider data found");
      return new Response(JSON.stringify({ 
        has_account: false,
        onboarding_completed: false,
        charges_enabled: false,
        payouts_enabled: false,
        stripe_status: 'not_configured',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!providerData?.stripe_account_id) {
      logStep("No Stripe account found");
      return new Response(JSON.stringify({ 
        has_account: false,
        onboarding_completed: false,
        charges_enabled: false,
        payouts_enabled: false,
        stripe_status: 'not_configured',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check account status from Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    let account: Stripe.Account;
    try {
      account = await stripe.accounts.retrieve(providerData.stripe_account_id);
    } catch (retrieveError: any) {
      logStep("Error retrieving Stripe account", { error: retrieveError.message });
      
      // Account doesn't exist in Stripe anymore
      await supabaseClient
        .from('provider_data')
        .update({
          stripe_account_id: null,
          stripe_onboarding_completed: false,
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
          stripe_details_submitted: false,
          stripe_connected: false,
          stripe_status: 'not_configured',
        })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({ 
        has_account: false,
        onboarding_completed: false,
        charges_enabled: false,
        payouts_enabled: false,
        stripe_status: 'not_configured',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    // Determine the proper status
    const stripeStatus = determineStripeStatus(account);
    
    logStep("Account retrieved from Stripe", {
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      stripeStatus: stripeStatus,
      requirements: account.requirements?.currently_due,
    });

    // Update database with latest status
    const { error: updateError } = await supabaseClient
      .from('provider_data')
      .update({
        stripe_onboarding_completed: account.details_submitted,
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
        stripe_details_submitted: account.details_submitted,
        stripe_connected: account.charges_enabled && account.payouts_enabled,
        stripe_status: stripeStatus,
      })
      .eq('user_id', user.id);

    if (updateError) {
      logStep("Error updating provider data", { error: updateError.message });
    } else {
      logStep("Provider data updated", { stripeStatus });
    }

    return new Response(JSON.stringify({
      has_account: true,
      account_id: account.id,
      onboarding_completed: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      stripe_status: stripeStatus,
      requirements: account.requirements,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR", { message: errorMessage, stack: errorStack });
    // Return generic message to client, keep details in server logs
    return new Response(JSON.stringify({ error: "Erro ao verificar status. Tente novamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});