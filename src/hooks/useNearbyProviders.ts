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
  updatedAt: number; // timestamp for TTL validation
}

interface UseNearbyProvidersOptions {
  userLocation: Location | null;
  radiusKm?: number;
  enabled?: boolean;
}

const DEFAULT_RADIUS = 15; // km
const REFRESH_INTERVAL = 5000; // 5 seconds - faster refresh for cross-platform sync
const STALE_PROVIDER_THRESHOLD_MS = 15 * 1000; // 15 seconds - must match backend timeout

export function useNearbyProviders({ 
  userLocation, 
  radiusKm = DEFAULT_RADIUS,
  enabled = true 
}: UseNearbyProvidersOptions) {
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Remove stale providers from local state (TTL cleanup)
  const cleanupStaleProviders = useCallback(() => {
    const now = Date.now();
    setProviders(prev => {
      const validProviders = prev.filter(p => {
        const age = now - p.updatedAt;
        const isValid = age < STALE_PROVIDER_THRESHOLD_MS;
        if (!isValid) {
          console.log(`[NearbyProviders] Removing stale provider ${p.name} (age: ${Math.round(age/1000)}s)`);
        }
        return isValid;
      });
      
      if (validProviders.length !== prev.length) {
        console.log(`[NearbyProviders] Cleaned up ${prev.length - validProviders.length} stale providers`);
      }
      
      return validProviders;
    });
  }, []);

  // Fetch providers - REPLACES entire list (no merge)
  const fetchProviders = useCallback(async () => {
    if (!userLocation || !enabled) {
      console.log('[NearbyProviders] Skipping fetch - no location or disabled');
      setProviders([]); // Clear providers when disabled
      return;
    }

    console.log(`[NearbyProviders] Fetching online providers within ${radiusKm}km`);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('online-providers', {
        body: {},
      });

      if (error) {
        console.error('[NearbyProviders] Error fetching providers:', error);
        setLoading(false);
        return;
      }

      const providerData = (data as any)?.providers as any[] | undefined;
      const now = Date.now();

      console.log('[NearbyProviders] Providers received:', {
        count: providerData?.length || 0,
        thresholdIso: (data as any)?.thresholdIso,
      });

      if (!providerData || providerData.length === 0) {
        console.log('[NearbyProviders] No active online providers');
        setProviders([]); // Clear all - no providers online
        setLoading(false);
        return;
      }

      // Filter by TTL and distance - STRICT validation
      const validProviders: NearbyProvider[] = [];

      for (const provider of providerData) {
        // Validate location
        if (!provider.current_lat || !provider.current_lng) {
          continue;
        }

        // Validate TTL (15s threshold)
        if (!provider.updated_at) {
          continue;
        }
        
        const lastUpdate = new Date(provider.updated_at).getTime();
        const age = now - lastUpdate;
        
        if (age >= STALE_PROVIDER_THRESHOLD_MS) {
          console.log(`[NearbyProviders] Skipping stale provider (age: ${Math.round(age/1000)}s)`);
          continue;
        }

        // Calculate distance
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          Number(provider.current_lat),
          Number(provider.current_lng)
        );

        // Filter by radius
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

      // Sort by distance and REPLACE entire list
      validProviders.sort((a, b) => a.distance - b.distance);
      setProviders(validProviders);
      
      console.log(`[NearbyProviders] ✅ ${validProviders.length} valid providers within ${radiusKm}km`);
    } catch (error) {
      console.error('[NearbyProviders] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [userLocation, radiusKm, enabled]);

  // Handle visibility change - force refresh when app becomes visible
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && enabled && userLocation) {
      console.log('[NearbyProviders] App became visible, forcing refresh...');
      fetchProviders();
    }
  }, [enabled, userLocation, fetchProviders]);

  // Main effect - setup polling and real-time
  useEffect(() => {
    if (!userLocation || !enabled) {
      // Cleanup when disabled
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
      setProviders([]); // Clear providers when disabled
      return;
    }

    // Initial fetch
    fetchProviders();

    // Periodic refresh - PRIMARY source of truth (every 5 seconds)
    refreshIntervalRef.current = setInterval(() => {
      console.log('[NearbyProviders] Periodic refresh');
      fetchProviders();
    }, REFRESH_INTERVAL);

    // TTL cleanup - runs more frequently to catch stale providers quickly
    cleanupIntervalRef.current = setInterval(() => {
      cleanupStaleProviders();
    }, 2000); // Every 2 seconds

    // Real-time subscription - COMPLEMENT only (for instant updates)
    const channel = supabase
      .channel(`nearby-providers-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_data',
        },
        async (payload) => {
          console.log('[NearbyProviders] Real-time update:', payload.eventType);
          
          const data = payload.new as any;
          const now = Date.now();
          
          // Handle DELETE or offline status
          if (payload.eventType === 'DELETE' || !data?.is_online) {
            setProviders(prev => {
              const filtered = prev.filter(p => p.userId !== data?.user_id);
              if (filtered.length !== prev.length) {
                console.log(`[NearbyProviders] Provider went offline, removed from map`);
              }
              return filtered;
            });
            return;
          }

          // Validate location
          if (!data.current_lat || !data.current_lng) {
            return;
          }

          // Validate TTL
          if (!data.updated_at) {
            return;
          }
          
          const lastUpdate = new Date(data.updated_at).getTime();
          const age = now - lastUpdate;
          
          if (age >= STALE_PROVIDER_THRESHOLD_MS) {
            // Remove stale provider if exists
            setProviders(prev => prev.filter(p => p.userId !== data.user_id));
            return;
          }

          // Calculate distance
          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            Number(data.current_lat),
            Number(data.current_lng)
          );

          // Filter by radius
          if (distance > radiusKm) {
            setProviders(prev => prev.filter(p => p.userId !== data.user_id));
            return;
          }

          // Get provider name
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('user_id', data.user_id)
            .single();

          const updatedProvider: NearbyProvider = {
            id: data.user_id,
            userId: data.user_id,
            name: profile?.name || 'Prestador',
            location: {
              lat: Number(data.current_lat),
              lng: Number(data.current_lng),
              address: data.current_address || 'Localização',
            },
            distance,
            rating: Number(data.rating) || 5.0,
            totalServices: data.total_services || 0,
            services: (data.services_offered as ServiceType[]) || ['guincho'],
            updatedAt: lastUpdate,
          };

          setProviders(prev => {
            const existing = prev.findIndex(p => p.userId === data.user_id);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = updatedProvider;
              return updated.sort((a, b) => a.distance - b.distance);
            } else {
              return [...prev, updatedProvider].sort((a, b) => a.distance - b.distance);
            }
          });
        }
      )
      .subscribe((status) => {
        console.log('[NearbyProviders] Realtime subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
    };
  }, [userLocation, radiusKm, enabled, fetchProviders, cleanupStaleProviders]);

  // Visibility change handler
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  return {
    providers,
    loading,
    refresh: fetchProviders,
  };
}
