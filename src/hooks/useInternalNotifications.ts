import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import {
  UserProfiles,
  applyNotificationPipelineWithProfiles,
  validateIncomingNotificationWithProfiles,
} from '@/lib/notificationAudienceFilter';

export interface InternalNotification {
  id: string;
  titulo: string;
  texto: string;
  imagem_url: string | null;
  publico: 'clientes' | 'prestadores' | 'todos';
  criada_em: string;
  publicada_em: string | null;
  expira_em: string | null;
  acao_pendente: boolean | null;
  isRead?: boolean;
}

/**
 * HARDENED Internal Notifications Hook
 * 
 * Notifications are filtered based on REGISTERED profiles (not active session):
 * - Client profile → sees "clientes" and "todos"
 * - Provider profile → sees "prestadores", "clientes" (providers are also clients), and "todos"
 * - Admin → sees everything
 * 
 * Cache is cleared on profile change to prevent cross-contamination.
 */
export function useInternalNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Track previous profiles to detect changes
  const previousProfilesRef = useRef<string | null>(null);

  // Fetch user's REGISTERED profiles to determine filtering
  const { data: userProfiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['user-registered-profiles', user?.id],
    queryFn: async (): Promise<UserProfiles> => {
      if (!user?.id) {
        // Return default client profile if no user
        console.log('[Notifications] No user, returning default client profile');
        return { isClient: true, isProvider: false, isAdmin: false };
      }

      console.log('[Notifications] Fetching profiles for user:', user.id);

      // Check if user is admin
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (rolesError) {
        console.error('[Notifications] Error fetching roles:', rolesError);
      }

      const isAdmin = roles?.some(r => r.role === 'admin') || false;

      // Check if user has provider_data (is registered as provider)
      const { data: providerData, error: providerError } = await supabase
        .from('provider_data')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (providerError) {
        console.error('[Notifications] Error fetching provider data:', providerError);
      }

      const isProvider = !!providerData;
      
      // All users are clients by default
      // This is the KEY FIX: every authenticated user is a client
      const isClient = true;

      const profiles = { 
        isClient,
        isProvider,
        isAdmin,
      };
      
      console.log('[Notifications] User profiles detected:', profiles);

      return profiles;
    },
    enabled: !!user?.id,
    staleTime: 60000, // Cache for 1 minute
  });

  // Create a string key for profile comparison
  const profilesKey = userProfiles 
    ? `${userProfiles.isClient}-${userProfiles.isProvider}-${userProfiles.isAdmin}`
    : null;

  // CRITICAL: Clear cache when profiles change to prevent cross-contamination
  useEffect(() => {
    if (profilesKey && previousProfilesRef.current && profilesKey !== previousProfilesRef.current) {
      console.log(`[Notifications] Profiles changed: ${previousProfilesRef.current} → ${profilesKey}, clearing cache`);
      queryClient.removeQueries({ queryKey: ['internal-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['internal-notifications'] });
    }
    previousProfilesRef.current = profilesKey;
  }, [profilesKey, queryClient]);

  // Fetch published notifications with centralized filtering based on REGISTERED profiles
  const { data: notifications = [], isLoading: isLoadingNotifications, refetch } = useQuery({
    queryKey: ['internal-notifications', user?.id, profilesKey],
    queryFn: async () => {
      if (!user?.id) return [];

      // Use fetched profiles or default to client-only
      const profiles: UserProfiles = userProfiles || { 
        isClient: true, 
        isProvider: false, 
        isAdmin: false 
      };

      console.log('[Notifications] Fetching with profiles:', profiles);

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

      console.log('[Notifications] Raw notifications from DB:', rawNotifs?.length || 0);

      if (!rawNotifs || rawNotifs.length === 0) {
        return [];
      }

      // Step 2 & 3: Apply centralized pipeline using REGISTERED profiles
      // THIS IS THE SINGLE SOURCE OF TRUTH
      const filteredNotifs = applyNotificationPipelineWithProfiles(rawNotifs, profiles);

      console.log('[Notifications] After pipeline filtering:', filteredNotifs.length);

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

      const profileStr = `client=${profiles.isClient}, provider=${profiles.isProvider}, admin=${profiles.isAdmin}`;
      console.log(`[Notifications] Pipeline complete: ${rawNotifs.length} raw → ${filteredNotifs.length} filtered for profiles: ${profileStr}`);

      return notificationsWithReadStatus;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
    // Prevent stale data from being shown during refetch
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  const isLoading = isLoadingProfiles || isLoadingNotifications;

  // Step 6 & 7: Badge uses SAME filtered array (not recalculated from raw)
  // CRITICAL: This ensures badge matches exactly what's in the list
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user?.id) return;

    // Use fetched profiles or default to client-only for real-time validation
    const profiles: UserProfiles = userProfiles || { 
      isClient: true, 
      isProvider: false, 
      isAdmin: false 
    };

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
          
          // CRITICAL: Validate incoming notification using REGISTERED profiles
          if (!validateIncomingNotificationWithProfiles(newNotification, profiles)) {
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
  }, [user?.id, userProfiles, refetch]);

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
    userProfiles,
  };
}
