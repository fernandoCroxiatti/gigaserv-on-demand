import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyAdminRequest {
  providerId: string;
  providerName: string;
  amount: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { providerId, providerName, amount }: NotifyAdminRequest = await req.json();

    if (!providerId || !providerName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all admins
    const { data: adminRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      console.error("Error fetching admins:", rolesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch admins" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admins found to notify");
      return new Response(
        JSON.stringify({ message: "No admins to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const title = "💰 Pagamento de Taxa Declarado";
    const body = `${providerName} declarou pagamento de R$ ${amount.toFixed(2)}. Aguardando aprovação.`;

    let notifiedCount = 0;

    // Send notification to each admin
    for (const admin of adminRoles) {
      try {
        // Use the existing send-notifications function
        await supabaseAdmin.functions.invoke("send-notifications", {
          body: {
            action: "event",
            userId: admin.user_id,
            notificationType: "admin_payment_declared",
            title,
            messageBody: body,
            data: {
              providerId,
              providerName,
              amount,
              type: "payment_declared",
            },
          },
        });
        notifiedCount++;
      } catch (err) {
        console.error(`Error notifying admin ${admin.user_id}:`, err);
      }
    }

    console.log(`Notified ${notifiedCount} of ${adminRoles.length} admins about payment declaration`);

    return new Response(
      JSON.stringify({
        success: true,
        notifiedAdmins: notifiedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error in notify-admin-payment:", { message: errorMessage, stack: errorStack });
    // Return generic message to client, keep details in server logs
    return new Response(
      JSON.stringify({ error: "Erro ao notificar administrador. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
