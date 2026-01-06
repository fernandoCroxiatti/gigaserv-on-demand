/**
 * CENTRALIZED FEE CALCULATOR FOR GIGA S.O.S
 * 
 * This is the SINGLE SOURCE OF TRUTH for fee calculation.
 * MUST be used by ALL Edge Functions that calculate fees.
 * 
 * PRIORITY ORDER (STRICT):
 * 1. Active Promotion (campaign-based, global or specific provider)
 * 2. Custom Fee (if custom_fee_enabled = true for provider)
 * 3. Global Rate (app_commission_percentage)
 * 
 * RULES:
 * - NEVER mix custom fee with global fee
 * - Custom fee is EXCLUSIVE to the provider_id
 * - If custom_fee_percentage > 0, ignore global
 * - If custom_fee_fixed > 0, it's ADDED to percentage fee
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

export interface ProviderFeeConfig {
  /** Whether custom fee is enabled for this provider */
  customFeeEnabled: boolean;
  /** Custom fee percentage (0-100) */
  customFeePercentage: number | null;
  /** Custom fixed fee in BRL */
  customFixedFee: number | null;
}

export interface PromotionConfig {
  enabled: boolean;
  promotional_commission: number;
  start_date: string | null;
  end_date: string | null;
  scope: 'global' | 'specific_provider';
  specific_provider_id: string | null;
}

export interface EffectiveFeeResult {
  /** The fee percentage to apply (0-100) */
  percentage: number;
  /** Fixed fee amount in BRL (added to percentage) */
  fixedFee: number;
  /** Source of this fee rate */
  source: 'promotion' | 'individual' | 'global';
  /** If promotion, when it ends */
  promotionEndDate: Date | null;
}

export interface FeeCalculationResult {
  /** Total amount in centavos */
  totalAmountCentavos: number;
  /** Percentage-based fee in centavos */
  percentageFeeAmountCentavos: number;
  /** Fixed fee in centavos */
  fixedFeeAmountCentavos: number;
  /** Total application fee (percentage + fixed) in centavos */
  applicationFeeAmountCentavos: number;
  /** Provider receives (total - application fee) in centavos */
  providerReceivesCentavos: number;
  /** Fee percentage used */
  feePercentage: number;
  /** Fixed fee in BRL */
  fixedFeeBRL: number;
  /** Source of the fee */
  feeSource: 'promotion' | 'individual' | 'global';
}

/**
 * Get provider-specific fee configuration from database
 * 
 * @param supabase - Supabase client with service role
 * @param providerId - The provider's user_id
 * @returns Provider fee configuration
 */
export async function getProviderFeeConfig(
  supabase: SupabaseClient,
  providerId: string
): Promise<ProviderFeeConfig> {
  const { data, error } = await supabase
    .from('provider_data')
    .select('custom_fee_enabled, custom_fee_percentage, custom_fee_fixed')
    .eq('user_id', providerId)
    .single();

  if (error || !data) {
    console.log(`[FeeCalculator] No provider data found for ${providerId}, using defaults`);
    return {
      customFeeEnabled: false,
      customFeePercentage: null,
      customFixedFee: null,
    };
  }

  return {
    customFeeEnabled: data.custom_fee_enabled ?? false,
    customFeePercentage: data.custom_fee_percentage,
    customFixedFee: data.custom_fee_fixed,
  };
}

/**
 * Get active promotion configuration
 * 
 * @param supabase - Supabase client with service role
 * @returns Promotion configuration or null
 */
export async function getPromotionConfig(
  supabase: SupabaseClient
): Promise<PromotionConfig | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'provider_fee_promotion')
    .maybeSingle();

  if (error || !data?.value) {
    return null;
  }

  return data.value as PromotionConfig;
}

/**
 * Get global commission percentage
 * 
 * @param supabase - Supabase client with service role
 * @returns Global commission percentage (default 15)
 */
export async function getGlobalCommissionPercentage(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'app_commission_percentage')
    .single();

  if (error || !data?.value) {
    console.log('[FeeCalculator] No global commission found, using default 15%');
    return 15;
  }

  // Handle both formats: { value: 15 } or just 15
  if (typeof data.value === 'object' && 'value' in (data.value as object)) {
    return Number((data.value as { value: number }).value) || 15;
  }

  return Number(data.value) || 15;
}

/**
 * Check if a promotion is currently active and applies to the provider
 * 
 * @param config - Promotion configuration
 * @param providerId - Provider's user_id
 * @returns Whether promotion is active for this provider
 */
function isPromotionActiveForProvider(
  config: PromotionConfig | null,
  providerId: string
): boolean {
  if (!config?.enabled) return false;
  if (!config.start_date || !config.end_date) return false;

  const now = new Date();
  const startDate = new Date(config.start_date);
  const endDate = new Date(config.end_date);

  if (now < startDate || now > endDate) return false;

  // Check scope
  if (config.scope === 'global') return true;
  if (config.scope === 'specific_provider' && config.specific_provider_id === providerId) {
    return true;
  }

  return false;
}

/**
 * DETERMINE THE EFFECTIVE FEE RATE FOR A SPECIFIC PROVIDER
 * 
 * This is the main function that implements the priority logic:
 * 1. Promotion (if active for this provider)
 * 2. Custom fee (if enabled for this provider)
 * 3. Global rate
 * 
 * IMPORTANT: This function MUST be called with the provider_id
 * from the chamado, NOT from any cached/session value.
 * 
 * @param supabase - Supabase client with service role
 * @param providerId - The provider's user_id (from chamado.prestador_id)
 * @returns Effective fee configuration
 */
export async function getEffectiveFeeForProvider(
  supabase: SupabaseClient,
  providerId: string
): Promise<EffectiveFeeResult> {
  console.log(`[FeeCalculator] Calculating fee for provider: ${providerId}`);

  // Fetch all configs in parallel
  const [providerConfig, promotionConfig, globalRate] = await Promise.all([
    getProviderFeeConfig(supabase, providerId),
    getPromotionConfig(supabase),
    getGlobalCommissionPercentage(supabase),
  ]);

  // Priority 1: Active Promotion
  if (isPromotionActiveForProvider(promotionConfig, providerId)) {
    console.log(`[FeeCalculator] Using PROMOTION rate for provider ${providerId}:`, {
      percentage: promotionConfig!.promotional_commission,
      scope: promotionConfig!.scope,
      endDate: promotionConfig!.end_date,
    });
    return {
      percentage: promotionConfig!.promotional_commission,
      fixedFee: 0,
      source: 'promotion',
      promotionEndDate: promotionConfig!.end_date ? new Date(promotionConfig!.end_date) : null,
    };
  }

  // Priority 2: Custom Fee (if enabled)
  if (providerConfig.customFeeEnabled) {
    const percentage = typeof providerConfig.customFeePercentage === 'number' 
      ? providerConfig.customFeePercentage 
      : 0;
    const fixedFee = typeof providerConfig.customFixedFee === 'number'
      ? providerConfig.customFixedFee
      : 0;

    console.log(`[FeeCalculator] Using INDIVIDUAL rate for provider ${providerId}:`, {
      percentage,
      fixedFee,
    });
    return {
      percentage,
      fixedFee,
      source: 'individual',
      promotionEndDate: null,
    };
  }

  // Priority 3: Global Rate
  console.log(`[FeeCalculator] Using GLOBAL rate for provider ${providerId}:`, {
    percentage: globalRate,
  });
  return {
    percentage: globalRate,
    fixedFee: 0,
    source: 'global',
    promotionEndDate: null,
  };
}

/**
 * CALCULATE FINAL FEE AMOUNTS FOR A SERVICE
 * 
 * Use this to get the exact amounts to send to Stripe.
 * 
 * @param serviceValueBRL - Service value in BRL (e.g., 150.00)
 * @param feeConfig - Effective fee configuration from getEffectiveFeeForProvider
 * @returns Complete fee calculation with all amounts in centavos
 */
export function calculateFeeAmounts(
  serviceValueBRL: number,
  feeConfig: EffectiveFeeResult
): FeeCalculationResult {
  const totalAmountCentavos = Math.round(serviceValueBRL * 100);
  
  // Calculate percentage-based fee
  const percentageFeeAmountCentavos = Math.round(
    totalAmountCentavos * (feeConfig.percentage / 100)
  );
  
  // Calculate fixed fee in centavos
  const fixedFeeAmountCentavos = Math.round(feeConfig.fixedFee * 100);
  
  // Total application fee = percentage + fixed
  const applicationFeeAmountCentavos = percentageFeeAmountCentavos + fixedFeeAmountCentavos;
  
  // Provider receives = total - application fee
  const providerReceivesCentavos = totalAmountCentavos - applicationFeeAmountCentavos;

  console.log(`[FeeCalculator] Fee amounts calculated:`, {
    serviceValueBRL,
    totalCentavos: totalAmountCentavos,
    percentageFeeCentavos: percentageFeeAmountCentavos,
    fixedFeeCentavos: fixedFeeAmountCentavos,
    applicationFeeCentavos: applicationFeeAmountCentavos,
    providerReceivesCentavos,
    feeSource: feeConfig.source,
  });

  return {
    totalAmountCentavos,
    percentageFeeAmountCentavos,
    fixedFeeAmountCentavos,
    applicationFeeAmountCentavos,
    providerReceivesCentavos,
    feePercentage: feeConfig.percentage,
    fixedFeeBRL: feeConfig.fixedFee,
    feeSource: feeConfig.source,
  };
}

/**
 * COMPLETE FEE CALCULATION IN ONE CALL
 * 
 * Convenience function that fetches the effective rate and calculates amounts.
 * Use this in Edge Functions for clean, centralized fee calculation.
 * 
 * @param supabase - Supabase client with service role
 * @param providerId - Provider's user_id (from chamado.prestador_id)
 * @param serviceValueBRL - Service value in BRL
 * @returns Complete fee calculation result
 */
export async function calculateProviderFee(
  supabase: SupabaseClient,
  providerId: string,
  serviceValueBRL: number
): Promise<FeeCalculationResult> {
  const feeConfig = await getEffectiveFeeForProvider(supabase, providerId);
  return calculateFeeAmounts(serviceValueBRL, feeConfig);
}
