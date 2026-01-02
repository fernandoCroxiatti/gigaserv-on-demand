import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import {
  UserRole,
  applyNotificationPipeline,
  validateIncomingNotification,
  mapProfileToRole,
} from '@/lib/notificationAudienceFilter';

export interface InternalNotification {
  id: string;
  titulo: string;
  texto: string;
  imagem_url: string | null;
  publico: 'cliente' | 'prestador' | 'ambos';
  criada_em: string;
  publicada_em: string | null;
  expira_em: string | null;
  acao_pendente: boolean | null;
  isRead?: boolean;
}

/**
 * HARDENED Internal Notifications Hook
 * 
 * All notifications pass through centralized audience filter before:
 * - Being stored in state
 * - Being counted for badge
 * - Being rendered
 * 
 * Cache is cleared on profile switch to prevent cross-contamination.
 */
export function useInternalNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Track previous role to detect profile switches
  const previousRoleRef = useRef<UserRole | null>(null);

  // Fetch user profile type to determine filtering
  const { data: profileData } = useQuery({
    queryKey: ['user-profile-type', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = roles?.some(r => r.role === 'admin') || false;

      // Get user's perfil_principal from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('perfil_principal, active_profile')
        .eq('user_id', user.id)
        .single();

      if (!profile && !isAdmin) return null;

      const role = mapProfileToRole(profile?.perfil_principal, isAdmin);
      
      return { 
        role,
        isAdmin,
        perfilPrincipal: profile?.perfil_principal,
        activeProfile: profile?.active_profile
      };
    },
    enabled: !!user?.id,
    staleTime: 60000, // Cache for 1 minute
  });

  const currentRole = profileData?.role || null;

  // CRITICAL: Clear cache when role changes to prevent cross-contamination
  useEffect(() => {
    if (currentRole && previousRoleRef.current && currentRole !== previousRoleRef.current) {
      console.log(`[Notifications] Role changed: ${previousRoleRef.current} → ${currentRole}, clearing cache`);
      queryClient.removeQueries({ queryKey: ['internal-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['internal-notifications'] });
    }
    previousRoleRef.current = currentRole;
  }, [currentRole, queryClient]);

  // Fetch published notifications with centralized filtering
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['internal-notifications', user?.id, currentRole],
    queryFn: async () => {
      if (!user?.id || !currentRole) return [];

      // Step 1: Fetch all published notifications (raw data)
      const { data: rawNotifs, error } = await supabase
        .from('internal_notifications')
        .select('*')
        .eq('publicada', true)
        .order('criada_em', { ascending: false });

      if (error) {
        console.error('[Notifications] Error fetching:', error);
        return [];
      }

      if (!rawNotifs || rawNotifs.length === 0) {
        return [];
      }

      // Step 2 & 3: Apply centralized pipeline (audience + expiration filter)
      // THIS IS THE SINGLE SOURCE OF TRUTH
      const filteredNotifs = applyNotificationPipeline(rawNotifs, currentRole);

      // Step 4: Fetch read status
      const { data: reads } = await supabase
        .from('internal_notification_reads')
        .select('notificacao_id')
        .eq('usuario_id', user.id);

      const readIds = new Set(reads?.map(r => r.notificacao_id) || []);

      // Step 5: Apply read status to filtered notifications
      const notificationsWithReadStatus = filteredNotifs.map(n => ({
        ...n,
        isRead: readIds.has(n.id),
      })) as InternalNotification[];

      console.log(`[Notifications] Pipeline complete: ${rawNotifs.length} raw → ${filteredNotifs.length} filtered for role: ${currentRole}`);

      return notificationsWithReadStatus;
    },
    enabled: !!user?.id && !!currentRole,
    refetchInterval: 30000,
    // Prevent stale data from being shown during refetch
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Step 6 & 7: Badge uses SAME filtered array (not recalculated from raw)
  // CRITICAL: This ensures badge matches exactly what's in the list
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user?.id || !currentRole) return;

    const channel = supabase
      .channel('internal-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_notifications',
          filter: 'publicada=eq.true',
        },
        (payload) => {
          const newNotification = payload.new as any;
          
          // CRITICAL: Validate incoming notification before adding to state
          if (!validateIncomingNotification(newNotification, currentRole)) {
            console.log('[Notifications] Realtime: Blocked notification for wrong audience:', newNotification.publico);
            return;
          }

          // Refetch to get proper state with read status
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internal_notifications',
        },
        () => {
          // Refetch on any update to ensure consistency
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, currentRole, refetch]);

  // Mark notification as read
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) return;

      // Verify notification is in our filtered list before marking as read
      const exists = notifications.some(n => n.id === notificationId);
      if (!exists) {
        console.warn('[Notifications] Attempted to mark non-visible notification as read:', notificationId);
        return;
      }

      const { error } = await supabase
        .from('internal_notification_reads')
        .upsert({
          notificacao_id: notificationId,
          usuario_id: user.id,
        }, {
          onConflict: 'notificacao_id,usuario_id',
        });

      if (error) {
        console.error('[Notifications] Error marking as read:', error);
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
    
    // Batch update for better performance
    const promises = unreadNotifications.map(notification =>
      markAsRead.mutateAsync(notification.id)
    );

    await Promise.all(promises);
  }, [user?.id, notifications, markAsRead]);

  return {
    // Already filtered notifications - ready to render
    notifications,
    // Badge count from same filtered array
    unreadCount,
    isLoading,
    markAsRead: (id: string) => markAsRead.mutate(id),
    markAllAsRead,
    refetch,
    // Expose for debugging
    userRole: currentRole,
  };
}
