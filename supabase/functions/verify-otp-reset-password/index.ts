import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting for verification attempts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_VERIFY_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= MAX_VERIFY_ATTEMPTS) {
    return false;
  }
  
  record.count++;
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code, newPassword } = await req.json();
    
    if (!phone || !code || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Telefone, código e nova senha são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate password
    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, "");
    
    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `verify:${clientIP}:${cleanPhone}`;
    
    // Check rate limit
    if (!checkRateLimit(rateLimitKey)) {
      console.log(`Verification rate limit exceeded for ${rateLimitKey}`);
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const verifyServiceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

    if (!accountSid || !authToken || !verifyServiceSid) {
      console.error("Twilio credentials not configured");
      return new Response(
        JSON.stringify({ error: "Serviço de verificação não configurado" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format phone for Twilio
    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }
    formattedPhone = "+" + formattedPhone;

    console.log(`Verifying OTP for ${formattedPhone}`);

    // Verify OTP via Twilio Verify
    const twilioUrl = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`;
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedPhone,
        Code: code,
      }),
    });

    const twilioResult = await twilioResponse.json();
    console.log("Twilio verification response:", JSON.stringify(twilioResult));

    if (!twilioResponse.ok || twilioResult.status !== "approved") {
      console.log("OTP verification failed:", twilioResult);
      return new Response(
        JSON.stringify({ error: "Código inválido ou expirado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // OTP verified - now update password
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user_id from phone
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, password_recovery_count")
      .eq("phone", cleanPhone)
      .limit(1)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found for phone:", cleanPhone);
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar senha. Tente novamente." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update password recovery tracking
    const { error: trackingError } = await supabase
      .from("profiles")
      .update({
        password_recovery_last_at: new Date().toISOString(),
        password_recovery_count: (profile.password_recovery_count || 0) + 1
      })
      .eq("phone", cleanPhone);

    if (trackingError) {
      console.error("Error updating recovery tracking:", trackingError);
      // Don't fail the request, password was already updated
    }

    console.log(`Password updated successfully for user_id: ${profile.user_id}`);

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar senha. Tente novamente." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Password updated successfully for user_id: ${profile.user_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Senha atualizada com sucesso!" 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in verify-otp-reset-password:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
