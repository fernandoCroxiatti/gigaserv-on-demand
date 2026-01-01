/**
 * Hook for provider fee exemption data
 * Fetches exemption status and determines effective fee rate
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAppCommissionPercentage } from '@/lib/appSettings';
import { getEffectiveFeeRate, EffectiveFeeResult } from '@/lib/feeCalculator';

interface ProviderFeeData {
  /** Provider's fee exemption end date */
  exemptionUntil: Date | null;
  /** Provider's individual fee rate (if any) - currently not implemented */
  individualRate: number | null;
  /** Global commission rate */
  globalRate: number;
  /** Effective fee result */
  effectiveRate: EffectiveFeeResult | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
}

/**
 * Fetches provider fee data and determines effective rate
 * Uses priority: exemption > individual > global
 */
export function useProviderFeeRate(providerId: string | null): ProviderFeeData {
  const [data, setData] = useState<ProviderFeeData>({
    exemptionUntil: null,
    individualRate: null,
    globalRate: 15, // Default fallback
    effectiveRate: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!providerId) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // Fetch in parallel: provider exemption + global rate
      const [providerResult, globalRateResult] = await Promise.all([
        supabase
          .from('provider_data')
          .select('fee_exemption_until')
          .eq('user_id', providerId)
          .maybeSingle(),
        getAppCommissionPercentage(),
      ]);

      if (providerResult.error) {
        console.error('[useProviderFeeRate] Error fetching provider:', providerResult.error);
      }

      const exemptionUntil = providerResult.data?.fee_exemption_until
        ? new Date(providerResult.data.fee_exemption_until)
        : null;

      const globalRate = globalRateResult ?? 15;

      // Calculate effective rate
      const effectiveRate = getEffectiveFeeRate({
        exemptionUntil,
        individualRate: null, // Not implemented yet
        globalRate,
      });

      setData({
        exemptionUntil,
        individualRate: null,
        globalRate,
        effectiveRate,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('[useProviderFeeRate] Unexpected error:', err);
      setData(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao carregar taxa do prestador',
      }));
    }
  }, [providerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return data;
}

/**
 * Check if a provider has an active fee exemption
 * Standalone function for use outside React components
 */
export async function checkProviderExemption(
  providerId: string
): Promise<{ hasExemption: boolean; until: Date | null }> {
  try {
    const { data, error } = await supabase
      .from('provider_data')
      .select('fee_exemption_until')
      .eq('user_id', providerId)
      .maybeSingle();

    if (error || !data?.fee_exemption_until) {
      return { hasExemption: false, until: null };
    }

    const exemptionUntil = new Date(data.fee_exemption_until);
    const now = new Date();

    return {
      hasExemption: exemptionUntil > now,
      until: exemptionUntil,
    };
  } catch (err) {
    console.error('[checkProviderExemption] Error:', err);
    return { hasExemption: false, until: null };
  }
}
