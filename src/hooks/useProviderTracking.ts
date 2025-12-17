import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Location } from '@/types/chamado';

interface ProviderLocation {
  location: Location | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

export function useProviderTracking(providerId: string | null | undefined) {
  const [state, setState] = useState<ProviderLocation>({
    location: null,
    loading: true,
    error: null,
    lastUpdate: null,
  });

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

    // Initial fetch
    const fetchProviderLocation = async () => {
      try {
        const { data, error } = await supabase
          .from('provider_data')
          .select('current_lat, current_lng, current_address, updated_at')
          .eq('user_id', providerId)
          .maybeSingle();

        if (error) throw error;

        if (data && data.current_lat && data.current_lng) {
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
    };

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
          console.log('[ProviderTracking] Real-time update received:', data);
          
          if (data.current_lat && data.current_lng) {
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
      )
      .subscribe((status) => {
        console.log('[ProviderTracking] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [providerId]);

  return state;
}
