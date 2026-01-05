import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Location } from '@/types/chamado';

interface ProviderLocation {
  location: Location | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

// Polling interval as fallback (5 seconds)
const POLLING_INTERVAL = 5000;

export function useProviderTracking(providerId: string | null | undefined) {
  const [state, setState] = useState<ProviderLocation>({
    location: null,
    loading: true,
    error: null,
    lastUpdate: null,
  });
  
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Fetch provider location function (reusable for polling and initial load)
  const fetchProviderLocation = useCallback(async () => {
    if (!providerId) return;
    
    try {
      const { data, error } = await supabase
        .from('provider_data')
        .select('current_lat, current_lng, current_address, updated_at')
        .eq('user_id', providerId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.current_lat && data.current_lng) {
        const updateTime = new Date(data.updated_at).getTime();
        
        // Only update if data is newer than last update
        if (updateTime > lastUpdateTimeRef.current) {
          lastUpdateTimeRef.current = updateTime;
          
          setState({
            location: {
              lat: Number(data.current_lat),
              lng: Number(data.current_lng),
              address: data.current_address || 'Localização do prestador',
            },
            loading: false,
            error: null,
            lastUpdate: new Date(data.updated_at),
          });
        }
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
        }));
      }
    } catch (error) {
      console.error('[ProviderTracking] Error fetching location:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao buscar localização do prestador',
      }));
    }
  }, [providerId]);

  useEffect(() => {
    if (!providerId) {
      setState({
        location: null,
        loading: false,
        error: null,
        lastUpdate: null,
      });
      return;
    }

    // Reset state for new provider
    lastUpdateTimeRef.current = 0;

    // Initial fetch
    fetchProviderLocation();

    // Real-time subscription for provider location updates
    const channel = supabase
      .channel(`provider-location-${providerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'provider_data',
          filter: `user_id=eq.${providerId}`,
        },
        (payload) => {
          const data = payload.new as any;
          console.log('[ProviderTracking] Real-time update received:', {
            lat: data.current_lat,
            lng: data.current_lng,
            updatedAt: data.updated_at,
          });
          
          if (data.current_lat && data.current_lng) {
            const updateTime = new Date(data.updated_at).getTime();
            
            // Only update if data is newer
            if (updateTime > lastUpdateTimeRef.current) {
              lastUpdateTimeRef.current = updateTime;
              
              setState({
                location: {
                  lat: Number(data.current_lat),
                  lng: Number(data.current_lng),
                  address: data.current_address || 'Localização do prestador',
                },
                loading: false,
                error: null,
                lastUpdate: new Date(data.updated_at),
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[ProviderTracking] Subscription status:', status);
      });

    // Fallback polling to ensure updates even if realtime fails
    pollingRef.current = setInterval(() => {
      console.log('[ProviderTracking] Polling for location update...');
      fetchProviderLocation();
    }, POLLING_INTERVAL);

    // Refresh on visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[ProviderTracking] Tab visible, refreshing location');
        fetchProviderLocation();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [providerId, fetchProviderLocation]);

  return state;
}
