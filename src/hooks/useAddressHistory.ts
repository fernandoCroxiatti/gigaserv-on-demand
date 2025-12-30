import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Location } from '@/types/chamado';

const MAX_ADDRESSES = 10;

export interface AddressHistoryItem {
  id: string;
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
  lastUsedAt: string;
}

export function useAddressHistory() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<AddressHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load addresses on mount
  useEffect(() => {
    if (!user?.id) {
      setAddresses([]);
      return;
    }

    const loadAddresses = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('address_history')
          .select('*')
          .eq('user_id', user.id)
          .order('last_used_at', { ascending: false })
          .limit(MAX_ADDRESSES);

        if (error) {
          console.error('[AddressHistory] Error loading:', error);
          return;
        }

        setAddresses(
          (data || []).map((item) => ({
            id: item.id,
            address: item.address,
            lat: Number(item.lat),
            lng: Number(item.lng),
            placeId: item.place_id || undefined,
            lastUsedAt: item.last_used_at,
          }))
        );
      } catch (error) {
        console.error('[AddressHistory] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAddresses();
  }, [user?.id]);

  // Save or update address
  const saveAddress = useCallback(
    async (location: Location) => {
      if (!user?.id || !location.placeId) return;

      try {
        // Check if address already exists
        const { data: existing } = await supabase
          .from('address_history')
          .select('id')
          .eq('user_id', user.id)
          .eq('place_id', location.placeId)
          .maybeSingle();

        if (existing) {
          // Update last_used_at
          await supabase
            .from('address_history')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          // Insert new address
          await supabase.from('address_history').insert({
            user_id: user.id,
            address: location.address,
            lat: location.lat,
            lng: location.lng,
            place_id: location.placeId,
            last_used_at: new Date().toISOString(),
          });

          // Clean up old addresses if over limit
          const { data: allAddresses } = await supabase
            .from('address_history')
            .select('id')
            .eq('user_id', user.id)
            .order('last_used_at', { ascending: false });

          if (allAddresses && allAddresses.length > MAX_ADDRESSES) {
            const toDelete = allAddresses.slice(MAX_ADDRESSES).map((a) => a.id);
            await supabase.from('address_history').delete().in('id', toDelete);
          }
        }

        // Refresh list
        const { data: refreshed } = await supabase
          .from('address_history')
          .select('*')
          .eq('user_id', user.id)
          .order('last_used_at', { ascending: false })
          .limit(MAX_ADDRESSES);

        setAddresses(
          (refreshed || []).map((item) => ({
            id: item.id,
            address: item.address,
            lat: Number(item.lat),
            lng: Number(item.lng),
            placeId: item.place_id || undefined,
            lastUsedAt: item.last_used_at,
          }))
        );
      } catch (error) {
        console.error('[AddressHistory] Error saving:', error);
      }
    },
    [user?.id]
  );

  return { addresses, loading, saveAddress };
}
