/**
 * Provider Service - Database operations for providers
 */

import { supabase } from '@/integrations/supabase/client';
import { Provider, ServiceType, Location } from '@/domain/chamado/types';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface DbProviderData {
  user_id: string;
  is_online: boolean | null;
  radar_range: number | null;
  rating: number | null;
  total_services: number | null;
  services_offered: string[] | null;
  current_lat: number | null;
  current_lng: number | null;
  current_address: string | null;
  vehicle_plate: string | null;
  profiles?: {
    name: string;
    avatar_url: string | null;
    perfil_principal: string;
  };
}

/**
 * Map database provider data to domain
 */
function mapDbProviderToDomain(db: DbProviderData): Provider {
  return {
    id: db.user_id,
    name: db.profiles?.name || 'Prestador',
    avatar: db.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${db.profiles?.name || 'default'}`,
    rating: Number(db.rating) || 5.0,
    totalServices: db.total_services || 0,
    online: db.is_online || false,
    location: {
      lat: Number(db.current_lat) || -23.5505,
      lng: Number(db.current_lng) || -46.6333,
      address: db.current_address || '',
    },
    radarRange: db.radar_range || 15,
    services: (db.services_offered as ServiceType[]) || ['guincho'],
    vehiclePlate: db.vehicle_plate || undefined,
  };
}

/**
 * Fetch online providers
 */
export async function fetchOnlineProviders(): Promise<Provider[]> {
  try {
    const { data, error } = await supabase
      .from('provider_data')
      .select(`
        *,
        profiles!inner(name, avatar_url, perfil_principal)
      `)
      .eq('is_online', true);

    if (error) {
      console.error('[ProviderService] Fetch error:', error);
      return [];
    }

    return (data || [])
      .filter((p: any) => p.profiles.perfil_principal === 'provider')
      .map((p: any) => mapDbProviderToDomain(p));
  } catch (err) {
    console.error('[ProviderService] Fetch exception:', err);
    return [];
  }
}

/**
 * Toggle provider online status
 */
export async function toggleProviderOnline(
  userId: string,
  online: boolean,
  location?: Location
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify session is valid before calling edge function
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      console.error('[ProviderService] No active session');
      return { success: false, error: 'Sessão expirada. Faça login novamente.' };
    }

    const { data, error } = await supabase.functions.invoke('toggle-provider-online', {
      body: {
        online,
        location: location ? {
          lat: location.lat,
          lng: location.lng,
          address: location.address,
        } : undefined,
      },
    });

    if (error) {
      console.error('[ProviderService] Toggle error:', error);
      return { success: false, error: 'Erro ao alterar status. Tente novamente.' };
    }

    // Check for error in response body
    if (data?.error) {
      console.error('[ProviderService] Toggle response error:', data.error);
      return { success: false, error: data.error };
    }

    // Persist active_profile when going online
    if (online) {
      await supabase
        .from('profiles')
        .update({ active_profile: 'provider' })
        .eq('user_id', userId);
    }

    return { success: true };
  } catch (err) {
    console.error('[ProviderService] Toggle exception:', err);
    return { success: false, error: 'Erro inesperado. Tente novamente.' };
  }
}

/**
 * Update provider radar range
 */
export async function updateProviderRadarRange(
  userId: string,
  range: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('provider_data')
      .update({ radar_range: range })
      .eq('user_id', userId);

    return !error;
  } catch (err) {
    console.error('[ProviderService] UpdateRadar exception:', err);
    return false;
  }
}

/**
 * Update provider services offered
 */
export async function updateProviderServices(
  userId: string,
  services: ServiceType[]
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('provider_data')
      .update({ services_offered: services })
      .eq('user_id', userId);

    return !error;
  } catch (err) {
    console.error('[ProviderService] UpdateServices exception:', err);
    return false;
  }
}

/**
 * Update provider location
 */
export async function updateProviderLocation(
  userId: string,
  location: Location
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('provider_data')
      .update({
        current_lat: location.lat,
        current_lng: location.lng,
        current_address: location.address,
      })
      .eq('user_id', userId);

    return !error;
  } catch (err) {
    console.error('[ProviderService] UpdateLocation exception:', err);
    return false;
  }
}

/**
 * Subscribe to provider data changes
 */
export function subscribeToProviderChanges(
  onUpdate: () => void
): RealtimeChannel {
  const channel = supabase
    .channel('providers-online')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'provider_data',
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from provider changes
 */
export function unsubscribeFromProviderChanges(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
