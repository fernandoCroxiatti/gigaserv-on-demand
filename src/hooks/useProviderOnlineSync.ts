import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseProviderOnlineSyncOptions {
  userId: string | null;
  isOnline: boolean;
  hasLocation: boolean;
  onStatusLost?: () => void;
  onReconnected?: () => void;
}

// Heartbeat interval: every 30 seconds while ONLINE (reduced from 10s - less aggressive)
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

// Minimum distance change (meters) to trigger immediate location update
const MIN_DISTANCE_CHANGE_METERS = 50;

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Hook to send periodic heartbeats with GPS location while provider is online.
 * 
 * IMPORTANT: This hook ONLY sends heartbeats when isOnline=true.
 * It does NOT force provider online - manual toggle has priority.
 */
export function useProviderOnlineSync({
  userId,
  isOnline,
  hasLocation,
  onStatusLost,
  onReconnected
}: UseProviderOnlineSyncOptions) {
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const isActiveRef = useRef(false);

  // Get current GPS position
  const getCurrentPosition = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
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
        () => {
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
    // CRITICAL: Only send heartbeat if provider is actively online
    if (!userId || !isOnline || !isActiveRef.current) {
      console.log('[OnlineSync] Skipping heartbeat - not active or not online');
      return;
    }

    try {
      // Check session before sending
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        console.log('[OnlineSync] No session - skipping heartbeat');
        return;
      }

      const location = await getCurrentPosition();
      
      const body: { location?: { lat: number; lng: number } } = {};
      if (location) {
        body.location = location;
        lastSentLocationRef.current = location;
      }

      const { error } = await supabase.functions.invoke('provider-heartbeat', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body,
      });

      if (error) {
        console.warn('[OnlineSync] Heartbeat failed:', error);
      } else {
        console.log('[OnlineSync] Heartbeat sent');
      }
    } catch (err) {
      // Silent failure - don't spam user with errors
      console.warn('[OnlineSync] Heartbeat exception:', err);
    }
  }, [userId, isOnline, getCurrentPosition]);

  // Send immediate location update if position changed significantly
  const sendImmediateLocationUpdate = useCallback(async (lat: number, lng: number) => {
    if (!userId || !isOnline || !isActiveRef.current) return;

    if (lastSentLocationRef.current) {
      const distance = calculateDistance(
        lastSentLocationRef.current.lat,
        lastSentLocationRef.current.lng,
        lat,
        lng
      );
      if (distance < MIN_DISTANCE_CHANGE_METERS) {
        return;
      }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) return;

      const { error } = await supabase.functions.invoke('provider-heartbeat', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: { location: { lat, lng } },
      });

      if (!error) {
        lastSentLocationRef.current = { lat, lng };
      }
    } catch (err) {
      // Silent
    }
  }, [userId, isOnline]);

  // Handle visibility change - only send heartbeat if still online
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && isOnline && userId && isActiveRef.current) {
      console.log('[OnlineSync] App visible - sending heartbeat');
      sendHeartbeatWithLocation();
      onReconnected?.();
    }
  }, [isOnline, userId, sendHeartbeatWithLocation, onReconnected]);

  // Start continuous GPS watch when online
  useEffect(() => {
    if (!userId || !isOnline || !navigator.geolocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        sendImmediateLocationUpdate(position.coords.latitude, position.coords.longitude);
      },
      () => {},
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

  // Start/stop heartbeat based on online status
  useEffect(() => {
    // Cleanup any existing interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Only start if actually online
    if (!userId || !isOnline) {
      isActiveRef.current = false;
      lastSentLocationRef.current = null;
      console.log('[OnlineSync] Provider offline - heartbeats disabled');
      return;
    }

    isActiveRef.current = true;
    console.log('[OnlineSync] Provider online - starting heartbeats');

    // Send initial heartbeat
    sendHeartbeatWithLocation();

    // Periodic heartbeat
    heartbeatIntervalRef.current = setInterval(sendHeartbeatWithLocation, HEARTBEAT_INTERVAL_MS);

    return () => {
      isActiveRef.current = false;
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [userId, isOnline, sendHeartbeatWithLocation]);

  // Handle visibility changes
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  return {
    sendHeartbeat: sendHeartbeatWithLocation
  };
}
