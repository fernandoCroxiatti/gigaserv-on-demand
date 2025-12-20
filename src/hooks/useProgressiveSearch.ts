import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Location, ServiceType } from '@/types/chamado';
import { calculateDistance } from '@/lib/distance';

export type SearchState = 
  | 'idle' 
  | 'searching' 
  | 'expanding_radius' 
  | 'provider_found' 
  | 'canceled' 
  | 'timeout';

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

interface UseProgressiveSearchOptions {
  userLocation: Location | null;
  serviceType: ServiceType;
  enabled: boolean;
  /** Called externally when a provider declines/timeouts to trigger radius expansion */
  onProviderDeclined?: () => void;
}

const SEARCH_RADII = [3, 5, 10, 20, 50, 100]; // km
const EXPANSION_INTERVAL = 6000; // 6 seconds between expansions
const POSITION_UPDATE_INTERVAL = 5000; // 5 seconds for real-time position updates
// After a provider declines, wait this long before expanding radius
const DECLINE_EXPANSION_DELAY = 2000; // 2 seconds

export function useProgressiveSearch({ 
  userLocation, 
  serviceType, 
  enabled 
}: UseProgressiveSearchOptions) {
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [currentRadius, setCurrentRadius] = useState(SEARCH_RADII[0]);
  const [nearbyProviders, setNearbyProviders] = useState<NearbyProvider[]>([]);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const [declinedProviderIds, setDeclinedProviderIds] = useState<Set<string>>(new Set());
  
  const expansionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchActiveRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const radiusIndexRef = useRef(0);

  // Fetch providers within radius
  const fetchProvidersInRadius = useCallback(async (
    location: Location, 
    radiusKm: number,
    service: ServiceType
  ): Promise<NearbyProvider[]> => {
    console.log(`[ProgressiveSearch] Fetching providers within ${radiusKm}km for ${service}`);
    
    try {
      // Fetch online providers with their profile data
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
          is_online
        `)
        .eq('is_online', true)
        .not('current_lat', 'is', null)
        .not('current_lng', 'is', null);

      if (error) {
        console.error('[ProgressiveSearch] Error fetching providers:', error);
        return [];
      }

      if (!providerData || providerData.length === 0) {
        console.log('[ProgressiveSearch] No online providers found');
        return [];
      }

      // Fetch profile names
      const userIds = providerData.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.name]) || []);

      // Filter by distance, service type, and not in active service
      const filteredProviders: NearbyProvider[] = [];
      
      for (const provider of providerData) {
        if (!provider.current_lat || !provider.current_lng) continue;
        
        // Check if provider offers this service
        const servicesOffered = provider.services_offered as ServiceType[] || ['guincho'];
        if (!servicesOffered.includes(service)) {
          console.log(`[ProgressiveSearch] Provider ${provider.user_id} doesn't offer ${service}`);
          continue;
        }

        // Check if provider is in active service (has non-finished chamado)
        const { data: activeChamado } = await supabase
          .from('chamados')
          .select('id')
          .eq('prestador_id', provider.user_id)
          .in('status', ['accepted', 'negotiating', 'awaiting_payment', 'in_service'])
          .limit(1);

        if (activeChamado && activeChamado.length > 0) {
          console.log(`[ProgressiveSearch] Provider ${provider.user_id} is in active service`);
          continue;
        }

        const distance = calculateDistance(
          location.lat,
          location.lng,
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
              address: provider.current_address || 'Localização do prestador',
            },
            distance,
            rating: Number(provider.rating) || 5.0,
            totalServices: provider.total_services || 0,
            services: servicesOffered,
          });
        }
      }

      // Sort by distance
      filteredProviders.sort((a, b) => a.distance - b.distance);
      
      console.log(`[ProgressiveSearch] Found ${filteredProviders.length} providers within ${radiusKm}km`);
      return filteredProviders;
    } catch (error) {
      console.error('[ProgressiveSearch] Error in fetchProvidersInRadius:', error);
      return [];
    }
  }, []);

  // Subscribe to real-time provider updates
  const subscribeToProviderUpdates = useCallback((location: Location, radiusKm: number, service: ServiceType) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel('providers-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_data',
        },
        async (payload) => {
          console.log('[ProgressiveSearch] Real-time update:', payload.eventType);
          
          if (!searchActiveRef.current || !location) return;

          const data = payload.new as any;
          
          if (payload.eventType === 'DELETE' || !data?.is_online) {
            // Remove provider from list
            setNearbyProviders(prev => prev.filter(p => p.userId !== data?.user_id));
            return;
          }

          if (!data.current_lat || !data.current_lng) return;

          const servicesOffered = data.services_offered as ServiceType[] || ['guincho'];
          if (!servicesOffered.includes(service)) return;

          const distance = calculateDistance(
            location.lat,
            location.lng,
            Number(data.current_lat),
            Number(data.current_lng)
          );

          if (distance > radiusKm) {
            // Provider moved out of range
            setNearbyProviders(prev => prev.filter(p => p.userId !== data.user_id));
            return;
          }

          // Check if in active service
          const { data: activeChamado } = await supabase
            .from('chamados')
            .select('id')
            .eq('prestador_id', data.user_id)
            .in('status', ['accepted', 'negotiating', 'awaiting_payment', 'in_service'])
            .limit(1);

          if (activeChamado && activeChamado.length > 0) {
            setNearbyProviders(prev => prev.filter(p => p.userId !== data.user_id));
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
            services: servicesOffered,
          };

          setNearbyProviders(prev => {
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
  }, []);

  // Start progressive search
  const startSearch = useCallback(async () => {
    if (!userLocation || !enabled) return;

    console.log('[ProgressiveSearch] Starting progressive search');
    searchActiveRef.current = true;
    setSearchState('searching');
    setRadiusIndex(0);
    radiusIndexRef.current = 0;
    setCurrentRadius(SEARCH_RADII[0]);
    setNearbyProviders([]);
    setDeclinedProviderIds(new Set());

    // Subscribe to real-time updates
    subscribeToProviderUpdates(userLocation, SEARCH_RADII[SEARCH_RADII.length - 1], serviceType);

    // Initial fetch
    const providers = await fetchProvidersInRadius(userLocation, SEARCH_RADII[0], serviceType);
    
    if (providers.length > 0) {
      setNearbyProviders(providers);
      setSearchState('provider_found');
      return;
    }

    // Start radius expansion
    setSearchState('expanding_radius');
    
    let currentIndex = 0;
    const expandRadius = async () => {
      if (!searchActiveRef.current) return;
      
      currentIndex++;
      radiusIndexRef.current = currentIndex;
      
      if (currentIndex >= SEARCH_RADII.length) {
        setSearchState('timeout');
        return;
      }

      const newRadius = SEARCH_RADII[currentIndex];
      console.log(`[ProgressiveSearch] Expanding to ${newRadius}km`);
      setRadiusIndex(currentIndex);
      setCurrentRadius(newRadius);

      const providers = await fetchProvidersInRadius(userLocation, newRadius, serviceType);
      
      if (providers.length > 0) {
        setNearbyProviders(providers);
        setSearchState('provider_found');
        if (expansionTimerRef.current) {
          clearTimeout(expansionTimerRef.current);
        }
        return;
      }

      // Schedule next expansion
      expansionTimerRef.current = setTimeout(expandRadius, EXPANSION_INTERVAL);
    };

    // Schedule first expansion
    expansionTimerRef.current = setTimeout(expandRadius, EXPANSION_INTERVAL);
  }, [userLocation, enabled, serviceType, fetchProvidersInRadius, subscribeToProviderUpdates]);

  // Cancel search
  const cancelSearch = useCallback(() => {
    console.log('[ProgressiveSearch] Canceling search');
    searchActiveRef.current = false;
    setSearchState('canceled');
    
    if (expansionTimerRef.current) {
      clearTimeout(expansionTimerRef.current);
      expansionTimerRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Reset search
  const resetSearch = useCallback(() => {
    cancelSearch();
    setSearchState('idle');
    setCurrentRadius(SEARCH_RADII[0]);
    setRadiusIndex(0);
    radiusIndexRef.current = 0;
    setNearbyProviders([]);
    setDeclinedProviderIds(new Set());
  }, [cancelSearch]);

  // Force expand radius (called when provider declines or times out)
  const forceExpandRadius = useCallback(async (declinedProviderId?: string) => {
    if (!userLocation || !searchActiveRef.current) return;
    
    console.log('[ProgressiveSearch] Provider declined, forcing radius expansion');
    
    // Track declined provider
    if (declinedProviderId) {
      setDeclinedProviderIds(prev => new Set([...prev, declinedProviderId]));
    }

    // Remove declined provider from list
    if (declinedProviderId) {
      setNearbyProviders(prev => prev.filter(p => p.id !== declinedProviderId));
    }

    // Check if there are still available providers (excluding declined ones)
    const remainingProviders = nearbyProviders.filter(
      p => !declinedProviderIds.has(p.id) && p.id !== declinedProviderId
    );

    if (remainingProviders.length > 0) {
      console.log('[ProgressiveSearch] Still have remaining providers, not expanding yet');
      setNearbyProviders(remainingProviders);
      return;
    }

    // No more providers at current radius, expand
    const nextIndex = radiusIndexRef.current + 1;
    
    if (nextIndex >= SEARCH_RADII.length) {
      console.log('[ProgressiveSearch] Max radius reached, timeout');
      setSearchState('timeout');
      return;
    }

    // Wait a bit before expanding to give UI time to update
    setTimeout(async () => {
      if (!searchActiveRef.current || !userLocation) return;
      
      const newRadius = SEARCH_RADII[nextIndex];
      console.log(`[ProgressiveSearch] Expanding radius to ${newRadius}km after decline`);
      
      setRadiusIndex(nextIndex);
      radiusIndexRef.current = nextIndex;
      setCurrentRadius(newRadius);
      setSearchState('expanding_radius');

      const providers = await fetchProvidersInRadius(userLocation, newRadius, serviceType);
      
      // Filter out already declined providers
      const availableProviders = providers.filter(p => !declinedProviderIds.has(p.id));
      
      if (availableProviders.length > 0) {
        setNearbyProviders(availableProviders);
        setSearchState('provider_found');
      } else {
        // Continue expanding
        forceExpandRadius();
      }
    }, DECLINE_EXPANSION_DELAY);
  }, [userLocation, nearbyProviders, declinedProviderIds, fetchProvidersInRadius, serviceType]);

  // Auto-start search when enabled and location available
  useEffect(() => {
    if (enabled && userLocation && searchState === 'idle') {
      startSearch();
    }
  }, [enabled, userLocation, searchState, startSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      searchActiveRef.current = false;
      if (expansionTimerRef.current) {
        clearTimeout(expansionTimerRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return {
    searchState,
    currentRadius,
    nearbyProviders,
    radiusIndex,
    totalRadii: SEARCH_RADII.length,
    startSearch,
    cancelSearch,
    resetSearch,
    forceExpandRadius,
    declinedProviderIds,
  };
}
