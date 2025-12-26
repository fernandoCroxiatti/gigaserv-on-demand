import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROVIDER-FINANCIAL-DATA] ${step}${detailsStr}`);
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
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get provider data with Stripe account
    const { data: providerData, error: providerError } = await supabaseClient
      .from('provider_data')
      .select('stripe_account_id, stripe_connected, stripe_charges_enabled, stripe_payouts_enabled, stripe_status, rating, total_services')
      .eq('user_id', user.id)
      .single();

    if (providerError || !providerData) {
      logStep("No provider data found");
      return new Response(JSON.stringify({ 
        error: "Provider data not found",
        balance: { available: 0, pending: 0, paid: 0 },
        earnings: { today: 0, week: 0, month: 0, total: 0, todayRides: 0, weekRides: 0, monthRides: 0, totalRides: 0 },
        payouts: [],
        stripeStatus: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get earnings from chamados
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: chamados, error: chamadosError } = await supabaseClient
      .from('chamados')
      .select('valor, commission_amount, provider_amount, created_at, status, payment_status')
      .eq('prestador_id', user.id)
      .eq('status', 'finished')
      .in('payment_status', ['paid_stripe', 'paid_mock']);

    if (chamadosError) {
      logStep("Error fetching chamados", { error: chamadosError.message });
    }

    const calculateEarnings = (list: typeof chamados) => {
      return (list || []).reduce((acc, c) => {
        const providerReceives = c.provider_amount || 
          (c.valor - (c.commission_amount || c.valor * 0.15));
        return acc + (providerReceives || 0);
      }, 0);
    };

    const allChamados = chamados || [];
    const todayChamados = allChamados.filter(c => new Date(c.created_at) >= todayStart);
    const weekChamados = allChamados.filter(c => new Date(c.created_at) >= weekStart);
    const monthChamados = allChamados.filter(c => new Date(c.created_at) >= monthStart);

    const earnings = {
      today: calculateEarnings(todayChamados),
      week: calculateEarnings(weekChamados),
      month: calculateEarnings(monthChamados),
      total: calculateEarnings(allChamados),
      todayRides: todayChamados.length,
      weekRides: weekChamados.length,
      monthRides: monthChamados.length,
      totalRides: allChamados.length,
    };

    // Get payouts from database
    const { data: payouts, error: payoutsError } = await supabaseClient
      .from('provider_payouts')
      .select('*')
      .eq('provider_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (payoutsError) {
      logStep("Error fetching payouts", { error: payoutsError.message });
    }

    // Calculate balance from payouts
    const payoutsList = payouts || [];
    const paidAmount = payoutsList
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0) / 100;
    const pendingAmount = payoutsList
      .filter(p => p.status === 'pending' || p.status === 'in_transit')
      .reduce((sum, p) => sum + p.amount, 0) / 100;

    // Calculate available balance (total earned - paid - pending)
    const totalEarned = earnings.total;
    const availableBalance = Math.max(0, totalEarned - paidAmount - pendingAmount);

    // If Stripe connected, try to get real balance from Stripe
    let stripeBalance = null;
    if (providerData.stripe_account_id && providerData.stripe_connected) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        stripeBalance = await stripe.balance.retrieve({
          stripeAccount: providerData.stripe_account_id,
        });
        logStep("Stripe balance retrieved", { 
          available: stripeBalance.available,
          pending: stripeBalance.pending 
        });
      } catch (balanceError: any) {
        logStep("Error fetching Stripe balance", { error: balanceError.message });
      }
    }

    // Use Stripe balance if available, otherwise calculated
    const balance = {
      available: stripeBalance 
        ? stripeBalance.available.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0) / 100 
        : availableBalance,
      pending: stripeBalance 
        ? stripeBalance.pending.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0) / 100 
        : pendingAmount,
      paid: paidAmount,
    };

    // Format payouts for frontend
    const formattedPayouts = payoutsList.map(p => ({
      id: p.id,
      stripePayoutId: p.stripe_payout_id,
      amount: p.amount / 100, // Convert from cents
      currency: p.currency,
      status: p.status,
      arrivalDate: p.arrival_date,
      paidAt: p.paid_at,
      failureCode: p.failure_code,
      failureMessage: p.failure_message,
      createdAt: p.created_at,
    }));

    // Get Stripe account status info
    const stripeStatus = providerData.stripe_account_id ? {
      connected: providerData.stripe_connected,
      chargesEnabled: providerData.stripe_charges_enabled,
      payoutsEnabled: providerData.stripe_payouts_enabled,
      status: providerData.stripe_status,
    } : null;

    logStep("Returning financial data", { 
      balance, 
      earningsTotal: earnings.total,
      payoutsCount: formattedPayouts.length,
    });

    return new Response(JSON.stringify({
      balance,
      earnings,
      payouts: formattedPayouts,
      stripeStatus,
      providerInfo: {
        rating: providerData.rating,
        totalServices: providerData.total_services,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR", { message: errorMessage, stack: errorStack });
    // Return generic message to client, keep details in server logs
    return new Response(JSON.stringify({ error: "Erro ao obter dados financeiros. Tente novamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});