/**
 * Safe fee calculation utilities for GIGA S.O.S
 * Ensures no NaN values, proper formatting, and consistent calculations
 */

export interface FeeCalculation {
  serviceValue: number;
  feePercentage: number;
  feeAmount: number;
  providerNetAmount: number;
}

/**
 * Safely calculates the app fee based on service value and percentage
 * Ensures no NaN, negative, or undefined values
 */
export function calculateFee(
  serviceValue: number | null | undefined,
  feePercentage: number | null | undefined
): FeeCalculation {
  // Safe defaults - ensure valid numbers
  const safeServiceValue = typeof serviceValue === 'number' && !isNaN(serviceValue) && serviceValue >= 0 
    ? serviceValue 
    : 0;
  
  const safeFeePercentage = typeof feePercentage === 'number' && !isNaN(feePercentage) && feePercentage >= 0 
    ? feePercentage 
    : 0;
  
  // Calculate fee amount: serviceValue × (percentage / 100)
  const feeAmount = (safeServiceValue * safeFeePercentage) / 100;
  
  // Calculate provider net amount: serviceValue - feeAmount
  const providerNetAmount = safeServiceValue - feeAmount;
  
  return {
    serviceValue: safeServiceValue,
    feePercentage: safeFeePercentage,
    feeAmount: Math.max(0, feeAmount), // Ensure non-negative
    providerNetAmount: Math.max(0, providerNetAmount), // Ensure non-negative
  };
}

/**
 * Formats a currency value to Brazilian Real format
 * Always returns a valid string, never NaN
 */
export function formatCurrency(value: number | null | undefined): string {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  return safeValue.toFixed(2);
}

/**
 * Formats percentage for display
 * Always returns a valid string, never NaN
 */
export function formatPercentage(value: number | null | undefined): string {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  return `${safeValue}%`;
}
