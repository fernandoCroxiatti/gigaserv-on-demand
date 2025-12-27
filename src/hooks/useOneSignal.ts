import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import {
  initOneSignal,
  oneSignalLogin,
  oneSignalLogout,
  requestOneSignalPermission,
  isOneSignalPermissionGranted,
  setOneSignalTags,
  addOneSignalNotificationListener,
  getOneSignalPlayerId,
} from '@/lib/oneSignal';
import { supabase } from '@/integrations/supabase/client';

interface UseOneSignalOptions {
  activeProfile?: 'client' | 'provider';
}

/**
 * Hook to manage OneSignal push notifications
 * - Initializes OneSignal on mount
 * - Associates user ID after login
 * - Handles permission requests
 * - Sets user tags for segmentation
 */
export function useOneSignal(options?: UseOneSignalOptions) {
  const { user } = useAuth();
  const activeProfile = options?.activeProfile;
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [isReady, setIsReady] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  const hasLoggedInRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const permissionRequestedRef = useRef(false);

  // Initialize OneSignal on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await initOneSignal();
        if (mounted) {
          setIsReady(true);
          
          // Check current permission
          const granted = await isOneSignalPermissionGranted();
          setPermission(granted ? 'granted' : 'default');
          
          // Get player ID if available
          const id = await getOneSignalPlayerId();
          if (id) setPlayerId(id);
        }
      } catch (error) {
        console.error('[useOneSignal] Init error:', error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Handle user login/logout
  useEffect(() => {
    if (!isReady) return;

    const handleUserChange = async () => {
      // User logged out
      if (!user?.id && lastUserIdRef.current) {
        console.log('[useOneSignal] User logged out, calling oneSignalLogout');
        lastUserIdRef.current = null;
        hasLoggedInRef.current = false;
        permissionRequestedRef.current = false;
        await oneSignalLogout();
        return;
      }

      // User logged in (new user)
      if (user?.id && user.id !== lastUserIdRef.current) {
        console.log('[useOneSignal] User logged in:', user.id);
        lastUserIdRef.current = user.id;
        hasLoggedInRef.current = true;
        
        // Login to OneSignal with user ID
        await oneSignalLogin(user.id);
        
        // Set user tags for segmentation
        const tags: Record<string, string> = {
          user_id: user.id,
        };
        
        // Add profile type tag
        if (activeProfile) {
          tags.profile_type = activeProfile;
        }
        
        await setOneSignalTags(tags);
        
        // Get and save player ID
        const id = await getOneSignalPlayerId();
        if (id) {
          setPlayerId(id);
          
          // Save player ID to database for backend notifications
          await supabase
            .from('notification_subscriptions')
            .upsert({
              user_id: user.id,
              endpoint: `onesignal://${id}`,
              p256dh: 'onesignal',
              auth: 'onesignal',
              user_agent: navigator.userAgent,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,endpoint',
            });
        }
      }
    };

    handleUserChange();
  }, [isReady, user?.id, activeProfile]);

  // Request permission - call this after explicit user action
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (permissionRequestedRef.current) {
      console.log('[useOneSignal] Permission already requested this session');
      return permission === 'granted';
    }
    
    console.log('[useOneSignal] Requesting permission...');
    permissionRequestedRef.current = true;
    
    const granted = await requestOneSignalPermission();
    setPermission(granted ? 'granted' : 'denied');
    
    // Update player ID after permission grant
    if (granted) {
      const id = await getOneSignalPlayerId();
      if (id) {
        setPlayerId(id);
        
        // Save to database
        if (user?.id) {
          await supabase
            .from('notification_subscriptions')
            .upsert({
              user_id: user.id,
              endpoint: `onesignal://${id}`,
              p256dh: 'onesignal',
              auth: 'onesignal',
              user_agent: navigator.userAgent,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,endpoint',
            });
        }
      }
      
      // Update preferences in database
      if (user?.id) {
        await supabase
          .from('notification_preferences')
          .upsert({
            user_id: user.id,
            permission_asked_at: new Date().toISOString(),
            permission_granted: true,
            enabled: true,
          }, {
            onConflict: 'user_id',
          });
      }
    }
    
    return granted;
  }, [permission, user?.id]);

  // Setup notification click listener for navigation
  useEffect(() => {
    if (!isReady) return;

    const handleClick = (event: unknown) => {
      console.log('[useOneSignal] Notification clicked:', event);
      // Navigation is handled automatically by OneSignal via data.url
    };

    addOneSignalNotificationListener('click', handleClick);

    // Note: OneSignal SDK doesn't provide a clean way to remove listeners,
    // but listeners are typically not duplicated
  }, [isReady]);

  return {
    isReady,
    permission,
    playerId,
    requestPermission,
    isPermissionGranted: permission === 'granted',
  };
}
