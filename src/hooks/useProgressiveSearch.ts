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
  | 'timeout'
  | 'waiting_cooldown'; // New: waiting for cooldown to retry declined provider

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
  /** List of provider IDs that have already declined (from DB) */
  excludedProviderIds?: string[];
}

const SEARCH_RADII = [3, 5, 10, 20, 50, 100]; // km
const EXPANSION_INTERVAL = 6000; // 6 seconds between expansions
const POSITION_UPDATE_INTERVAL = 5000; // 5 seconds for real-time position updates
// After a provider declines, wait this long before expanding radius
const DECLINE_EXPANSION_DELAY = 2000; // 2 seconds
// Cooldown before retrying a declined provider (when no one else is available)
const COOLDOWN_RETRY_MS = 10 * 1000; // 10 seconds

// Track decline timestamps per provider for this chamado
interface DeclineInfo {
  providerId: string;
  declinedAt: number;
}

export function useProgressiveSearch({ 
  userLocation, 
  serviceType, 
  enabled,
  excludedProviderIds = []
}: UseProgressiveSearchOptions) {
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [currentRadius, setCurrentRadius] = useState(SEARCH_RADII[0]);
  const [nearbyProviders, setNearbyProviders] = useState<NearbyProvider[]>([]);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const [declinedProviderIds, setDeclinedProviderIds] = useState<Set<string>>(new Set());
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  
  const expansionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const searchActiveRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const radiusIndexRef = useRef(0);
  // Track when each provider declined (for cooldown logic)
  const declineInfoRef = useRef<DeclineInfo[]>([]);

  // Fetch providers within radius
  const fetchProvidersInRadius = useCallback(async (
    location: Location, 
    radiusKm: number,
    service: ServiceType,
    excludeProviderIds: string[] = []
  ): Promise<NearbyProvider[]> => {
    console.log(`[ProgressiveSearch] Fetching providers within ${radiusKm}km for ${service}, excluding ${excludeProviderIds.length} providers`);
    
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

      // Filter by distance, service type, excluded providers, and not in active service
      const filteredProviders: NearbyProvider[] = [];
      
      for (const provider of providerData) {
        if (!provider.current_lat || !provider.current_lng) continue;
        
        // Skip excluded providers (those who already declined this chamado)
        if (excludeProviderIds.includes(provider.user_id)) {
          console.log(`[ProgressiveSearch] Provider ${provider.user_id} already declined, skipping`);
          continue;
        }
        
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

  // Fetch all online providers (ignoring declined list) - used for cooldown retry
  const fetchAllOnlineProviders = useCallback(async (
    location: Location, 
    radiusKm: number,
    service: ServiceType
  ): Promise<NearbyProvider[]> => {
    return fetchProvidersInRadius(location, radiusKm, service, []);
  }, [fetchProvidersInRadius]);

  // Clear declined provider from exclusion list (for retry after cooldown)
  const clearDeclinedProvider = useCallback((providerId: string) => {
    console.log(`[ProgressiveSearch] Clearing declined provider ${providerId} for retry`);
    setDeclinedProviderIds(prev => {
      const next = new Set(prev);
      next.delete(providerId);
      return next;
    });
    // Also remove from declineInfo
    declineInfoRef.current = declineInfoRef.current.filter(d => d.providerId !== providerId);
  }, []);

  // Start cooldown timer to retry declined providers
  const startCooldownRetry = useCallback(async () => {
    if (!userLocation || !searchActiveRef.current) return;
    
    console.log('[ProgressiveSearch] No providers available, starting cooldown for retry...');
    setSearchState('waiting_cooldown');
    
    // Find the oldest declined provider to retry first
    const now = Date.now();
    const declineInfo = declineInfoRef.current;
    
    if (declineInfo.length === 0) {
      console.log('[ProgressiveSearch] No declined providers to retry, setting timeout');
      setSearchState('timeout');
      return;
    }

    // Calculate remaining cooldown from oldest decline
    const oldestDecline = declineInfo.reduce((oldest, curr) => 
      curr.declinedAt < oldest.declinedAt ? curr : oldest
    );
    
    const elapsed = now - oldestDecline.declinedAt;
    const remaining = Math.max(0, COOLDOWN_RETRY_MS - elapsed);
    
    console.log(`[ProgressiveSearch] Cooldown remaining: ${Math.ceil(remaining / 1000)}s for provider ${oldestDecline.providerId}`);
    
    // Update UI with countdown
    setCooldownRemaining(Math.ceil(remaining / 1000));
    
    // Start countdown interval
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Schedule retry
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(async () => {
      if (!searchActiveRef.current || !userLocation) return;
      
      console.log(`[ProgressiveSearch] Cooldown complete, clearing provider ${oldestDecline.providerId} and retrying`);
      
      // Clear this provider from declined list
      clearDeclinedProvider(oldestDecline.providerId);
      
      // Wait a moment for state to update
      setTimeout(async () => {
        if (!searchActiveRef.current || !userLocation) return;
        
        // Check if this provider is still online and available
        const maxRadius = SEARCH_RADII[SEARCH_RADII.length - 1];
        const providers = await fetchAllOnlineProviders(userLocation, maxRadius, serviceType);
        
        const retryProvider = providers.find(p => p.id === oldestDecline.providerId);
        
        if (retryProvider) {
          console.log(`[ProgressiveSearch] Provider ${oldestDecline.providerId} is still online, showing again`);
          setNearbyProviders([retryProvider]);
          setSearchState('provider_found');
        } else {
          // Provider went offline, check for others
          const remainingDeclined = declineInfoRef.current.filter(d => d.providerId !== oldestDecline.providerId);
          
          if (remainingDeclined.length > 0) {
            // There are other declined providers to retry
            console.log('[ProgressiveSearch] Provider offline, but have other declined providers to retry');
            startCooldownRetry();
          } else {
            // No providers at all
            console.log('[ProgressiveSearch] No providers available, setting timeout');
            setSearchState('timeout');
          }
        }
      }, 500);
    }, remaining);
  }, [userLocation, serviceType, fetchAllOnlineProviders, clearDeclinedProvider]);

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
              // Only add if not in declined list
              if (!declinedProviderIds.has(data.user_id)) {
                return [...prev, updatedProvider].sort((a, b) => a.distance - b.distance);
              }
              return prev;
            }
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [declinedProviderIds]);

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
    setCooldownRemaining(0);
    declineInfoRef.current = [];
    
    // Initialize declined providers from DB
    setDeclinedProviderIds(new Set(excludedProviderIds));
    // Also track decline timestamps from DB (assume they just happened)
    excludedProviderIds.forEach(id => {
      declineInfoRef.current.push({ providerId: id, declinedAt: Date.now() });
    });

    // Subscribe to real-time updates
    subscribeToProviderUpdates(userLocation, SEARCH_RADII[SEARCH_RADII.length - 1], serviceType);

    // Initial fetch - exclude already declined providers
    const providers = await fetchProvidersInRadius(userLocation, SEARCH_RADII[0], serviceType, excludedProviderIds);
    
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
        // Max radius reached - check if we have declined providers to retry
        if (declineInfoRef.current.length > 0) {
          startCooldownRetry();
        } else {
          setSearchState('timeout');
        }
        return;
      }

      const newRadius = SEARCH_RADII[currentIndex];
      console.log(`[ProgressiveSearch] Expanding to ${newRadius}km`);
      setRadiusIndex(currentIndex);
      setCurrentRadius(newRadius);

      const providers = await fetchProvidersInRadius(userLocation, newRadius, serviceType, excludedProviderIds);
      
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
  }, [userLocation, enabled, serviceType, fetchProvidersInRadius, subscribeToProviderUpdates, excludedProviderIds, startCooldownRetry]);

  // Cancel search
  const cancelSearch = useCallback(() => {
    console.log('[ProgressiveSearch] Canceling search');
    searchActiveRef.current = false;
    setSearchState('canceled');
    
    if (expansionTimerRef.current) {
      clearTimeout(expansionTimerRef.current);
      expansionTimerRef.current = null;
    }

    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }

    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
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
    setCooldownRemaining(0);
    declineInfoRef.current = [];
  }, [cancelSearch]);

  // Force expand radius (called when provider declines or times out)
  const forceExpandRadius = useCallback(async (declinedProviderId?: string) => {
    if (!userLocation || !searchActiveRef.current) return;
    
    console.log('[ProgressiveSearch] Provider declined, forcing radius expansion');
    
    // Track declined provider with timestamp
    if (declinedProviderId) {
      setDeclinedProviderIds(prev => new Set([...prev, declinedProviderId]));
      // Track decline time for cooldown
      declineInfoRef.current.push({
        providerId: declinedProviderId,
        declinedAt: Date.now(),
      });
    }

    // Remove declined provider from list
    if (declinedProviderId) {
      setNearbyProviders(prev => prev.filter(p => p.id !== declinedProviderId));
    }

    // Check if there are still available providers (excluding declined ones)
    const allDeclined = new Set([...declinedProviderIds, ...(declinedProviderId ? [declinedProviderId] : [])]);
    const remainingProviders = nearbyProviders.filter(
      p => !allDeclined.has(p.id)
    );

    if (remainingProviders.length > 0) {
      console.log('[ProgressiveSearch] Still have remaining providers, not expanding yet');
      setNearbyProviders(remainingProviders);
      return;
    }

    // No more providers at current radius, expand
    const nextIndex = radiusIndexRef.current + 1;
    
    if (nextIndex >= SEARCH_RADII.length) {
      console.log('[ProgressiveSearch] Max radius reached, starting cooldown retry');
      // Start cooldown retry instead of timeout
      startCooldownRetry();
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

      // Get current list of all declined providers
      const currentDeclined = Array.from(new Set([...declinedProviderIds, ...(declinedProviderId ? [declinedProviderId] : [])]));
      const providers = await fetchProvidersInRadius(userLocation, newRadius, serviceType, currentDeclined);
      
      if (providers.length > 0) {
        setNearbyProviders(providers);
        setSearchState('provider_found');
      } else {
        // Continue expanding
        forceExpandRadius();
      }
    }, DECLINE_EXPANSION_DELAY);
  }, [userLocation, nearbyProviders, declinedProviderIds, fetchProvidersInRadius, serviceType, startCooldownRetry]);

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
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
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
    cooldownRemaining,
  };
}
