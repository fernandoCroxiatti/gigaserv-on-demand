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
}

interface UseNearbyProvidersOptions {
  userLocation: Location | null;
  radiusKm?: number;
  enabled?: boolean;
}

const DEFAULT_RADIUS = 15; // km
const REFRESH_INTERVAL = 10000; // 10 seconds - periodic refresh for cross-platform sync
const STALE_PROVIDER_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes - providers without heartbeat

export function useNearbyProviders({ 
  userLocation, 
  radiusKm = DEFAULT_RADIUS,
  enabled = true 
}: UseNearbyProvidersOptions) {
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  // Fetch providers within radius - GLOBAL, no platform filtering
  const fetchProviders = useCallback(async () => {
    if (!userLocation || !enabled) {
      console.log('[NearbyProviders] Skipping fetch - no location or disabled');
      return;
    }

    const now = Date.now();
    console.log(`[NearbyProviders] Fetching online providers within ${radiusKm}km from:`, {
      lat: userLocation.lat,
      lng: userLocation.lng,
      timestamp: new Date().toISOString()
    });
    setLoading(true);

    try {
      // First, let's check ALL providers to debug
      const { data: allProviders } = await supabase
        .from('provider_data')
        .select('user_id, is_online, current_lat, current_lng')
        .limit(20);
      
      console.log('[NearbyProviders] All providers in DB:', allProviders?.map(p => ({
        id: p.user_id.substring(0, 8),
        online: p.is_online,
        hasLocation: !!(p.current_lat && p.current_lng)
      })));

      // Fetch online providers with valid location
      const { data: providerData, error } = await supabase
        .from('provider_data')
        .select(`
          user_id,
          current_lat,
          current_lng,
          current_address,
          rating,
          total_services,
          services_offered,
          is_online,
          updated_at
        `)
        .eq('is_online', true)
        .not('current_lat', 'is', null)
        .not('current_lng', 'is', null);

      if (error) {
        console.error('[NearbyProviders] Error fetching providers:', error);
        setLoading(false);
        return;
      }

      // Filter out stale providers (no heartbeat in last 5 minutes)
      const now = new Date();
      const activeProviders = providerData?.filter(p => {
        if (!p.updated_at) return false;
        const lastUpdate = new Date(p.updated_at);
        const ageMs = now.getTime() - lastUpdate.getTime();
        const isActive = ageMs < STALE_PROVIDER_THRESHOLD_MS;
        if (!isActive) {
          console.log(`[NearbyProviders] Filtering stale provider ${p.user_id.substring(0, 8)} - last update ${Math.round(ageMs / 1000)}s ago`);
        }
        return isActive;
      }) || [];

      console.log(`[NearbyProviders] Found ${activeProviders.length} active online providers (from ${providerData?.length || 0} total)`);

      if (activeProviders.length === 0) {
        console.log('[NearbyProviders] No active online providers with valid location');
        setProviders([]);
        setLoading(false);
        return;
      }

      // Fetch profile names
      const userIds = activeProviders.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.name]) || []);

      // Filter by distance - NO platform filtering, purely geographic
      const filteredProviders: NearbyProvider[] = [];
      
      for (const provider of activeProviders) {
        if (!provider.current_lat || !provider.current_lng) continue;

        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          Number(provider.current_lat),
          Number(provider.current_lng)
        );

        if (distance <= radiusKm) {
          filteredProviders.push({
            id: provider.user_id,
            userId: provider.user_id,
            name: profileMap.get(provider.user_id) || 'Prestador',
            location: {
              lat: Number(provider.current_lat),
              lng: Number(provider.current_lng),
              address: provider.current_address || 'Localização',
            },
            distance,
            rating: Number(provider.rating) || 5.0,
            totalServices: provider.total_services || 0,
            services: (provider.services_offered as ServiceType[]) || ['guincho'],
          });
        }
      }

      // Sort by distance
      filteredProviders.sort((a, b) => a.distance - b.distance);
      setProviders(filteredProviders);
      console.log(`[NearbyProviders] ✅ ${filteredProviders.length} providers within range (global, cross-platform)`);
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

  // Subscribe to real-time updates with cross-platform support
  useEffect(() => {
    if (!userLocation || !enabled) {
      // Cleanup when disabled
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchProviders();

    // Periodic refresh to catch cross-platform updates that realtime might miss
    refreshIntervalRef.current = setInterval(() => {
      console.log('[NearbyProviders] Periodic refresh for cross-platform sync');
      fetchProviders();
    }, REFRESH_INTERVAL);

    // Real-time subscription for immediate updates
    const channel = supabase
      .channel(`nearby-providers-${Date.now()}`) // Unique channel name to avoid conflicts
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_data',
        },
        async (payload) => {
          console.log('[NearbyProviders] Real-time update:', payload.eventType, 'from global DB');
          
          const data = payload.new as any;
          
          if (payload.eventType === 'DELETE' || !data?.is_online) {
            setProviders(prev => prev.filter(p => p.userId !== data?.user_id));
            return;
          }

          if (!data.current_lat || !data.current_lng) return;

          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            Number(data.current_lat),
            Number(data.current_lng)
          );

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
    };
  }, [userLocation, radiusKm, enabled, fetchProviders]);

  // Visibility change handler for background/foreground transitions
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

  return {
    providers,
    loading,
    refresh: fetchProviders,
  };
}
