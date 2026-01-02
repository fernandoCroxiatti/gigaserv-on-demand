/**
 * Hook for provider fee data
 * Fetches promotion status, individual rates, and determines effective fee rate
 * 
 * Priority: Active Promotion > Individual Rate > Global Rate
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAppCommissionPercentage } from '@/lib/appSettings';
import { 
  ProviderFeePromotionConfig,
  isPromotionActive,
  promotionAppliesToProvider,
} from '@/domain/promotions/types';
import { PROMOTION_SETTINGS_KEYS } from '@/domain/promotions/types';

interface ProviderFeeData {
  /** Active promotion config (if any) */
  promotionConfig: ProviderFeePromotionConfig | null;
  /** Whether promotion applies to this provider */
  hasActivePromotion: boolean;
  /** Provider's individual fee rate (if custom fee enabled) */
  individualRate: number | null;
  /** Provider's individual fixed fee (if custom fee enabled) */
  individualFixedFee: number | null;
  /** Whether custom fee is enabled */
  customFeeEnabled: boolean;
  /** Global commission rate */
  globalRate: number;
  /** Effective fee percentage */
  effectivePercentage: number;
  /** Effective fixed fee */
  effectiveFixedFee: number;
  /** Source of the effective rate */
  feeSource: 'promotion' | 'individual' | 'global';
  /** When promotion ends (if active) */
  promotionEndDate: Date | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
}

/**
 * Fetches provider fee data and determines effective rate
 * Uses priority: promotion > individual > global
 */
export function useProviderFeeRate(providerId: string | null): ProviderFeeData {
  const [data, setData] = useState<ProviderFeeData>({
    promotionConfig: null,
    hasActivePromotion: false,
    individualRate: null,
    individualFixedFee: null,
    customFeeEnabled: false,
    globalRate: 15, // Default fallback
    effectivePercentage: 15,
    effectiveFixedFee: 0,
    feeSource: 'global',
    promotionEndDate: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!providerId) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // Fetch in parallel: provider data + global rate + promotion config
      const [providerResult, globalRateResult, promotionResult] = await Promise.all([
        supabase
          .from('provider_data')
          .select('custom_fee_enabled, custom_fee_percentage, custom_fee_fixed')
          .eq('user_id', providerId)
          .maybeSingle(),
        getAppCommissionPercentage(),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', PROMOTION_SETTINGS_KEYS.PROVIDER_FEE_PROMOTION)
          .maybeSingle(),
      ]);

      if (providerResult.error) {
        console.error('[useProviderFeeRate] Error fetching provider:', providerResult.error);
      }

      const providerData = providerResult.data;
      const customFeeEnabled = providerData?.custom_fee_enabled ?? false;
      const individualRate = providerData?.custom_fee_percentage ?? null;
      const individualFixedFee = providerData?.custom_fee_fixed ?? null;
      const globalRate = globalRateResult ?? 15;

      // Parse promotion config
      const promotionConfig = promotionResult.data?.value as unknown as ProviderFeePromotionConfig | null;

      // Check if promotion applies to this provider
      const hasActivePromotion = promotionConfig 
        ? promotionAppliesToProvider(promotionConfig, providerId)
        : false;

      // Determine effective rate based on priority
      let effectivePercentage = globalRate;
      let effectiveFixedFee = 0;
      let feeSource: 'promotion' | 'individual' | 'global' = 'global';
      let promotionEndDate: Date | null = null;

      if (hasActivePromotion && promotionConfig) {
        effectivePercentage = promotionConfig.promotional_commission;
        effectiveFixedFee = 0;
        feeSource = 'promotion';
        promotionEndDate = promotionConfig.end_date ? new Date(promotionConfig.end_date) : null;
        console.log('[useProviderFeeRate] Using promotion rate:', effectivePercentage);
      } else if (customFeeEnabled && typeof individualRate === 'number' && individualRate >= 0) {
        effectivePercentage = individualRate;
        effectiveFixedFee = typeof individualFixedFee === 'number' ? individualFixedFee : 0;
        feeSource = 'individual';
        console.log('[useProviderFeeRate] Using individual rate:', effectivePercentage);
      } else {
        console.log('[useProviderFeeRate] Using global rate:', globalRate);
      }

      setData({
        promotionConfig,
        hasActivePromotion,
        individualRate,
        individualFixedFee,
        customFeeEnabled,
        globalRate,
        effectivePercentage,
        effectiveFixedFee,
        feeSource,
        promotionEndDate,
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
 * Check if a provider has an active promotion
 * Standalone function for use outside React components
 */
export async function checkProviderPromotion(
  providerId: string
): Promise<{ hasPromotion: boolean; percentage: number; until: Date | null }> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', PROMOTION_SETTINGS_KEYS.PROVIDER_FEE_PROMOTION)
      .maybeSingle();

    if (error || !data?.value) {
      return { hasPromotion: false, percentage: 0, until: null };
    }

    const config = data.value as unknown as ProviderFeePromotionConfig;
    
    if (promotionAppliesToProvider(config, providerId)) {
      return {
        hasPromotion: true,
        percentage: config.promotional_commission,
        until: config.end_date ? new Date(config.end_date) : null,
      };
    }

    return { hasPromotion: false, percentage: 0, until: null };
  } catch (err) {
    console.error('[checkProviderPromotion] Error:', err);
    return { hasPromotion: false, percentage: 0, until: null };
  }
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
