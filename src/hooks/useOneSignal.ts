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
  addSubscriptionChangeListener,
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
  const saveAttemptRef = useRef(0);

  // Save player ID to database
  const savePlayerIdToDatabase = useCallback(async (userId: string, playerIdToSave: string) => {
    try {
      console.log('[useOneSignal] Saving playerId to database:', { userId, playerId: playerIdToSave });
      
      const endpoint = `onesignal://${playerIdToSave}`;
      
      const { error } = await supabase
        .from('notification_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: endpoint,
          p256dh: 'onesignal',
          auth: 'onesignal',
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,endpoint',
        });
      
      if (error) {
        console.error('[useOneSignal] Error saving playerId to database:', error);
        return false;
      }
      
      console.log('[useOneSignal] PlayerId saved successfully to database');
      return true;
    } catch (error) {
      console.error('[useOneSignal] Exception saving playerId:', error);
      return false;
    }
  }, []);

  // Poll for player ID with retries
  const pollForPlayerId = useCallback(async (userId: string, maxAttempts = 10): Promise<string | null> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[useOneSignal] Polling for playerId, attempt ${attempt}/${maxAttempts}`);
      
      const id = await getOneSignalPlayerId();
      
      if (id) {
        console.log('[useOneSignal] Got playerId:', id);
        setPlayerId(id);
        
        // Save to database
        const saved = await savePlayerIdToDatabase(userId, id);
        if (saved) {
          return id;
        }
      }
      
      // Wait before next attempt (exponential backoff)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempt, 5000)));
      }
    }
    
    console.warn('[useOneSignal] Failed to get playerId after max attempts');
    return null;
  }, [savePlayerIdToDatabase]);

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
          if (id) {
            console.log('[useOneSignal] Initial playerId:', id);
            setPlayerId(id);
          }
          
          // Listen for subscription changes to capture playerId
          addSubscriptionChangeListener(async (newId) => {
            if (mounted && newId) {
              console.log('[useOneSignal] Subscription changed, new playerId:', newId);
              setPlayerId(newId);
              
              // Save to database if user is logged in
              if (lastUserIdRef.current) {
                await savePlayerIdToDatabase(lastUserIdRef.current, newId);
              }
            }
          });
        }
      } catch (error) {
        console.error('[useOneSignal] Init error:', error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [savePlayerIdToDatabase]);

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
        saveAttemptRef.current = 0;
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
        
        // Try to get and save player ID immediately
        const currentPlayerId = await getOneSignalPlayerId();
        if (currentPlayerId) {
          console.log('[useOneSignal] PlayerId available on login:', currentPlayerId);
          setPlayerId(currentPlayerId);
          await savePlayerIdToDatabase(user.id, currentPlayerId);
        } else {
          // Poll for player ID in background (may not be available immediately)
          console.log('[useOneSignal] PlayerId not available yet, starting poll...');
          pollForPlayerId(user.id, 5);
        }
      }
    };

    handleUserChange();
  }, [isReady, user?.id, activeProfile, savePlayerIdToDatabase, pollForPlayerId]);

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
    if (granted && user?.id) {
      console.log('[useOneSignal] Permission granted, polling for playerId...');
      
      // Give OneSignal time to generate the subscription
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Poll with more attempts after permission grant
      const id = await pollForPlayerId(user.id, 10);
      
      if (id) {
        // Update preferences in database
        const { error: prefError } = await supabase
          .from('notification_preferences')
          .upsert({
            user_id: user.id,
            permission_asked_at: new Date().toISOString(),
            permission_granted: true,
            enabled: true,
            chamado_updates: true,
            promotional: true,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });
        
        if (prefError) {
          console.error('[useOneSignal] Error saving preferences:', prefError);
        } else {
          console.log('[useOneSignal] Preferences saved successfully');
        }
      }
    }
    
    return granted;
  }, [permission, user?.id, pollForPlayerId]);

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
