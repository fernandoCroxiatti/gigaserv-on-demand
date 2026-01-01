/**
 * Promotions Domain Types
 * Pure TypeScript - no React or external dependencies
 * 
 * This module defines types for:
 * 1. Provider Fee Promotions (temporary fee exemptions)
 * 2. First-Use Client Coupons (discount on first completed service)
 */

/**
 * Provider fee promotion configuration
 * Stored in app_settings with key 'provider_fee_promotion'
 */
export interface ProviderFeePromotionConfig {
  /** Whether the promotion is active */
  enabled: boolean;
  /** Promotional commission percentage (0 = free) */
  promotional_commission: number;
  /** Default duration in days for new promotions */
  default_duration_days: number;
  /** Target audience for the promotion */
  apply_to: 'new_providers' | 'all_providers';
}

/**
 * Default configuration for provider fee promotion
 * ALL DISABLED BY DEFAULT
 */
export const DEFAULT_PROVIDER_FEE_PROMOTION: ProviderFeePromotionConfig = {
  enabled: false,
  promotional_commission: 0,
  default_duration_days: 30,
  apply_to: 'new_providers',
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
  reason: 'exemption' | 'individual' | 'global';
  /** If exemption, when it expires */
  exemption_until?: Date;
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
