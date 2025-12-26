import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Location, ServiceType } from '@/types/chamado';
import { calculateDistance } from '@/lib/distance';

export interface NearbyProvider {
  id: string;
  userId: string;
  name: string;
  location: Location;
  distance: number;
  rating: number;
  totalServices: number;
  services: ServiceType[];
  updatedAt: number;
}

interface UseNearbyProvidersOptions {
  userLocation: Location | null;
  radiusKm?: number;
  enabled?: boolean;
}

const DEFAULT_RADIUS = 15; // km
const REFRESH_INTERVAL = 5000; // 5 seconds
const STALE_PROVIDER_THRESHOLD_MS = 15 * 1000; // 15 seconds - must match backend timeout

/**
 * DESTRUCTIVE RENDERING PATTERN
 * 
 * This hook uses the backend as the SINGLE SOURCE OF TRUTH.
 * Every refresh COMPLETELY REPLACES the provider list.
 * NO realtime subscriptions - only polling.
 * NO incremental updates - full replacement.
 * NO local cache - always fresh from backend.
 */
export function useNearbyProviders({ 
  userLocation, 
  radiusKm = DEFAULT_RADIUS,
  enabled = true 
}: UseNearbyProvidersOptions) {
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const fetchInProgressRef = useRef(false);

  // TOTAL STATE RESET - called on mount and visibility change
  const resetState = useCallback(() => {
    console.log('[NearbyProviders] RESET - Clearing all state');
    setProviders([]);
    setLastFetchTime(0);
    fetchInProgressRef.current = false;
  }, []);

  // Fetch providers - DESTRUCTIVE: REPLACES entire list
  const fetchProviders = useCallback(async () => {
    if (!userLocation || !enabled) {
      console.log('[NearbyProviders] Fetch skipped - disabled or no location');
      setProviders([]);
      return;
    }

    // Prevent concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('[NearbyProviders] Fetch already in progress, skipping');
      return;
    }

    fetchInProgressRef.current = true;
    const fetchId = Date.now();
    console.log(`[NearbyProviders] Fetch #${fetchId} - Starting...`);

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('online-providers', {
        body: {},
      });

      // Check if component still mounted
      if (!isMountedRef.current) {
        console.log(`[NearbyProviders] Fetch #${fetchId} - Component unmounted, discarding`);
        return;
      }

      if (error) {
        console.error(`[NearbyProviders] Fetch #${fetchId} - Error:`, error);
        // On error, clear providers to avoid stale data
        setProviders([]);
        return;
      }

      const providerData = (data as any)?.providers as any[] | undefined;
      const now = Date.now();

      console.log(`[NearbyProviders] Fetch #${fetchId} - Received ${providerData?.length || 0} raw providers`);

      if (!providerData || providerData.length === 0) {
        console.log(`[NearbyProviders] Fetch #${fetchId} - No providers, clearing list`);
        setProviders([]); // DESTRUCTIVE: Clear all
        setLastFetchTime(now);
        return;
      }

      // Build new provider list from scratch - NO merging
      const validProviders: NearbyProvider[] = [];

      for (const provider of providerData) {
        // STRICT validation - skip invalid entries
        if (!provider.current_lat || !provider.current_lng) {
          console.log(`[NearbyProviders] Skipping provider - no location`);
          continue;
        }

        if (!provider.updated_at) {
          console.log(`[NearbyProviders] Skipping provider - no updated_at`);
          continue;
        }

        // TTL validation - 15 second threshold
        const lastUpdate = new Date(provider.updated_at).getTime();
        const age = now - lastUpdate;
        
        if (age >= STALE_PROVIDER_THRESHOLD_MS) {
          console.log(`[NearbyProviders] Skipping stale provider (age: ${Math.round(age/1000)}s)`);
          continue;
        }

        // Distance validation
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          Number(provider.current_lat),
          Number(provider.current_lng)
        );

        if (distance > radiusKm) {
          continue;
        }

        validProviders.push({
          id: provider.user_id,
          userId: provider.user_id,
          name: provider.profiles?.name || 'Prestador',
          location: {
            lat: Number(provider.current_lat),
            lng: Number(provider.current_lng),
            address: provider.current_address || 'Localização',
          },
          distance,
          rating: Number(provider.rating) || 5.0,
          totalServices: provider.total_services || 0,
          services: (provider.services_offered as ServiceType[]) || ['guincho'],
          updatedAt: lastUpdate,
        });
      }

      // Sort by distance
      validProviders.sort((a, b) => a.distance - b.distance);

      // DESTRUCTIVE: Replace entire list atomically
      console.log(`[NearbyProviders] Fetch #${fetchId} - Setting ${validProviders.length} valid providers`);
      setProviders(validProviders);
      setLastFetchTime(now);

    } catch (error) {
      console.error(`[NearbyProviders] Fetch #${fetchId} - Exception:`, error);
      // On exception, clear to avoid stale data
      setProviders([]);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [userLocation, radiusKm, enabled]);

  // Handle visibility change - FORCE RESET + REFETCH
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[NearbyProviders] App became visible - RESETTING and refetching');
        resetState();
        // Small delay to ensure state is cleared
        setTimeout(() => {
          if (isMountedRef.current && enabled && userLocation) {
            fetchProviders();
          }
        }, 100);
      } else {
        // When going to background, clear state to prevent stale data on return
        console.log('[NearbyProviders] App going to background - clearing state');
        setProviders([]);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resetState, fetchProviders, enabled, userLocation]);

  // Handle online/offline network events
  useEffect(() => {
    const handleOnline = () => {
      console.log('[NearbyProviders] Network online - refetching');
      resetState();
      setTimeout(() => {
        if (isMountedRef.current && enabled && userLocation) {
          fetchProviders();
        }
      }, 100);
    };

    const handleOffline = () => {
      console.log('[NearbyProviders] Network offline - clearing state');
      setProviders([]);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [resetState, fetchProviders, enabled, userLocation]);

  // Main effect - setup polling (NO REALTIME)
  useEffect(() => {
    isMountedRef.current = true;

    if (!userLocation || !enabled) {
      console.log('[NearbyProviders] Disabled or no location - clearing');
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      setProviders([]);
      return;
    }

    console.log('[NearbyProviders] Mounting - RESET and initial fetch');
    
    // RESET on mount
    resetState();

    // Initial fetch after reset
    const initialFetchTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        fetchProviders();
      }
    }, 100);

    // Setup polling interval - PRIMARY source of truth
    refreshIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        console.log('[NearbyProviders] Polling tick');
        fetchProviders();
      }
    }, REFRESH_INTERVAL);

    return () => {
      console.log('[NearbyProviders] Unmounting - cleanup');
      isMountedRef.current = false;
      clearTimeout(initialFetchTimeout);
      
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [userLocation?.lat, userLocation?.lng, radiusKm, enabled, fetchProviders, resetState]);

  return {
    providers,
    loading,
    lastFetchTime,
    refresh: fetchProviders,
    reset: resetState,
  };
}
