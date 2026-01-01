/**
 * Promotions Validation Rules
 * Pure functions - no side effects
 * 
 * These functions validate promotion configurations and
 * determine eligibility without modifying any state.
 */

import {
  ProviderFeePromotionConfig,
  FirstUseCouponConfig,
  ProviderFeeCalculationResult,
  CouponApplicationResult,
} from './types';

/**
 * Check if a provider has an active fee exemption
 * @param exemptionUntil - The exemption expiration date
 * @returns true if exemption is still valid
 */
export function hasActiveFeeExemption(exemptionUntil: Date | null | undefined): boolean {
  if (!exemptionUntil) return false;
  const now = new Date();
  return exemptionUntil > now;
}

/**
 * Calculate the fee percentage for a provider
 * Priority: exemption > individual rate > global rate
 * 
 * @param exemptionUntil - Provider's exemption date
 * @param individualRate - Provider's individual fee rate (if any)
 * @param globalRate - Global commission rate
 * @returns Fee calculation result with percentage and reason
 */
export function calculateProviderFee(
  exemptionUntil: Date | null | undefined,
  individualRate: number | null | undefined,
  globalRate: number
): ProviderFeeCalculationResult {
  // Priority 1: Active exemption
  if (hasActiveFeeExemption(exemptionUntil)) {
    return {
      fee_percentage: 0,
      reason: 'exemption',
      exemption_until: exemptionUntil!,
    };
  }

  // Priority 2: Individual rate
  if (typeof individualRate === 'number' && individualRate >= 0) {
    return {
      fee_percentage: individualRate,
      reason: 'individual',
    };
  }

  // Priority 3: Global rate
  return {
    fee_percentage: globalRate,
    reason: 'global',
  };
}

/**
 * Calculate exemption end date based on promotion config
 * @param config - Promotion configuration
 * @param startDate - Start date (defaults to now)
 * @returns End date of exemption
 */
export function calculateExemptionEndDate(
  config: ProviderFeePromotionConfig,
  startDate: Date = new Date()
): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + config.default_duration_days);
  return endDate;
}

/**
 * Check if a new provider should receive fee exemption
 * @param config - Promotion configuration
 * @param isNewProvider - Whether this is a new provider
 * @returns true if exemption should be applied
 */
export function shouldApplyFeeExemption(
  config: ProviderFeePromotionConfig,
  isNewProvider: boolean
): boolean {
  if (!config.enabled) return false;
  if (config.apply_to === 'all_providers') return true;
  return config.apply_to === 'new_providers' && isNewProvider;
}

/**
 * Check if first-use coupon can be applied to a service
 * 
 * @param config - Coupon configuration
 * @param serviceValue - Value of the service
 * @param hasUsedCoupon - Whether client already used the coupon
 * @param isFirstCompletedService - Whether this is client's first completed service
 * @returns Coupon application result
 */
export function checkCouponEligibility(
  config: FirstUseCouponConfig,
  serviceValue: number,
  hasUsedCoupon: boolean,
  isFirstCompletedService: boolean
): CouponApplicationResult {
  // Check if coupon is enabled
  if (!config.enabled) {
    return {
      can_apply: false,
      discount_amount: 0,
      reason: 'disabled',
    };
  }

  // Check if already used
  if (hasUsedCoupon) {
    return {
      can_apply: false,
      discount_amount: 0,
      reason: 'already_used',
    };
  }

  // Check if first service
  if (!isFirstCompletedService) {
    return {
      can_apply: false,
      discount_amount: 0,
      reason: 'not_first_service',
    };
  }

  // Check minimum value
  if (serviceValue < config.minimum_service_value) {
    return {
      can_apply: false,
      discount_amount: 0,
      reason: 'below_minimum',
    };
  }

  // Calculate discount (cannot exceed service value)
  const discount = Math.min(config.discount_value, serviceValue);

  return {
    can_apply: true,
    discount_amount: discount,
  };
}

/**
 * Validate provider fee promotion configuration
 * @param config - Configuration to validate
 * @returns Object with valid flag and errors array
 */
export function validateFeePromotionConfig(
  config: Partial<ProviderFeePromotionConfig>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof config.promotional_commission === 'number') {
    if (config.promotional_commission < 0) {
      errors.push('Comissão promocional não pode ser negativa');
    }
    if (config.promotional_commission > 100) {
      errors.push('Comissão promocional não pode exceder 100%');
    }
  }

  if (typeof config.default_duration_days === 'number') {
    if (config.default_duration_days < 1) {
      errors.push('Duração mínima é 1 dia');
    }
    if (config.default_duration_days > 365) {
      errors.push('Duração máxima é 365 dias');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate first-use coupon configuration
 * @param config - Configuration to validate
 * @returns Object with valid flag and errors array
 */
export function validateCouponConfig(
  config: Partial<FirstUseCouponConfig>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof config.discount_value === 'number') {
    if (config.discount_value < 0) {
      errors.push('Valor do desconto não pode ser negativo');
    }
    if (config.discount_value > 10000) {
      errors.push('Valor máximo de desconto é R$ 10.000');
    }
  }

  if (typeof config.minimum_service_value === 'number') {
    if (config.minimum_service_value < 0) {
      errors.push('Valor mínimo não pode ser negativo');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
