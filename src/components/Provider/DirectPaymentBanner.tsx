import React from 'react';
import { DollarSign, AlertTriangle } from 'lucide-react';

interface DirectPaymentBannerProps {
  amount: number;
}

/**
 * Sticky banner shown to provider during service when payment is direct to provider.
 * Reminds provider to collect payment from client.
 */
export function DirectPaymentBanner({ amount }: DirectPaymentBannerProps) {
  return (
    <div className="bg-amber-500 text-white px-4 py-3 flex items-center justify-center gap-3 shadow-lg animate-pulse-subtle">
      <div className="flex items-center gap-2">
        <div className="bg-white/20 rounded-full p-1.5">
          <DollarSign className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium opacity-90">Receba do cliente</span>
          <span className="text-lg font-bold">R$ {amount.toFixed(2)}</span>
        </div>
      </div>
      <AlertTriangle className="w-5 h-5 ml-2 animate-bounce" />
    </div>
  );
}
