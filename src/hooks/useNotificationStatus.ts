import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { isOneSignalPermissionGranted } from '@/lib/oneSignal';

interface NotificationStatus {
  isEnabled: boolean;
  browserPermission: 'granted' | 'denied' | 'default' | 'unsupported';
  hasSubscription: boolean;
  loading: boolean;
}

export function useNotificationStatus(): NotificationStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<NotificationStatus>({
    isEnabled: false,
    browserPermission: 'default',
    hasSubscription: false,
    loading: true,
  });

  useEffect(() => {
    if (!user?.id) {
      setStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    const checkStatus = async () => {
      try {
        // Check browser permission
        const browserPermission = typeof Notification !== 'undefined' 
          ? Notification.permission 
          : 'unsupported';

        // Check OneSignal permission
        const oneSignalGranted = await isOneSignalPermissionGranted();

        // Check for subscription in database
        const { data: subs } = await supabase
          .from('notification_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        const hasSubscription = (subs && subs.length > 0) || false;

        // User is enabled if browser permission is granted AND (OneSignal granted OR has subscription)
        const isEnabled = browserPermission === 'granted' && (oneSignalGranted || hasSubscription);

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
    };

    checkStatus();
  }, [user?.id]);

  return status;
}
