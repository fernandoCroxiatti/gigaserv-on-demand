import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Auto-finish timeout in minutes
const AUTO_FINISH_TIMEOUT_MINUTES = 15

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate the cutoff time (15 minutes ago)
    const cutoffTime = new Date()
    cutoffTime.setMinutes(cutoffTime.getMinutes() - AUTO_FINISH_TIMEOUT_MINUTES)

    console.log(`[auto-finish] Checking for services pending confirmation before ${cutoffTime.toISOString()}`)

    // Find all chamados in pending_client_confirmation status that have exceeded the timeout
    const { data: expiredChamados, error: fetchError } = await supabase
      .from('chamados')
      .select('id, cliente_id, prestador_id, provider_finish_requested_at, valor')
      .eq('status', 'pending_client_confirmation')
      .lt('provider_finish_requested_at', cutoffTime.toISOString())
      .not('provider_finish_requested_at', 'is', null)

    if (fetchError) {
      console.error('[auto-finish] Error fetching expired chamados:', fetchError)
      throw fetchError
    }

    if (!expiredChamados || expiredChamados.length === 0) {
      console.log('[auto-finish] No expired pending confirmations found')
      return new Response(
        JSON.stringify({ message: 'No expired services found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[auto-finish] Found ${expiredChamados.length} expired services to auto-finish`)

    // Auto-finish each expired chamado
    const results = await Promise.all(
      expiredChamados.map(async (chamado) => {
        try {
          const { error: updateError } = await supabase
            .from('chamados')
            .update({
              status: 'finished',
              auto_finished_at: new Date().toISOString(),
              auto_finish_reason: 'client_timeout',
            })
            .eq('id', chamado.id)
            .eq('status', 'pending_client_confirmation') // Safety check

          if (updateError) {
            console.error(`[auto-finish] Error updating chamado ${chamado.id}:`, updateError)
            return { id: chamado.id, success: false, error: updateError.message }
          }

          console.log(`[auto-finish] Successfully auto-finished chamado ${chamado.id}`)
          
          // Create targeted notifications only for the involved users
          try {
            const notifications = []
            
            // Notification for the specific client
            if (chamado.cliente_id) {
              notifications.push({
                user_id: chamado.cliente_id,
                notification_type: 'auto_finish',
                title: 'Serviço Finalizado Automaticamente',
                body: `Seu serviço foi finalizado automaticamente após ${AUTO_FINISH_TIMEOUT_MINUTES} minutos sem confirmação. O valor de R$ ${(chamado.valor || 0).toFixed(2)} foi processado normalmente.`,
                data: { chamado_id: chamado.id, type: 'auto_finish_client' },
              })
            }
            
            // Notification for the specific provider
            if (chamado.prestador_id) {
              notifications.push({
                user_id: chamado.prestador_id,
                notification_type: 'auto_finish',
                title: 'Serviço Finalizado Automaticamente',
                body: `O serviço foi finalizado automaticamente pelo sistema após ${AUTO_FINISH_TIMEOUT_MINUTES} minutos sem confirmação do cliente. Você já pode aceitar novos chamados.`,
                data: { chamado_id: chamado.id, type: 'auto_finish_provider' },
              })
            }
            
            if (notifications.length > 0) {
              await supabase.from('notification_history').insert(notifications)
              console.log(`[auto-finish] Created ${notifications.length} targeted notifications for chamado ${chamado.id}`)
            }
          } catch (notifError) {
            console.warn('[auto-finish] Failed to create notifications:', notifError)
          }

          return { id: chamado.id, success: true }
        } catch (err) {
          console.error(`[auto-finish] Exception processing chamado ${chamado.id}:`, err)
          return { id: chamado.id, success: false, error: String(err) }
        }
      })
    )

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`[auto-finish] Completed: ${successful} successful, ${failed} failed`)

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} expired services`,
        processed: successful,
        failed: failed,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[auto-finish] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})