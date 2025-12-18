import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    // If webhook secret is set, verify signature
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Signature verified");
      } catch (err) {
        logStep("Signature verification failed", { error: (err as Error).message });
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
      }
    } else {
      // Parse body directly (for testing without signature)
      event = JSON.parse(body);
      logStep("Parsed event without signature verification");
    }

    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment succeeded", { 
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          metadata: paymentIntent.metadata,
        });

        const chamadoId = paymentIntent.metadata?.chamado_id;
        if (chamadoId) {
          const { error } = await supabaseClient
            .from('chamados')
            .update({
              payment_status: 'paid_stripe',
              status: 'in_service',
              payment_completed_at: new Date().toISOString(),
            })
            .eq('id', chamadoId);

          if (error) {
            logStep("Error updating chamado", { error: error.message });
          } else {
            logStep("Chamado updated to in_service", { chamadoId });
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment failed", { 
          paymentIntentId: paymentIntent.id,
          error: paymentIntent.last_payment_error?.message,
        });

        const chamadoId = paymentIntent.metadata?.chamado_id;
        if (chamadoId) {
          const { error } = await supabaseClient
            .from('chamados')
            .update({
              payment_status: 'failed',
            })
            .eq('id', chamadoId);

          if (error) {
            logStep("Error updating chamado", { error: error.message });
          }
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        logStep("Account updated", {
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
        });

        // Update provider_data based on user_id from metadata
        const userId = account.metadata?.user_id;
        if (userId) {
          const { error } = await supabaseClient
            .from('provider_data')
            .update({
              stripe_onboarding_completed: account.details_submitted,
              stripe_charges_enabled: account.charges_enabled,
              stripe_payouts_enabled: account.payouts_enabled,
              stripe_details_submitted: account.details_submitted,
              stripe_connected: account.charges_enabled && account.payouts_enabled,
            })
            .eq('user_id', userId);

          if (error) {
            logStep("Error updating provider data", { error: error.message });
          } else {
            logStep("Provider data updated", { userId });
          }
        } else {
          // Try to find by stripe_account_id
          const { error } = await supabaseClient
            .from('provider_data')
            .update({
              stripe_onboarding_completed: account.details_submitted,
              stripe_charges_enabled: account.charges_enabled,
              stripe_payouts_enabled: account.payouts_enabled,
              stripe_details_submitted: account.details_submitted,
              stripe_connected: account.charges_enabled && account.payouts_enabled,
            })
            .eq('stripe_account_id', account.id);

          if (error) {
            logStep("Error updating provider data by account_id", { error: error.message });
          }
        }
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout completed", {
          payoutId: payout.id,
          amount: payout.amount,
          destination: payout.destination,
        });
        break;
      }

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        logStep("Transfer created", {
          transferId: transfer.id,
          amount: transfer.amount,
          destination: transfer.destination,
        });

        // Update chamado with transfer id if available
        const chamadoId = transfer.metadata?.chamado_id;
        if (chamadoId) {
          await supabaseClient
            .from('chamados')
            .update({ stripe_transfer_id: transfer.id })
            .eq('id', chamadoId);
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
