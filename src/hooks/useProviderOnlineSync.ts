import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseProviderOnlineSyncOptions {
  userId: string | null;
  isOnline: boolean;
  hasLocation: boolean;
  onStatusLost?: () => void;
  onReconnected?: () => void;
}

// Verify interval: every 10 seconds verify status is still correct in DB
const SYNC_INTERVAL_MS = 10 * 1000;

// Heartbeat: explicit ping every 8 seconds while ONLINE
const HEARTBEAT_INTERVAL_MS = 8 * 1000;

/**
 * Hook to ensure provider online status stays synchronized with database.
 * Prevents \"ghost providers\" that appear online but are actually disconnected.
 * Also handles reconnection when app returns from background.
 */
export function useProviderOnlineSync({
  userId,
  isOnline,
  hasLocation,
  onStatusLost,
  onReconnected
}: UseProviderOnlineSyncOptions) {
  const lastKnownOnlineRef = useRef(isOnline);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  // Verify that DB status matches local state
  const verifyStatus = useCallback(async () => {
    if (!userId || !isOnline) return;

    try {
      const { data, error } = await supabase
        .from('provider_data')
        .select('is_online, current_lat, current_lng, updated_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.warn('[OnlineSync] Error verifying status:', error);
        return;
      }

      // If DB says we're offline but we think we're online, something is wrong
      if (data && !data.is_online && isOnline) {
        console.warn('[OnlineSync] Status mismatch detected! DB says offline, local says online');
        onStatusLost?.();
      }

      // If we're online but have no location, we're invisible to clients
      if (data && data.is_online && (!data.current_lat || !data.current_lng)) {
        console.warn('[OnlineSync] Online but missing location - invisible to clients!');
      }

      console.log('[OnlineSync] Status verified:', {
        dbOnline: data?.is_online,
        localOnline: isOnline,
        hasDbLocation: !!(data?.current_lat && data?.current_lng),
        hasLocalLocation: hasLocation
      });
    } catch (err) {
      console.error('[OnlineSync] Verification failed:', err);
    }
  }, [userId, isOnline, hasLocation, onStatusLost]);

  // Send heartbeat via backend (single source of truth)
  const sendHeartbeat = useCallback(async () => {
    if (!userId || !isOnline) return;

    try {
      const { data, error } = await supabase.functions.invoke('provider-heartbeat', {
        body: {},
      });

      if (error) {
        console.warn('[OnlineSync] Heartbeat failed:', error);
        return;
      }

      console.log('[OnlineSync] Heartbeat sent (backend)', data);
    } catch (err) {
      console.warn('[OnlineSync] Heartbeat failed:', err);
    }
  }, [userId, isOnline]);

  // Handle visibility change (app coming back from background)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && isOnline && userId) {
      console.log('[OnlineSync] App became visible, verifying status...');
      
      // Immediate verification
      verifyStatus();
      
      // Re-establish real-time connection
      const channel = supabase.channel('provider-reconnect-check');
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[OnlineSync] Real-time connection re-established');
          supabase.removeChannel(channel);
          onReconnected?.();
        }
      });
    }
  }, [isOnline, userId, verifyStatus, onReconnected]);

  // Start/stop sync based on online status
  useEffect(() => {
    // Clean up existing intervals
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (!userId || !isOnline) {
      return;
    }

    console.log('[OnlineSync] Starting sync for online provider');

    // Initial verification
    verifyStatus();

    // Periodic verification
    syncIntervalRef.current = setInterval(verifyStatus, SYNC_INTERVAL_MS);

    // Heartbeat to prove we're active
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [userId, isOnline, verifyStatus, sendHeartbeat]);

  // Handle visibility changes
  useEffect(() => {
    // Remove old handler if exists
    if (visibilityHandlerRef.current) {
      document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
    }

    // Add new handler
    visibilityHandlerRef.current = handleVisibilityChange;
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      }
    };
  }, [handleVisibilityChange]);

  // Track online state changes
  useEffect(() => {
    if (lastKnownOnlineRef.current !== isOnline) {
      console.log('[OnlineSync] Online state changed:', lastKnownOnlineRef.current, '->', isOnline);
      lastKnownOnlineRef.current = isOnline;
    }
  }, [isOnline]);

  return {
    verifyStatus,
    sendHeartbeat
  };
}
