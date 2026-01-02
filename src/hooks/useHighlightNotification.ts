import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface HighlightNotification {
  id: string;
  titulo: string;
  texto: string;
  imagem_url: string | null;
}

export function useHighlightNotification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  // Fetch highlight notifications not yet seen by user
  const { data: highlightNotification, isLoading } = useQuery({
    queryKey: ['highlight-notification', user?.id],
    queryFn: async (): Promise<HighlightNotification | null> => {
      if (!user?.id) return null;

      // Get all highlight notifications that are published
      const { data: highlights, error: highlightsError } = await supabase
        .from('internal_notifications')
        .select('id, titulo, texto, imagem_url')
        .eq('publicada', true)
        .eq('destaque', true)
        .order('publicada_em', { ascending: false })
        .limit(10);

      if (highlightsError || !highlights || highlights.length === 0) {
        return null;
      }

      // Get which ones user has already seen
      const { data: reads } = await supabase
        .from('internal_notification_reads')
        .select('notificacao_id')
        .eq('usuario_id', user.id)
        .in('notificacao_id', highlights.map(h => h.id));

      const readIds = new Set(reads?.map(r => r.notificacao_id) || []);

      // Find first unread highlight
      const unreadHighlight = highlights.find(h => !readIds.has(h.id));
      
      return unreadHighlight || null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Show modal when there's an unread highlight notification
  useEffect(() => {
    if (highlightNotification && !isLoading) {
      // Small delay to ensure app is fully loaded
      const timer = setTimeout(() => {
        setShowModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [highlightNotification, isLoading]);

  // Mark as seen mutation
  const markAsSeen = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) return;

      const { error } = await supabase
        .from('internal_notification_reads')
        .upsert({
          notificacao_id: notificationId,
          usuario_id: user.id,
        }, {
          onConflict: 'notificacao_id,usuario_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['highlight-notification'] });
      queryClient.invalidateQueries({ queryKey: ['internal-notifications'] });
    },
  });

  const closeModal = useCallback(() => {
    if (highlightNotification) {
      markAsSeen.mutate(highlightNotification.id);
    }
    setShowModal(false);
  }, [highlightNotification, markAsSeen]);

  return {
    showModal,
    highlightNotification,
    closeModal,
    isLoading,
  };
}
