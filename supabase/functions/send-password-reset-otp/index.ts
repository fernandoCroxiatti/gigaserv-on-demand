import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting map (in-memory, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// 6 months in milliseconds
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }
  
  record.count++;
  return true;
}

function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Telefone é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, "");
    
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return new Response(
        JSON.stringify({ error: "Formato de telefone inválido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `${clientIP}:${cleanPhone}`;
    
    // Check rate limit
    if (!checkRateLimit(rateLimitKey)) {
      console.log(`Rate limit exceeded for ${rateLimitKey}`);
      // Still return success message for security (don't reveal if blocked)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Se o número estiver cadastrado, você receberá um código SMS" 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if phone exists in profiles (but don't reveal this to user)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, password_recovery_last_at, password_recovery_count")
      .eq("phone", cleanPhone)
      .limit(1)
      .single();

    if (profileError || !profile) {
      console.log(`Phone ${cleanPhone} not found in profiles`);
      // Return success message even if phone not found (security)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Se o número estiver cadastrado, você receberá um código SMS" 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check 6-month recovery limit
    if (profile.password_recovery_last_at) {
      const lastRecovery = new Date(profile.password_recovery_last_at);
      const nextAllowedDate = new Date(lastRecovery.getTime() + SIX_MONTHS_MS);
      const now = new Date();

      if (now < nextAllowedDate) {
        console.log(`User ${profile.user_id} blocked from recovery until ${nextAllowedDate.toISOString()}`);
        return new Response(
          JSON.stringify({ 
            error: `Você já utilizou a recuperação de senha recentemente. Tente novamente após ${formatDateBR(nextAllowedDate)}.`,
            blocked_until: nextAllowedDate.toISOString()
          }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const verifyServiceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

    if (!accountSid || !authToken || !verifyServiceSid) {
      console.error("Twilio credentials not configured");
      return new Response(
        JSON.stringify({ error: "Serviço de SMS não configurado" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format phone for Twilio (add Brazil country code if not present)
    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }
    formattedPhone = "+" + formattedPhone;

    console.log(`Sending OTP to ${formattedPhone}`);

    // Send OTP via Twilio Verify
    const twilioUrl = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`;
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedPhone,
        Channel: "sms",
      }),
    });

    const twilioResult = await twilioResponse.json();
    console.log("Twilio response:", JSON.stringify(twilioResult));

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioResult);
      // Don't reveal the actual error to user
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Se o número estiver cadastrado, você receberá um código SMS" 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log attempt (for audit)
    console.log(`OTP sent successfully to user_id: ${profile.user_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Se o número estiver cadastrado, você receberá um código SMS" 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-password-reset-otp:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
