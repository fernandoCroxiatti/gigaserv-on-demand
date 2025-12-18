import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";

let stripePromise: Promise<Stripe | null> | null = null;

async function resolvePublishableKey(): Promise<string> {
  const envKey = (import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined)?.trim();
  if (envKey) return envKey;

  const { data, error } = await supabase.functions.invoke("get-stripe-publishable-key");
  if (error) throw new Error(error.message);

  const key = (data?.publishableKey as string | undefined)?.trim();
  if (!key) throw new Error("Stripe publishable key not configured");

  return key;
}

export function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = resolvePublishableKey().then((key) => loadStripe(key));
  }
  return stripePromise;
}
