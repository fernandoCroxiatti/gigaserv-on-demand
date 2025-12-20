import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProviderInfo {
  name: string;
  avatar: string | null;
  phone: string | null;
  rating: number;
  totalServices: number;
  vehiclePlate: string | null;
  vehicleType: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch complete provider information for a chamado
 */
export function useProviderInfo(prestadorId: string | null | undefined): ProviderInfo {
  const [data, setData] = useState<ProviderInfo>({
    name: '',
    avatar: null,
    phone: null,
    rating: 5.0,
    totalServices: 0,
    vehiclePlate: null,
    vehicleType: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!prestadorId) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    const fetchProviderInfo = async () => {
      try {
        // Fetch profile and provider_data in parallel
        const [profileResult, providerDataResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('name, avatar_url, phone')
            .eq('user_id', prestadorId)
            .single(),
          supabase
            .from('provider_data')
            .select('rating, total_services, vehicle_plate, vehicle_type')
            .eq('user_id', prestadorId)
            .single(),
        ]);

        if (profileResult.error) {
          console.error('[ProviderInfo] Error fetching profile:', profileResult.error);
          setData(prev => ({ ...prev, loading: false, error: 'Erro ao carregar dados' }));
          return;
        }

        const profile = profileResult.data;
        const providerData = providerDataResult.data;

        setData({
          name: profile?.name || 'Prestador',
          avatar: profile?.avatar_url || null,
          phone: profile?.phone || null,
          rating: Number(providerData?.rating) || 5.0,
          totalServices: providerData?.total_services || 0,
          vehiclePlate: providerData?.vehicle_plate || null,
          vehicleType: providerData?.vehicle_type || null,
          loading: false,
          error: null,
        });
      } catch (err) {
        console.error('[ProviderInfo] Unexpected error:', err);
        setData(prev => ({ ...prev, loading: false, error: 'Erro inesperado' }));
      }
    };

    fetchProviderInfo();
  }, [prestadorId]);

  return data;
}
