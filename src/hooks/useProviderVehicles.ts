/**
 * Hook for managing provider vehicles
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProviderVehicle {
  id: string;
  provider_id: string;
  plate: string;
  vehicle_type: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useProviderVehicles(providerId: string | undefined) {
  const [vehicles, setVehicles] = useState<ProviderVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {
    if (!providerId) {
      setVehicles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('provider_vehicles')
        .select('*')
        .eq('provider_id', providerId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setVehicles(data || []);
      setError(null);
    } catch (err: any) {
      console.error('[useProviderVehicles] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const addVehicle = async (plate: string, vehicleType?: string): Promise<boolean> => {
    if (!providerId) return false;

    try {
      const cleanPlate = plate.replace(/-/g, '').toUpperCase();
      
      // Check if this is the first vehicle (will be primary)
      const isPrimary = vehicles.length === 0;

      const { error: insertError } = await supabase
        .from('provider_vehicles')
        .insert({
          provider_id: providerId,
          plate: cleanPlate,
          vehicle_type: vehicleType || null,
          is_primary: isPrimary,
          is_active: true,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          toast.error('Esta placa já está cadastrada');
          return false;
        }
        throw insertError;
      }

      toast.success('Veículo adicionado com sucesso!');
      await fetchVehicles();
      return true;
    } catch (err: any) {
      console.error('[useProviderVehicles] Add error:', err);
      toast.error('Erro ao adicionar veículo');
      return false;
    }
  };

  const updateVehicle = async (
    vehicleId: string,
    updates: Partial<Pick<ProviderVehicle, 'plate' | 'vehicle_type'>>
  ): Promise<boolean> => {
    try {
      const updateData: any = { ...updates };
      if (updates.plate) {
        updateData.plate = updates.plate.replace(/-/g, '').toUpperCase();
      }

      const { error: updateError } = await supabase
        .from('provider_vehicles')
        .update(updateData)
        .eq('id', vehicleId);

      if (updateError) {
        if (updateError.code === '23505') {
          toast.error('Esta placa já está cadastrada');
          return false;
        }
        throw updateError;
      }

      toast.success('Veículo atualizado!');
      await fetchVehicles();
      return true;
    } catch (err: any) {
      console.error('[useProviderVehicles] Update error:', err);
      toast.error('Erro ao atualizar veículo');
      return false;
    }
  };

  const setPrimaryVehicle = async (vehicleId: string): Promise<boolean> => {
    if (!providerId) return false;

    try {
      // First, unset all as non-primary
      await supabase
        .from('provider_vehicles')
        .update({ is_primary: false })
        .eq('provider_id', providerId);

      // Then set the selected one as primary
      const { error: updateError } = await supabase
        .from('provider_vehicles')
        .update({ is_primary: true })
        .eq('id', vehicleId);

      if (updateError) throw updateError;

      // Also update the legacy vehicle_plate in provider_data
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        await supabase
          .from('provider_data')
          .update({ vehicle_plate: vehicle.plate })
          .eq('user_id', providerId);
      }

      toast.success('Veículo principal atualizado!');
      await fetchVehicles();
      return true;
    } catch (err: any) {
      console.error('[useProviderVehicles] SetPrimary error:', err);
      toast.error('Erro ao definir veículo principal');
      return false;
    }
  };

  const removeVehicle = async (vehicleId: string): Promise<boolean> => {
    try {
      const vehicleToRemove = vehicles.find(v => v.id === vehicleId);
      
      // Prevent removing the last vehicle
      if (vehicles.filter(v => v.is_active).length <= 1) {
        toast.error('Você deve ter pelo menos um veículo cadastrado');
        return false;
      }

      // Prevent removing the primary vehicle directly
      if (vehicleToRemove?.is_primary) {
        toast.error('Defina outro veículo como principal antes de remover este');
        return false;
      }

      const { error: deleteError } = await supabase
        .from('provider_vehicles')
        .delete()
        .eq('id', vehicleId);

      if (deleteError) throw deleteError;

      toast.success('Veículo removido!');
      await fetchVehicles();
      return true;
    } catch (err: any) {
      console.error('[useProviderVehicles] Remove error:', err);
      toast.error('Erro ao remover veículo');
      return false;
    }
  };

  const getPrimaryVehicle = (): ProviderVehicle | null => {
    return vehicles.find(v => v.is_primary && v.is_active) || vehicles[0] || null;
  };

  return {
    vehicles,
    loading,
    error,
    addVehicle,
    updateVehicle,
    setPrimaryVehicle,
    removeVehicle,
    getPrimaryVehicle,
    refetch: fetchVehicles,
  };
}
