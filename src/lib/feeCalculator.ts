/**
 * Safe fee calculation utilities for GIGA S.O.S
 * OFFICIAL LOGIC FOR DIRECT PAYMENT TO PROVIDER (PIX/CASH)
 * 
 * This module ensures:
 * - No NaN values ever displayed
 * - Proper financial rounding (2 decimal places)
 * - Invariant validation (valorTaxa + valorLiquidoPrestador === valorCorrida)
 * - Audit-ready calculations
 * - Fee exemption support (promotional periods)
 */

export interface FeeCalculation {
  serviceValue: number;      // valorCorrida
  feePercentage: number;     // taxaAppPercentual (effective after exemption check)
  feeAmount: number;         // valorTaxa
  providerNetAmount: number; // valorLiquidoPrestador
  isValid: boolean;          // Whether the calculation passed all validations
  validationError: string | null; // Error message if validation failed
  feeSource?: 'exemption' | 'individual' | 'global'; // Source of the fee percentage
}

export interface FeeAuditLog {
  valor_corrida: number;
  taxa_app_percentual: number;
  valor_taxa: number;
  valor_liquido_prestador: number;
  forma_pagamento: 'pagamento_direto';
  data_hora_confirmacao_pagamento: string;
  invariant_check_passed: boolean;
  fee_source?: 'exemption' | 'individual' | 'global';
}

/**
 * Parameters for determining effective fee rate
 * Follows priority: exemption > individual > global
 */
export interface EffectiveFeeParams {
  /** Provider's fee exemption end date (if any) */
  exemptionUntil?: Date | null;
  /** Provider's individual fee rate (if configured) */
  individualRate?: number | null;
  /** Global commission rate (default) */
  globalRate: number;
}

/**
 * Result of effective fee determination
 */
export interface EffectiveFeeResult {
  /** The fee percentage to apply */
  percentage: number;
  /** Source of this percentage */
  source: 'exemption' | 'individual' | 'global';
  /** If exemption, when it expires */
  exemptionUntil?: Date;
}

/**
 * Normalizes a numeric value safely
 * Returns 0 if value is null, undefined, NaN, or non-numeric
 */
function normalizeNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Rounds to 2 decimal places using banker's rounding (financial standard)
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Validates that fee calculation is within acceptable bounds
 */
function validateFeeInputs(serviceValue: number, feePercentage: number): { valid: boolean; error: string | null } {
  if (serviceValue < 0) {
    return { valid: false, error: 'Valor da corrida não pode ser negativo' };
  }
  if (feePercentage < 0) {
    return { valid: false, error: 'Percentual da taxa não pode ser negativo' };
  }
  if (feePercentage > 100) {
    return { valid: false, error: 'Percentual da taxa não pode ser maior que 100%' };
  }
  return { valid: true, error: null };
}

/**
 * OFFICIAL FEE CALCULATION
 * 
 * Formulas:
 * - valorTaxa = valorCorrida × (taxaAppPercentual / 100)
 * - valorLiquidoPrestador = valorCorrida - valorTaxa
 * 
 * Invariants:
 * - valorTaxa >= 0
 * - valorLiquidoPrestador >= 0  
 * - valorTaxa + valorLiquidoPrestador === valorCorrida (within rounding tolerance)
 */
export function calculateFee(
  serviceValue: number | null | undefined,
  feePercentage: number | null | undefined
): FeeCalculation {
  // Step 1: Normalize inputs (anti-error)
  const normalizedServiceValue = normalizeNumber(serviceValue);
  const normalizedFeePercentage = normalizeNumber(feePercentage);
  
  // Step 2: Validate inputs
  const validation = validateFeeInputs(normalizedServiceValue, normalizedFeePercentage);
  if (!validation.valid) {
    return {
      serviceValue: 0,
      feePercentage: 0,
      feeAmount: 0,
      providerNetAmount: 0,
      isValid: false,
      validationError: validation.error,
    };
  }
  
  // Step 3: Calculate fee (official formula)
  // valorTaxa = valorCorrida × (taxaAppPercentual / 100)
  const rawFeeAmount = normalizedServiceValue * (normalizedFeePercentage / 100);
  const feeAmount = roundToTwoDecimals(rawFeeAmount);
  
  // Step 4: Calculate provider net amount
  // valorLiquidoPrestador = valorCorrida - valorTaxa
  const rawProviderNetAmount = normalizedServiceValue - feeAmount;
  const providerNetAmount = roundToTwoDecimals(rawProviderNetAmount);
  
  // Step 5: Validate invariants
  // Invariant 1: valorTaxa >= 0
  if (feeAmount < 0) {
    return {
      serviceValue: normalizedServiceValue,
      feePercentage: normalizedFeePercentage,
      feeAmount: 0,
      providerNetAmount: normalizedServiceValue,
      isValid: false,
      validationError: 'Valor da taxa calculado é negativo',
    };
  }
  
  // Invariant 2: valorLiquidoPrestador >= 0
  if (providerNetAmount < 0) {
    return {
      serviceValue: normalizedServiceValue,
      feePercentage: normalizedFeePercentage,
      feeAmount: feeAmount,
      providerNetAmount: 0,
      isValid: false,
      validationError: 'Valor líquido do prestador é negativo',
    };
  }
  
  // Invariant 3: valorTaxa + valorLiquidoPrestador === valorCorrida (within rounding tolerance of 0.01)
  const sum = roundToTwoDecimals(feeAmount + providerNetAmount);
  const roundedServiceValue = roundToTwoDecimals(normalizedServiceValue);
  if (Math.abs(sum - roundedServiceValue) > 0.01) {
    console.error('[FeeCalculator] Invariant violation: sum mismatch', { 
      sum, 
      roundedServiceValue, 
      diff: Math.abs(sum - roundedServiceValue) 
    });
    return {
      serviceValue: normalizedServiceValue,
      feePercentage: normalizedFeePercentage,
      feeAmount: feeAmount,
      providerNetAmount: providerNetAmount,
      isValid: false,
      validationError: 'Erro de arredondamento no cálculo',
    };
  }
  
  return {
    serviceValue: roundedServiceValue,
    feePercentage: normalizedFeePercentage,
    feeAmount: feeAmount,
    providerNetAmount: providerNetAmount,
    isValid: true,
    validationError: null,
  };
}

/**
 * DETERMINE EFFECTIVE FEE RATE
 * 
 * Priority order:
 * 1. Exemption (if active) → 0%
 * 2. Individual rate (if configured) → use it
 * 3. Global rate (default) → use it
 * 
 * This function is PURE and does not modify any state.
 */
export function getEffectiveFeeRate(params: EffectiveFeeParams): EffectiveFeeResult {
  const { exemptionUntil, individualRate, globalRate } = params;
  
  // Priority 1: Active fee exemption
  if (exemptionUntil) {
    const now = new Date();
    if (exemptionUntil > now) {
      console.log('[FeeCalculator] Provider has active fee exemption until:', exemptionUntil);
      return {
        percentage: 0,
        source: 'exemption',
        exemptionUntil,
      };
    }
  }
  
  // Priority 2: Individual rate (if configured and valid)
  if (typeof individualRate === 'number' && individualRate >= 0 && individualRate <= 100) {
    console.log('[FeeCalculator] Using provider individual rate:', individualRate);
    return {
      percentage: individualRate,
      source: 'individual',
    };
  }
  
  // Priority 3: Global rate (default)
  console.log('[FeeCalculator] Using global rate:', globalRate);
  return {
    percentage: globalRate,
    source: 'global',
  };
}

/**
 * CALCULATE FEE WITH EXEMPTION CHECK
 * 
 * Extended version of calculateFee that first determines the effective
 * fee rate based on exemption/individual/global priority.
 */
export function calculateFeeWithExemption(
  serviceValue: number | null | undefined,
  params: EffectiveFeeParams
): FeeCalculation {
  const effectiveRate = getEffectiveFeeRate(params);
  const result = calculateFee(serviceValue, effectiveRate.percentage);
  
  // Add fee source to result
  return {
    ...result,
    feeSource: effectiveRate.source,
  };
}

/**
 * Creates an audit log entry for financial records
 */
export function createFeeAuditLog(calculation: FeeCalculation): FeeAuditLog {
  return {
    valor_corrida: calculation.serviceValue,
    taxa_app_percentual: calculation.feePercentage,
    valor_taxa: calculation.feeAmount,
    valor_liquido_prestador: calculation.providerNetAmount,
    forma_pagamento: 'pagamento_direto',
    data_hora_confirmacao_pagamento: new Date().toISOString(),
    invariant_check_passed: calculation.isValid,
    fee_source: calculation.feeSource,
  };
}

/**
 * Formats a currency value to Brazilian Real format (R$ 0,00)
 * Always returns a valid string, never NaN
 */
export function formatCurrency(value: number | null | undefined): string {
  const normalized = normalizeNumber(value);
  const rounded = roundToTwoDecimals(normalized);
  return rounded.toFixed(2);
}

/**
 * Formats percentage for display
 * Always returns a valid string, never NaN
 */
export function formatPercentage(value: number | null | undefined): string {
  const normalized = normalizeNumber(value);
  return `${normalized}%`;
}

/**
 * Validates if a fee calculation is ready for finalization
 * Returns true only if all invariants pass
 */
export function canFinalizeWithFee(calculation: FeeCalculation): boolean {
  return (
    calculation.isValid &&
    calculation.serviceValue >= 0 &&
    calculation.feeAmount >= 0 &&
    calculation.providerNetAmount >= 0 &&
    calculation.validationError === null
  );
}
