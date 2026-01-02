import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('Processing scheduled internal notifications...');

    // Find scheduled notifications that should be published now
    const now = new Date().toISOString();
    
    const { data: scheduledNotifications, error: fetchError } = await supabase
      .from('internal_notifications')
      .select('*')
      .eq('status', 'agendada')
      .lte('agendada_para', now);

    if (fetchError) {
      console.error('Error fetching scheduled notifications:', fetchError);
      throw fetchError;
    }

    if (!scheduledNotifications || scheduledNotifications.length === 0) {
      console.log('No scheduled notifications to publish');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No scheduled notifications' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${scheduledNotifications.length} notifications to publish`);

    // Publish each notification
    let published = 0;
    const errors: string[] = [];

    for (const notification of scheduledNotifications) {
      const { error: updateError } = await supabase
        .from('internal_notifications')
        .update({
          status: 'publicada',
          publicada: true,
          publicada_em: now,
        })
        .eq('id', notification.id);

      if (updateError) {
        console.error(`Error publishing notification ${notification.id}:`, updateError);
        errors.push(`${notification.id}: ${updateError.message}`);
      } else {
        published++;
        console.log(`Published notification: ${notification.titulo}`);
      }
    }

    const result = {
      processed: scheduledNotifications.length,
      published,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('Processing complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing scheduled notifications:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
