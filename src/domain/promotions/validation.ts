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
  isPromotionActive,
  promotionAppliesToProvider,
} from './types';

/**
 * Calculate the fee percentage for a provider
 * Priority: active promotion > individual rate > global rate
 * 
 * @param promotionConfig - Promotion configuration
 * @param providerId - Provider ID
 * @param individualRate - Provider's individual fee rate (if any)
 * @param globalRate - Global commission rate
 * @returns Fee calculation result with percentage and reason
 */
export function calculateProviderFee(
  promotionConfig: ProviderFeePromotionConfig | null,
  providerId: string,
  individualRate: number | null | undefined,
  globalRate: number
): ProviderFeeCalculationResult {
  // Priority 1: Active promotion that applies to this provider
  if (promotionConfig && promotionAppliesToProvider(promotionConfig, providerId)) {
    return {
      fee_percentage: promotionConfig.promotional_commission,
      reason: 'promotion',
      promotion_end_date: promotionConfig.end_date ? new Date(promotionConfig.end_date) : undefined,
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

  // Validate dates if enabled
  if (config.enabled) {
    if (!config.start_date) {
      errors.push('Data de início é obrigatória');
    }
    if (!config.end_date) {
      errors.push('Data de término é obrigatória');
    }
    if (config.start_date && config.end_date) {
      const start = new Date(config.start_date);
      const end = new Date(config.end_date);
      if (end <= start) {
        errors.push('Data de término deve ser posterior à data de início');
      }
    }
    // Validate specific provider if scope is specific
    if (config.scope === 'specific_provider' && !config.specific_provider_id) {
      errors.push('Selecione um prestador específico');
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
