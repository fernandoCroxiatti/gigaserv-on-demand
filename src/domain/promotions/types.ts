/**
 * Promotions Domain Types
 * Pure TypeScript - no React or external dependencies
 * 
 * This module defines types for:
 * 1. Provider Fee Promotions (campaign-based with fixed dates)
 * 2. First-Use Client Coupons (discount on first completed service)
 */

/**
 * Provider fee promotion configuration
 * Stored in app_settings with key 'provider_fee_promotion'
 * 
 * NEW MODEL: Campaign-based with start/end dates and scope
 */
export interface ProviderFeePromotionConfig {
  /** Whether the promotion is active */
  enabled: boolean;
  /** Promotional commission percentage (0 = full exemption) */
  promotional_commission: number;
  /** Campaign start date (ISO string) */
  start_date: string | null;
  /** Campaign end date (ISO string) */
  end_date: string | null;
  /** Scope of the promotion */
  scope: 'global' | 'specific_provider';
  /** Specific provider ID (only when scope = 'specific_provider') */
  specific_provider_id: string | null;
  /** Specific provider name (for display purposes) */
  specific_provider_name?: string | null;
}

/**
 * Default configuration for provider fee promotion
 * ALL DISABLED BY DEFAULT
 */
export const DEFAULT_PROVIDER_FEE_PROMOTION: ProviderFeePromotionConfig = {
  enabled: false,
  promotional_commission: 0,
  start_date: null,
  end_date: null,
  scope: 'global',
  specific_provider_id: null,
  specific_provider_name: null,
};

/**
 * First-use coupon configuration
 * Stored in app_settings with key 'first_use_coupon'
 */
export interface FirstUseCouponConfig {
  /** Whether the coupon is active */
  enabled: boolean;
  /** Discount amount in BRL (e.g., 20.00) */
  discount_value: number;
  /** Minimum service value required to apply coupon */
  minimum_service_value: number;
}

/**
 * Default configuration for first-use coupon
 * ALL DISABLED BY DEFAULT
 */
export const DEFAULT_FIRST_USE_COUPON: FirstUseCouponConfig = {
  enabled: false,
  discount_value: 0,
  minimum_service_value: 0,
};

/**
 * Result of fee calculation for a provider
 */
export interface ProviderFeeCalculationResult {
  /** Final fee percentage to apply */
  fee_percentage: number;
  /** Reason for this fee */
  reason: 'promotion' | 'individual' | 'global';
  /** If promotion, when it ends */
  promotion_end_date?: Date;
}

/**
 * Result of coupon application check
 */
export interface CouponApplicationResult {
  /** Whether coupon can be applied */
  can_apply: boolean;
  /** Discount amount (0 if cannot apply) */
  discount_amount: number;
  /** Reason if cannot apply */
  reason?: 'disabled' | 'already_used' | 'below_minimum' | 'not_first_service';
}

/**
 * Settings keys for promotions stored in app_settings table
 */
export const PROMOTION_SETTINGS_KEYS = {
  PROVIDER_FEE_PROMOTION: 'provider_fee_promotion',
  FIRST_USE_COUPON: 'first_use_coupon',
} as const;

/**
 * Check if promotion is currently active based on dates
 */
export function isPromotionActive(config: ProviderFeePromotionConfig): boolean {
  if (!config.enabled) return false;
  if (!config.start_date || !config.end_date) return false;
  
  const now = new Date();
  const start = new Date(config.start_date);
  const end = new Date(config.end_date);
  
  return now >= start && now <= end;
}

/**
 * Check if promotion applies to a specific provider
 */
export function promotionAppliesToProvider(
  config: ProviderFeePromotionConfig,
  providerId: string
): boolean {
  if (!isPromotionActive(config)) return false;
  
  if (config.scope === 'global') return true;
  
  return config.scope === 'specific_provider' && 
         config.specific_provider_id === providerId;
}
