import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[check-pending-fees] Starting check...");

    // Get all providers needing warning (70-99% of limit, not warned in 24h)
    const { data: providers, error } = await supabaseAdmin.rpc('get_providers_needing_warning');

    if (error) {
      console.error("[check-pending-fees] Error getting providers:", error);
      throw error;
    }

    if (!providers || providers.length === 0) {
      console.log("[check-pending-fees] No providers need warning");
      return new Response(
        JSON.stringify({ success: true, warned: 0, message: "No providers need warning" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[check-pending-fees] Found ${providers.length} providers needing warning`);

    let warnedCount = 0;
    const errors: string[] = [];

    for (const provider of providers) {
      try {
        const percentUsed = Number(provider.percent_used);
        const pendingBalance = Number(provider.pending_balance);
        const maxLimit = Number(provider.max_limit);

        // Send push notification
        await supabaseAdmin.functions.invoke('send-notifications', {
          body: {
            action: 'event',
            userId: provider.user_id,
            notificationType: 'pending_fee_warning',
            title: '⚠️ Atenção: Limite de Pendência',
            messageBody: `Você atingiu ${percentUsed.toFixed(0)}% do seu limite. Saldo pendente: R$ ${pendingBalance.toFixed(2)}. Regularize para continuar atendendo.`,
            data: {
              type: 'pending_fee_warning',
              pendingBalance: pendingBalance,
              maxLimit: maxLimit,
              percentUsed: percentUsed
            }
          }
        });

        // Update warning sent timestamp
        await supabaseAdmin
          .from("provider_data")
          .update({ pending_fee_warning_sent_at: new Date().toISOString() })
          .eq("user_id", provider.user_id);

        warnedCount++;
        console.log(`[check-pending-fees] Warned provider ${provider.user_id} (${percentUsed.toFixed(1)}%)`);
      } catch (notifError: unknown) {
        const errorMsg = notifError instanceof Error ? notifError.message : "Unknown error";
        console.error(`[check-pending-fees] Failed to warn provider ${provider.user_id}:`, errorMsg);
        errors.push(`${provider.user_id}: ${errorMsg}`);
      }
    }

    console.log(`[check-pending-fees] Completed. Warned ${warnedCount} of ${providers.length} providers`);

    return new Response(
      JSON.stringify({
        success: true,
        total: providers.length,
        warned: warnedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[check-pending-fees] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
