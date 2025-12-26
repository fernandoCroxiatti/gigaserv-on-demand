import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UseCancellationWithReasonOptions {
  chamadoId: string | undefined;
  onCancelled?: () => void;
}

export function useCancellationWithReason({ chamadoId, onCancelled }: UseCancellationWithReasonOptions) {
  const { user } = useAuth();
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const openCancellationDialog = useCallback(() => {
    setShowReasonDialog(true);
  }, []);

  const closeCancellationDialog = useCallback(() => {
    setShowReasonDialog(false);
  }, []);

  const confirmCancellation = useCallback(async (reason: string, category: string) => {
    if (!chamadoId || !user) return;

    setCancelling(true);
    try {
      // Update chamado with cancellation reason and status
      const { error } = await supabase
        .from('chamados')
        .update({
          status: 'canceled',
          cancellation_reason: reason,
          cancellation_category: category,
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', chamadoId);

      if (error) throw error;

      setShowReasonDialog(false);
      onCancelled?.();
    } catch (error) {
      console.error('Error cancelling chamado with reason:', error);
      throw error;
    } finally {
      setCancelling(false);
    }
  }, [chamadoId, user, onCancelled]);

  return {
    showReasonDialog,
    cancelling,
    openCancellationDialog,
    closeCancellationDialog,
    confirmCancellation,
  };
}
