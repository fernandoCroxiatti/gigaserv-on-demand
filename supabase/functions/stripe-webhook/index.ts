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

    // SECURITY: Always verify Stripe webhook signature in production
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    // Require webhook secret in production
    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET not configured - rejecting webhook");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }), 
        { status: 500 }
      );
    }
    
    // Require signature header
    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing signature" }), 
        { status: 401 }
      );
    }
    
    // Verify signature
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Signature verified successfully");
    } catch (err) {
      logStep("Signature verification failed", { error: (err as Error).message });
      return new Response(
        JSON.stringify({ error: "Invalid signature" }), 
        { status: 401 }
      );
    }

    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      // Handle Stripe Checkout session completed (used for PIX payments via Checkout)
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", {
          sessionId: session.id,
          paymentStatus: session.payment_status,
          paymentIntentId: session.payment_intent,
          metadata: session.metadata,
        });

        const chamadoId = session.metadata?.chamado_id;
        if (chamadoId && session.payment_status === 'paid') {
          const paymentMethod = session.metadata?.payment_method_type || 'pix';
          
          const { error } = await supabaseClient
            .from('chamados')
            .update({
              payment_status: 'paid_stripe',
              status: 'in_service',
              payment_completed_at: new Date().toISOString(),
              payment_method: paymentMethod,
              stripe_payment_intent_id: session.payment_intent as string,
            })
            .eq('id', chamadoId);

          if (error) {
            logStep("Error updating chamado from checkout", { error: error.message });
          } else {
            logStep("Chamado updated to in_service via Checkout", { chamadoId, paymentMethod });
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment succeeded", { 
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          metadata: paymentIntent.metadata,
          paymentMethodTypes: paymentIntent.payment_method_types,
        });

        const chamadoId = paymentIntent.metadata?.chamado_id;
        if (chamadoId) {
          // Check if already updated by checkout.session.completed
          const { data: existingChamado } = await supabaseClient
            .from('chamados')
            .select('payment_status')
            .eq('id', chamadoId)
            .single();

          // Only update if not already paid (avoid duplicate updates)
          if (existingChamado?.payment_status !== 'paid_stripe') {
            const paymentMethod = paymentIntent.payment_method_types?.includes('pix') ? 'pix' : 'card';
            
            const { error } = await supabaseClient
              .from('chamados')
              .update({
                payment_status: 'paid_stripe',
                status: 'in_service',
                payment_completed_at: new Date().toISOString(),
                payment_method: paymentMethod,
              })
              .eq('id', chamadoId);

            if (error) {
              logStep("Error updating chamado", { error: error.message });
            } else {
              logStep("Chamado updated to in_service", { chamadoId, paymentMethod });
            }
          } else {
            logStep("Chamado already paid, skipping update", { chamadoId });
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment failed", { 
          paymentIntentId: paymentIntent.id,
          error: paymentIntent.last_payment_error?.message,
          errorCode: paymentIntent.last_payment_error?.code,
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
          } else {
            logStep("Chamado payment marked as failed", { chamadoId });
          }
        }
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment canceled (PIX expired or user canceled)", { 
          paymentIntentId: paymentIntent.id,
          cancellationReason: paymentIntent.cancellation_reason,
        });

        const chamadoId = paymentIntent.metadata?.chamado_id;
        if (chamadoId) {
          // Only update if still awaiting payment
          const { data: existingChamado } = await supabaseClient
            .from('chamados')
            .select('status, payment_status')
            .eq('id', chamadoId)
            .single();

          if (existingChamado?.status === 'awaiting_payment' && existingChamado?.payment_status === 'pending') {
            const { error } = await supabaseClient
              .from('chamados')
              .update({
                payment_status: 'failed',
              })
              .eq('id', chamadoId);

            if (error) {
              logStep("Error updating chamado", { error: error.message });
            } else {
              logStep("Chamado payment marked as failed due to cancellation/expiration", { chamadoId });
            }
          }
        }
        break;
      }

      case "payment_intent.processing": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment processing", { 
          paymentIntentId: paymentIntent.id,
        });
        // PIX payments go through processing state briefly
        // No database update needed - we'll wait for succeeded or failed
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

        // Determine status
        let stripeStatus = 'pending';
        if (account.charges_enabled && account.payouts_enabled) {
          stripeStatus = 'verified';
        } else if (account.requirements?.currently_due?.length || 
                   account.requirements?.past_due?.length ||
                   account.requirements?.disabled_reason) {
          stripeStatus = 'restricted';
        }

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
              stripe_status: stripeStatus,
            })
            .eq('user_id', userId);

          if (error) {
            logStep("Error updating provider data", { error: error.message });
          } else {
            logStep("Provider data updated", { userId, stripeStatus });
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
              stripe_status: stripeStatus,
            })
            .eq('stripe_account_id', account.id);

          if (error) {
            logStep("Error updating provider data by account_id", { error: error.message });
          }
        }
        break;
      }

      case "payout.created": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout created", {
          payoutId: payout.id,
          amount: payout.amount,
          status: payout.status,
          arrivalDate: payout.arrival_date,
        });

        // Find provider by stripe account - payout is on connected account
        const accountId = (event as any).account;
        if (accountId) {
          const { data: providerData } = await supabaseClient
            .from('provider_data')
            .select('user_id')
            .eq('stripe_account_id', accountId)
            .single();

          if (providerData) {
            const { error } = await supabaseClient
              .from('provider_payouts')
              .upsert({
                provider_id: providerData.user_id,
                stripe_payout_id: payout.id,
                stripe_account_id: accountId,
                amount: payout.amount,
                currency: payout.currency,
                status: payout.status,
                arrival_date: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
              }, {
                onConflict: 'stripe_payout_id'
              });

            if (error) {
              logStep("Error inserting payout", { error: error.message });
            } else {
              logStep("Payout created in database", { payoutId: payout.id });
            }
          }
        }
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout paid", {
          payoutId: payout.id,
          amount: payout.amount,
        });

        const { error } = await supabaseClient
          .from('provider_payouts')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('stripe_payout_id', payout.id);

        if (error) {
          logStep("Error updating payout to paid", { error: error.message });
        } else {
          logStep("Payout marked as paid", { payoutId: payout.id });
        }
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout failed", {
          payoutId: payout.id,
          failureCode: payout.failure_code,
          failureMessage: payout.failure_message,
        });

        const { error } = await supabaseClient
          .from('provider_payouts')
          .update({
            status: 'failed',
            failure_code: payout.failure_code || null,
            failure_message: payout.failure_message || null,
          })
          .eq('stripe_payout_id', payout.id);

        if (error) {
          logStep("Error updating payout to failed", { error: error.message });
        } else {
          logStep("Payout marked as failed", { payoutId: payout.id });
        }
        break;
      }

      case "payout.canceled": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout canceled", { payoutId: payout.id });

        const { error } = await supabaseClient
          .from('provider_payouts')
          .update({ status: 'canceled' })
          .eq('stripe_payout_id', payout.id);

        if (error) {
          logStep("Error updating payout to canceled", { error: error.message });
        }
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

      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge;
        logStep("Charge succeeded", {
          chargeId: charge.id,
          amount: charge.amount,
          paymentIntent: charge.payment_intent,
        });
        // Charge succeeded is handled via payment_intent.succeeded
        break;
      }

      case "balance.available": {
        const balance = event.data.object as Stripe.Balance;
        logStep("Balance available updated", {
          available: balance.available,
          pending: balance.pending,
        });
        // Balance updates are fetched on-demand via provider-financial-data
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