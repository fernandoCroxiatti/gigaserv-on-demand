import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface NotificationStatus {
  isEnabled: boolean;
  browserPermission: 'granted' | 'denied' | 'default' | 'unsupported';
  hasSubscription: boolean;
  loading: boolean;
  refetch: () => void;
}

/**
 * Hook to check the real notification status
 * 
 * CRITICAL: Only considers user as "enabled" if they have a subscription in the database
 * Browser permission alone is NOT enough - we need the playerId saved to send notifications
 */
export function useNotificationStatus(): NotificationStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<Omit<NotificationStatus, 'refetch'>>({
    isEnabled: false,
    browserPermission: 'default',
    hasSubscription: false,
    loading: true,
  });

  const checkStatus = useCallback(async () => {
    if (!user?.id) {
      setStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // Check browser permission
      const browserPermission = typeof Notification !== 'undefined' 
        ? Notification.permission 
        : 'unsupported';

      console.log('[NotificationStatus] Browser permission:', browserPermission);

      // Check for subscription in database - THIS IS THE SOURCE OF TRUTH
      const { data: subs, error } = await supabase
        .from('notification_subscriptions')
        .select('id, endpoint')
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        console.error('[NotificationStatus] Error fetching subscriptions:', error);
      }

      const hasSubscription = (subs && subs.length > 0) || false;
      
      console.log('[NotificationStatus] Has subscription in DB:', hasSubscription, subs);

      // CRITICAL: User is ONLY enabled if they have a subscription in the database
      // Browser permission alone doesn't mean we can send them notifications
      const isEnabled = browserPermission === 'granted' && hasSubscription;

      console.log('[NotificationStatus] Final status - isEnabled:', isEnabled);

      setStatus({
        isEnabled,
        browserPermission: browserPermission as NotificationStatus['browserPermission'],
        hasSubscription,
        loading: false,
      });
    } catch (error) {
      console.error('[NotificationStatus] Error checking status:', error);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  }, [user?.id]);

  useEffect(() => {
    checkStatus();

    // Re-check when visibility changes (user might have accepted notifications in another tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkStatus]);

  return { ...status, refetch: checkStatus };
}
