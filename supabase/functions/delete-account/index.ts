import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting - strict for account deletion
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 3; // 3 attempts per hour per user

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

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Client with service role to delete user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Client with user's JWT to get user info
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`[delete-account] Starting deletion for user: ${userId}`);

    // Check rate limit
    if (!checkRateLimit(userId)) {
      console.log(`[delete-account] Rate limit exceeded for user: ${userId}`);
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde uma hora e tente novamente." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete user data in order (respecting foreign key constraints)
    
    // 1. Delete chat messages where user is sender
    const { error: chatError } = await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('sender_id', userId);
    
    if (chatError) {
      console.error('[delete-account] Error deleting chat messages:', chatError);
    }

    // 2. Delete reviews where user is reviewer or reviewed
    const { error: reviewsError1 } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('reviewer_id', userId);
    
    const { error: reviewsError2 } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('reviewed_id', userId);
    
    if (reviewsError1 || reviewsError2) {
      console.error('[delete-account] Error deleting reviews:', reviewsError1 || reviewsError2);
    }

    // 3. Delete chamados where user is client or provider
    const { error: chamadosError1 } = await supabaseAdmin
      .from('chamados')
      .delete()
      .eq('cliente_id', userId);
    
    const { error: chamadosError2 } = await supabaseAdmin
      .from('chamados')
      .delete()
      .eq('prestador_id', userId);
    
    if (chamadosError1 || chamadosError2) {
      console.error('[delete-account] Error deleting chamados:', chamadosError1 || chamadosError2);
    }

    // 4. Delete provider_data
    const { error: providerError } = await supabaseAdmin
      .from('provider_data')
      .delete()
      .eq('user_id', userId);
    
    if (providerError) {
      console.error('[delete-account] Error deleting provider data:', providerError);
    }

    // 5. Delete user_roles
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
    
    if (rolesError) {
      console.error('[delete-account] Error deleting user roles:', rolesError);
    }

    // 6. Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', userId);
    
    if (profileError) {
      console.error('[delete-account] Error deleting profile:', profileError);
    }

    // 7. Delete the auth user using admin API
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteUserError) {
      console.error('[delete-account] Error deleting auth user:', deleteUserError);
      return new Response(
        JSON.stringify({ error: "Erro ao excluir conta. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-account] Successfully deleted user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Conta excluída com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[delete-account] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
