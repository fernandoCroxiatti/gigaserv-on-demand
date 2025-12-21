import React, { useEffect, useState } from 'react';
import { DollarSign, AlertTriangle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { calculateFee, formatCurrency, formatPercentage, canFinalizeWithFee } from '@/lib/feeCalculator';

interface DirectPaymentBannerProps {
  amount: number;
}

/**
 * Sticky banner shown to provider during service when payment is direct to provider.
 * Shows:
 * - Amount to receive from client
 * - App fee percentage and value
 * - Net amount for provider
 * 
 * This banner is ALWAYS visible and cannot be dismissed.
 * BLOCKS display if fee calculation is invalid.
 */
export function DirectPaymentBanner({ amount }: DirectPaymentBannerProps) {
  const [feePercentage, setFeePercentage] = useState<number | null>(null);
  const [loadingFee, setLoadingFee] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Fetch commission percentage on mount
  useEffect(() => {
    const fetchCommission = async () => {
      setLoadingFee(true);
      setFetchError(false);
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'app_commission_percentage')
          .single();
        
        if (error) throw error;
        
        if (data?.value !== undefined && data?.value !== null) {
          const parsed = Number(data.value);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            setFeePercentage(parsed);
          } else {
            setFetchError(true);
          }
        } else {
          setFetchError(true);
        }
      } catch (err) {
        console.error('Error fetching commission:', err);
        setFetchError(true);
      } finally {
        setLoadingFee(false);
      }
    };
    fetchCommission();
  }, []);

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
  
  return (
    <div className="bg-amber-500 text-white px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-full p-2">
            <DollarSign className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium opacity-90">Receba do cliente</span>
            <span className="text-xl font-bold">R$ {formatCurrency(feeCalc.serviceValue)}</span>
          </div>
        </div>
        <AlertTriangle className="w-6 h-6 animate-bounce flex-shrink-0" />
      </div>
      
      {/* Fee breakdown - always shows valid numbers */}
      <div className="mt-2 pt-2 border-t border-white/30 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="opacity-80">Taxa do app:</span>
          <span className="font-semibold ml-1">{formatPercentage(feeCalc.feePercentage)} (R$ {formatCurrency(feeCalc.feeAmount)})</span>
        </div>
        <div className="text-right">
          <span className="opacity-80">Líquido p/ você:</span>
          <span className="font-bold ml-1">R$ {formatCurrency(feeCalc.providerNetAmount)}</span>
        </div>
      </div>
    </div>
  );
}
