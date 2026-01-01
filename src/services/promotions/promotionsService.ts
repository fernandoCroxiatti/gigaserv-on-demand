/**
 * Promotions Service
 * Handles database operations for promotions
 * 
 * This service ONLY reads/writes promotion configurations.
 * It does NOT modify any existing fee calculation logic.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  ProviderFeePromotionConfig,
  FirstUseCouponConfig,
  DEFAULT_PROVIDER_FEE_PROMOTION,
  DEFAULT_FIRST_USE_COUPON,
  PROMOTION_SETTINGS_KEYS,
} from '@/domain/promotions/types';

/**
 * Fetch provider fee promotion configuration
 * Returns default (disabled) config if not found
 */
export async function fetchFeePromotionConfig(): Promise<ProviderFeePromotionConfig> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', PROMOTION_SETTINGS_KEYS.PROVIDER_FEE_PROMOTION)
      .maybeSingle();

    if (error) {
      console.error('[Promotions] Error fetching fee promotion config:', error);
      return DEFAULT_PROVIDER_FEE_PROMOTION;
    }

    if (!data?.value) {
      return DEFAULT_PROVIDER_FEE_PROMOTION;
    }

    // Merge with defaults to ensure all fields exist
    return {
      ...DEFAULT_PROVIDER_FEE_PROMOTION,
      ...(data.value as Partial<ProviderFeePromotionConfig>),
    };
  } catch (err) {
    console.error('[Promotions] Unexpected error:', err);
    return DEFAULT_PROVIDER_FEE_PROMOTION;
  }
}

/**
 * Save provider fee promotion configuration
 * Uses select + insert/update pattern for type safety
 */
export async function saveFeePromotionConfig(
  config: ProviderFeePromotionConfig,
  userId: string
): Promise<boolean> {
  try {
    const key = PROMOTION_SETTINGS_KEYS.PROVIDER_FEE_PROMOTION;
    
    // Check if setting exists
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', key)
      .maybeSingle();

    // Cast config to Json type for Supabase
    const configAsJson = config as unknown as Json;

    let error;
    if (existing?.id) {
      // Update existing
      const result = await supabase
        .from('app_settings')
        .update({
          value: configAsJson,
          description: 'Configuração de promoção de taxa do prestador',
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      error = result.error;
    } else {
      // Insert new
      const result = await supabase
        .from('app_settings')
        .insert({
          key,
          value: configAsJson,
          description: 'Configuração de promoção de taxa do prestador',
          updated_by: userId,
          updated_at: new Date().toISOString(),
        });
      error = result.error;
    }

    if (error) {
      console.error('[Promotions] Error saving fee promotion config:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Promotions] Unexpected error:', err);
    return false;
  }
}

/**
 * Fetch first-use coupon configuration
 * Returns default (disabled) config if not found
 */
export async function fetchCouponConfig(): Promise<FirstUseCouponConfig> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', PROMOTION_SETTINGS_KEYS.FIRST_USE_COUPON)
      .maybeSingle();

    if (error) {
      console.error('[Promotions] Error fetching coupon config:', error);
      return DEFAULT_FIRST_USE_COUPON;
    }

    if (!data?.value) {
      return DEFAULT_FIRST_USE_COUPON;
    }

    // Merge with defaults to ensure all fields exist
    return {
      ...DEFAULT_FIRST_USE_COUPON,
      ...(data.value as Partial<FirstUseCouponConfig>),
    };
  } catch (err) {
    console.error('[Promotions] Unexpected error:', err);
    return DEFAULT_FIRST_USE_COUPON;
  }
}

/**
 * Save first-use coupon configuration
 * Uses select + insert/update pattern for type safety
 */
export async function saveCouponConfig(
  config: FirstUseCouponConfig,
  userId: string
): Promise<boolean> {
  try {
    const key = PROMOTION_SETTINGS_KEYS.FIRST_USE_COUPON;
    
    // Check if setting exists
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', key)
      .maybeSingle();

    // Cast config to Json type for Supabase
    const configAsJson = config as unknown as Json;

    let error;
    if (existing?.id) {
      // Update existing
      const result = await supabase
        .from('app_settings')
        .update({
          value: configAsJson,
          description: 'Configuração de cupom de primeiro uso',
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      error = result.error;
    } else {
      // Insert new
      const result = await supabase
        .from('app_settings')
        .insert({
          key,
          value: configAsJson,
          description: 'Configuração de cupom de primeiro uso',
          updated_by: userId,
          updated_at: new Date().toISOString(),
        });
      error = result.error;
    }

    if (error) {
      console.error('[Promotions] Error saving coupon config:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Promotions] Unexpected error:', err);
    return false;
  }
}

/**
 * Apply fee exemption to a provider
 * Only used when promotion is enabled and provider is eligible
 */
export async function applyFeeExemption(
  providerId: string,
  exemptionUntil: Date
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('provider_data')
      .update({
        fee_exemption_until: exemptionUntil.toISOString(),
      })
      .eq('user_id', providerId);

    if (error) {
      console.error('[Promotions] Error applying fee exemption:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Promotions] Unexpected error:', err);
    return false;
  }
}

/**
 * Remove fee exemption from a provider
 */
export async function removeFeeExemption(providerId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('provider_data')
      .update({
        fee_exemption_until: null,
      })
      .eq('user_id', providerId);

    if (error) {
      console.error('[Promotions] Error removing fee exemption:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Promotions] Unexpected error:', err);
    return false;
  }
}

/**
 * Mark client's first coupon as used
 */
export async function markCouponUsed(clientId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        first_service_coupon_used: true,
      })
      .eq('user_id', clientId);

    if (error) {
      console.error('[Promotions] Error marking coupon used:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Promotions] Unexpected error:', err);
    return false;
  }
}

/**
 * Check if client has used their first-service coupon
 */
export async function hasClientUsedCoupon(clientId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('first_service_coupon_used')
      .eq('user_id', clientId)
      .maybeSingle();

    if (error) {
      console.error('[Promotions] Error checking coupon usage:', error);
      return true; // Assume used on error to prevent double-use
    }

    return data?.first_service_coupon_used ?? false;
  } catch (err) {
    console.error('[Promotions] Unexpected error:', err);
    return true;
  }
}

/**
 * Get provider's fee exemption date
 */
export async function getProviderExemption(
  providerId: string
): Promise<Date | null> {
  try {
    const { data, error } = await supabase
      .from('provider_data')
      .select('fee_exemption_until')
      .eq('user_id', providerId)
      .maybeSingle();

    if (error) {
      console.error('[Promotions] Error fetching exemption:', error);
      return null;
    }

    if (!data?.fee_exemption_until) return null;

    return new Date(data.fee_exemption_until);
  } catch (err) {
    console.error('[Promotions] Unexpected error:', err);
    return null;
  }
}
