import React from 'react';
import { DollarSign, AlertTriangle } from 'lucide-react';

interface DirectPaymentBannerProps {
  amount: number;
}

/**
 * Sticky banner shown to provider during service when payment is direct to provider.
 * Reminds provider to collect payment from client.
 * This banner is ALWAYS visible and cannot be dismissed.
 */
export function DirectPaymentBanner({ amount }: DirectPaymentBannerProps) {
  // Safely format amount with fallback to prevent NaN
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  
  return (
    <div className="bg-amber-500 text-white px-4 py-3 flex items-center justify-center gap-3 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 rounded-full p-2">
          <DollarSign className="w-6 h-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium opacity-90">Receba do cliente</span>
          <span className="text-xl font-bold">R$ {safeAmount.toFixed(2)}</span>
        </div>
        <AlertTriangle className="w-6 h-6 ml-2 animate-bounce" />
      </div>
    </div>
  );
}
