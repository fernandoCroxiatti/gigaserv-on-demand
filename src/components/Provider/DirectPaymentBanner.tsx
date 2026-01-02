import React from 'react';
import { DollarSign, AlertTriangle, AlertCircle, Gift } from 'lucide-react';
import { calculateFee, formatCurrency, formatPercentage, canFinalizeWithFee } from '@/lib/feeCalculator';
import { useProviderFeeRate } from '@/hooks/useProviderFeeRate';
import { useApp } from '@/contexts/AppContext';

interface DirectPaymentBannerProps {
  amount: number;
}

/**
 * Sticky banner shown to provider during service when payment is direct to provider.
 * Shows:
 * - Amount to receive from client
 * - App fee percentage and value (considering exemption)
 * - Net amount for provider
 * 
 * This banner is ALWAYS visible and cannot be dismissed.
 * BLOCKS display if fee calculation is invalid.
 * 
 * FEE PRIORITY: exemption > individual > global
 */
export function DirectPaymentBanner({ amount }: DirectPaymentBannerProps) {
  const { user } = useApp();
  const { effectivePercentage, feeSource, promotionEndDate, loading: loadingFee, error: fetchError } = useProviderFeeRate(user?.id ?? null);

  // Determine fee percentage from effective rate
  const feePercentage = effectivePercentage;

  // Show loading state
  if (loadingFee) {
    return (
      <div className="bg-amber-500 text-white px-4 py-3 shadow-lg">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-sm">Carregando informações...</span>
        </div>
      </div>
    );
  }

  // Show error state - BLOCK flow
  if (fetchError || feePercentage === null) {
    return (
      <div className="bg-destructive text-destructive-foreground px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Erro no cálculo da taxa</p>
            <p className="text-xs opacity-90">Não foi possível calcular a taxa do app. Verifique a configuração antes de continuar.</p>
            <p className="text-xs opacity-90 mt-1">Valor da corrida: R$ {formatCurrency(amount)}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate fee using safe utility with invariant checks
  const feeCalc = calculateFee(amount, feePercentage);
  const canFinalize = canFinalizeWithFee(feeCalc);
  
  // Show validation error if calculation fails
  if (!canFinalize) {
    return (
      <div className="bg-destructive text-destructive-foreground px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Erro no cálculo da taxa</p>
            <p className="text-xs opacity-90">{feeCalc.validationError || 'Verifique a configuração antes de continuar.'}</p>
          </div>
        </div>
      </div>
    );
  }
  // Check if provider has promotion
  const hasPromotion = feeSource === 'promotion';
  
  return (
    <div className={`${hasPromotion ? 'bg-green-500' : 'bg-amber-500'} text-white px-4 py-3 shadow-lg`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-full p-2">
            {hasPromotion ? <Gift className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium opacity-90">Receba do cliente</span>
            <span className="text-xl font-bold">R$ {formatCurrency(feeCalc.serviceValue)}</span>
          </div>
        </div>
        {!hasPromotion && <AlertTriangle className="w-6 h-6 animate-bounce flex-shrink-0" />}
      </div>
      
      {/* Fee breakdown - always shows valid numbers */}
      <div className="mt-2 pt-2 border-t border-white/30 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="opacity-80">Taxa do app:</span>
          <span className="font-semibold ml-1">
            {hasPromotion && feeCalc.feePercentage === 0 ? (
              <span className="bg-white/20 px-1 rounded">ISENTO</span>
            ) : (
              `${formatPercentage(feeCalc.feePercentage)} (R$ ${formatCurrency(feeCalc.feeAmount)})`
            )}
          </span>
        </div>
        <div className="text-right">
          <span className="opacity-80">Líquido p/ você:</span>
          <span className="font-bold ml-1">R$ {formatCurrency(feeCalc.providerNetAmount)}</span>
        </div>
      </div>
      
      {/* Promotion badge */}
      {hasPromotion && promotionEndDate && (
        <div className="mt-2 text-xs text-center opacity-90">
          🎉 Promoção ativa até {promotionEndDate.toLocaleDateString('pt-BR')}
        </div>
      )}
    </div>
  );
}
