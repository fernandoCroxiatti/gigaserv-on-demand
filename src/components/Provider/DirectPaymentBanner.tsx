import React, { useEffect, useState } from 'react';
import { DollarSign, AlertTriangle } from 'lucide-react';
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
 * This banner is ALWAYS visible and cannot be dismissed.
 */
export function DirectPaymentBanner({ amount }: DirectPaymentBannerProps) {
  const [feePercentage, setFeePercentage] = useState<number>(0);

  // Fetch commission percentage on mount
  useEffect(() => {
    const fetchCommission = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'app_commission_percentage')
          .single();
        
        if (data?.value) {
          const parsed = Number(data.value);
          setFeePercentage(isNaN(parsed) ? 0 : parsed);
        }
      } catch (err) {
        console.error('Error fetching commission:', err);
        setFeePercentage(0);
      }
    };
    fetchCommission();
  }, []);

  // Calculate fee using safe utility with invariant checks
  const feeCalc = calculateFee(amount, feePercentage);
  
  // If calculation is invalid, show safe defaults
  if (!canFinalizeWithFee(feeCalc)) {
    console.error('[DirectPaymentBanner] Invalid fee calculation:', feeCalc.validationError);
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