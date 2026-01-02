import { useCallback } from 'react';
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
  expira_em: string | null;
  acao_pendente: boolean | null;
  isRead?: boolean;
}

type UserProfileType = 'client' | 'provider' | 'admin';

/**
 * Validates if notification should be visible to the given profile type
 * CRITICAL: This is the core filtering logic for audience segregation
 */
function isNotificationVisibleToProfile(
  notificationPublico: string,
  userProfileType: UserProfileType
): boolean {
  // Admin sees everything
  if (userProfileType === 'admin') {
    return true;
  }

  // Validate publico field - if invalid/missing, block notification (fail-safe)
  if (!notificationPublico || !['cliente', 'prestador', 'ambos'].includes(notificationPublico)) {
    console.warn('[Notifications] Blocking notification with invalid publico:', notificationPublico);
    return false;
  }

  // "ambos" is visible to everyone
  if (notificationPublico === 'ambos') {
    return true;
  }

  // Client can only see "cliente" notifications
  if (userProfileType === 'client' && notificationPublico === 'cliente') {
    return true;
  }

  // Provider can only see "prestador" notifications
  if (userProfileType === 'provider' && notificationPublico === 'prestador') {
    return true;
  }

  // Block all other cases
  return false;
}

export function useInternalNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
      if (isAdmin) {
        return { type: 'admin' as UserProfileType, isAdmin: true };
      }

      // Get user's perfil_principal from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('perfil_principal, active_profile')
        .eq('user_id', user.id)
        .single();

      if (!profile) return null;

      // Use perfil_principal as the base type (client or provider)
      const profileType = profile.perfil_principal === 'provider' ? 'provider' : 'client';
      
      return { 
        type: profileType as UserProfileType, 
        isAdmin: false,
        perfilPrincipal: profile.perfil_principal,
        activeProfile: profile.active_profile
      };
    },
    enabled: !!user?.id,
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch published notifications (excluding expired ones)
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['internal-notifications', user?.id, profileData?.type],
    queryFn: async () => {
      if (!user?.id || !profileData) return [];

      const now = new Date().toISOString();
      const userProfileType = profileData.type;

      // Fetch all published, non-expired notifications
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

      // CRITICAL: Filter notifications by audience BEFORE returning
      const filteredNotifications = (notifs || [])
        .filter(n => {
          // Validate publico field exists and is valid
          if (!n.publico) {
            console.warn('[Notifications] Notification missing publico field:', n.id);
            return false;
          }
          
          return isNotificationVisibleToProfile(n.publico, userProfileType);
        })
        .map(n => ({
          ...n,
          isRead: readIds.has(n.id),
        })) as InternalNotification[];

      console.log(`[Notifications] Filtered ${notifs?.length || 0} -> ${filteredNotifications.length} for profile: ${userProfileType}`);

      return filteredNotifications;
    },
    enabled: !!user?.id && !!profileData,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Count unread notifications (ONLY those visible to current profile)
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
    // Expose profile type for debugging/UI purposes
    userProfileType: profileData?.type || null,
  };
}
