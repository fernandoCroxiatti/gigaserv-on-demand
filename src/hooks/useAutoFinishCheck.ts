import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Timeout duration in milliseconds (15 minutes)
const AUTO_FINISH_TIMEOUT_MS = 15 * 60 * 1000;
// Check interval (every 30 seconds)
const CHECK_INTERVAL_MS = 30 * 1000;

interface UseAutoFinishCheckParams {
  chamadoId: string | undefined;
  status: string | undefined;
  providerFinishRequestedAt: Date | string | null | undefined;
  onAutoFinished?: () => void;
}

/**
 * Hook that monitors pending confirmation status and triggers auto-finish when timeout expires.
 * This runs client-side as a backup to the server-side cron job.
 */
export function useAutoFinishCheck({
  chamadoId,
  status,
  providerFinishRequestedAt,
  onAutoFinished,
}: UseAutoFinishCheckParams) {
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    // Only run for pending_client_confirmation status
    if (status !== 'pending_client_confirmation' || !chamadoId || !providerFinishRequestedAt) {
      hasTriggeredRef.current = false;
      return;
    }

    const checkAndAutoFinish = async () => {
      const requestTime = typeof providerFinishRequestedAt === 'string'
        ? new Date(providerFinishRequestedAt).getTime()
        : providerFinishRequestedAt.getTime();
      
      const deadline = requestTime + AUTO_FINISH_TIMEOUT_MS;
      const now = Date.now();

      if (now >= deadline && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        console.log('[AutoFinishCheck] Timeout expired, triggering auto-finish for chamado:', chamadoId);

        try {
          // Call the edge function to process the auto-finish
          const { error } = await supabase.functions.invoke('auto-finish-pending-services');
          
          if (error) {
            console.error('[AutoFinishCheck] Error invoking auto-finish:', error);
          } else {
            console.log('[AutoFinishCheck] Auto-finish triggered successfully');
            onAutoFinished?.();
          }
        } catch (err) {
          console.error('[AutoFinishCheck] Exception:', err);
        }
      }
    };

    // Initial check
    checkAndAutoFinish();

    // Set up periodic check
    const interval = setInterval(checkAndAutoFinish, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [chamadoId, status, providerFinishRequestedAt, onAutoFinished]);
}