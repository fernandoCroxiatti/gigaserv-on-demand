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

// Heartbeat with location: every 10 seconds while ONLINE
const HEARTBEAT_INTERVAL_MS = 10 * 1000;

// Minimum distance change (meters) to trigger immediate location update
const MIN_DISTANCE_CHANGE_METERS = 50;

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Hook to ensure provider online status stays synchronized with database.
 * Sends GPS location with every heartbeat to keep provider position updated.
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
  const watchIdRef = useRef<number | null>(null);
  const lastSentLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  // Get current GPS position
  const getCurrentPosition = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('[OnlineSync] Geolocation not available');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('[OnlineSync] Geolocation error:', error.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );
    });
  }, []);

  // Send heartbeat with GPS location to backend
  const sendHeartbeatWithLocation = useCallback(async () => {
    if (!userId || !isOnline) return;

    try {
      const location = await getCurrentPosition();
      
      const body: { location?: { lat: number; lng: number } } = {};
      if (location) {
        body.location = location;
        lastSentLocationRef.current = location;
        console.log('[OnlineSync] Sending heartbeat with location:', location);
      } else {
        console.log('[OnlineSync] Sending heartbeat without location (GPS unavailable)');
      }

      const { data, error } = await supabase.functions.invoke('provider-heartbeat', {
        body,
      });

      if (error) {
        console.warn('[OnlineSync] Heartbeat failed:', error);
        return;
      }

      console.log('[OnlineSync] Heartbeat sent successfully', data);
    } catch (err) {
      console.warn('[OnlineSync] Heartbeat failed:', err);
    }
  }, [userId, isOnline, getCurrentPosition]);

  // Send immediate location update if position changed significantly
  const sendImmediateLocationUpdate = useCallback(async (lat: number, lng: number) => {
    if (!userId || !isOnline) return;

    // Check if position changed significantly
    if (lastSentLocationRef.current) {
      const distance = calculateDistance(
        lastSentLocationRef.current.lat,
        lastSentLocationRef.current.lng,
        lat,
        lng
      );
      if (distance < MIN_DISTANCE_CHANGE_METERS) {
        return; // Not enough movement
      }
    }

    try {
      console.log('[OnlineSync] Significant movement detected, sending immediate update');
      
      const { error } = await supabase.functions.invoke('provider-heartbeat', {
        body: { location: { lat, lng } },
      });

      if (!error) {
        lastSentLocationRef.current = { lat, lng };
      }
    } catch (err) {
      console.warn('[OnlineSync] Immediate location update failed:', err);
    }
  }, [userId, isOnline]);

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

      if (data && !data.is_online && isOnline) {
        console.warn('[OnlineSync] Status mismatch! DB says offline, local says online');
        onStatusLost?.();
      }

      if (data && data.is_online && (!data.current_lat || !data.current_lng)) {
        console.warn('[OnlineSync] Online but missing location - invisible to clients!');
        // Force send location immediately
        sendHeartbeatWithLocation();
      }

      console.log('[OnlineSync] Status verified:', {
        dbOnline: data?.is_online,
        dbLocation: data?.current_lat && data?.current_lng ? `${data.current_lat},${data.current_lng}` : 'none',
        updatedAt: data?.updated_at
      });
    } catch (err) {
      console.error('[OnlineSync] Verification failed:', err);
    }
  }, [userId, isOnline, onStatusLost, sendHeartbeatWithLocation]);

  // Handle visibility change (app coming back from background)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && isOnline && userId) {
      console.log('[OnlineSync] App became visible, sending immediate heartbeat with location...');
      
      // Immediate heartbeat with fresh location
      sendHeartbeatWithLocation();
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
  }, [isOnline, userId, verifyStatus, sendHeartbeatWithLocation, onReconnected]);

  // Start continuous GPS watch when online
  useEffect(() => {
    if (!userId || !isOnline || !navigator.geolocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    console.log('[OnlineSync] Starting GPS watch for provider');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        sendImmediateLocationUpdate(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.warn('[OnlineSync] GPS watch error:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [userId, isOnline, sendImmediateLocationUpdate]);

  // Start/stop sync based on online status
  useEffect(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (!userId || !isOnline) {
      lastSentLocationRef.current = null;
      return;
    }

    console.log('[OnlineSync] Starting sync with location for online provider');

    // Send initial heartbeat with location immediately
    sendHeartbeatWithLocation();
    verifyStatus();

    // Periodic verification
    syncIntervalRef.current = setInterval(verifyStatus, SYNC_INTERVAL_MS);

    // Periodic heartbeat with location
    heartbeatIntervalRef.current = setInterval(sendHeartbeatWithLocation, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [userId, isOnline, verifyStatus, sendHeartbeatWithLocation]);

  // Handle visibility changes
  useEffect(() => {
    if (visibilityHandlerRef.current) {
      document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
    }

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
      
      // Clear last sent location when going offline
      if (!isOnline) {
        lastSentLocationRef.current = null;
      }
    }
  }, [isOnline]);

  return {
    verifyStatus,
    sendHeartbeat: sendHeartbeatWithLocation
  };
}
