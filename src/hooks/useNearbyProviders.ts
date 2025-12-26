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
const REFRESH_INTERVAL = 5000; // 5 seconds

export function useNearbyProviders({ 
  userLocation, 
  radiusKm = DEFAULT_RADIUS,
  enabled = true 
}: UseNearbyProvidersOptions) {
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch providers within radius
  const fetchProviders = useCallback(async () => {
    if (!userLocation || !enabled) {
      console.log('[NearbyProviders] Skipping fetch - no location or disabled');
      return;
    }

    console.log(`[NearbyProviders] Fetching online providers within ${radiusKm}km from:`, {
      lat: userLocation.lat,
      lng: userLocation.lng
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

      console.log(`[NearbyProviders] Found ${providerData?.length || 0} online providers with location`);

      if (!providerData || providerData.length === 0) {
        console.log('[NearbyProviders] No online providers with valid location');
        setProviders([]);
        setLoading(false);
        return;
      }

      // Fetch profile names
      const userIds = providerData.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.name]) || []);

      // Filter by distance
      const filteredProviders: NearbyProvider[] = [];
      
      for (const provider of providerData) {
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
      console.log(`[NearbyProviders] Found ${filteredProviders.length} providers`);
    } catch (error) {
      console.error('[NearbyProviders] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [userLocation, radiusKm, enabled]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!userLocation || !enabled) return;

    // Initial fetch
    fetchProviders();

    // Real-time subscription
    const channel = supabase
      .channel('nearby-providers-realtime')
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
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userLocation, radiusKm, enabled, fetchProviders]);

  return {
    providers,
    loading,
    refresh: fetchProviders,
  };
}
