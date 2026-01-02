import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface InternalNotification {
  id: string;
  titulo: string;
  texto: string;
  imagem_url: string | null;
  publico: 'cliente' | 'prestador' | 'ambos';
  criada_em: string;
  publicada_em: string | null;
  isRead?: boolean;
}

export function useInternalNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch published notifications (excluding expired ones)
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['internal-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const now = new Date().toISOString();

      const { data: notifs, error } = await supabase
        .from('internal_notifications')
        .select('*')
        .eq('publicada', true)
        .or(`expira_em.is.null,expira_em.gt.${now}`)
        .order('criada_em', { ascending: false });

      if (error) {
        console.error('Error fetching internal notifications:', error);
        return [];
      }

      // Fetch read status
      const { data: reads } = await supabase
        .from('internal_notification_reads')
        .select('notificacao_id')
        .eq('usuario_id', user.id);

      const readIds = new Set(reads?.map(r => r.notificacao_id) || []);

      return (notifs || []).map(n => ({
        ...n,
        isRead: readIds.has(n.id),
      })) as InternalNotification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Count unread notifications
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Mark notification as read
  const markAsRead = useMutation({
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

      if (error) {
        console.error('Error marking notification as read:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-notifications'] });
    },
  });

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    const unreadNotifications = notifications.filter(n => !n.isRead);
    
    for (const notification of unreadNotifications) {
      await markAsRead.mutateAsync(notification.id);
    }
  }, [user?.id, notifications, markAsRead]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: (id: string) => markAsRead.mutate(id),
    markAllAsRead,
    refetch,
  };
}
