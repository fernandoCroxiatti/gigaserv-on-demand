import React, { useEffect, useState } from 'react';
import { Loader2, DollarSign, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { calculateFee, formatCurrency, formatPercentage } from '@/lib/feeCalculator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DirectPaymentConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  onConfirmReceived: () => void;
  onNotReceived: () => void;
  isLoading?: boolean;
}

/**
 * Blocking modal that requires provider to confirm they received payment
 * before the ride can be finalized. Cannot be dismissed without action.
 */
export function DirectPaymentConfirmationDialog({
  open,
  onOpenChange,
  amount,
  onConfirmReceived,
  onNotReceived,
  isLoading = false,
}: DirectPaymentConfirmationDialogProps) {
  const [feePercentage, setFeePercentage] = useState<number>(0);

  // Fetch commission percentage
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
    
    if (open) {
      fetchCommission();
    }
  }, [open]);

  // Calculate fee using safe utility
  const { serviceValue, feeAmount, providerNetAmount, feePercentage: safeFeePercent } = calculateFee(amount, feePercentage);

  // Prevent closing via outside click or ESC - force explicit action
  const handleOpenChange = (newOpen: boolean) => {
    // Only allow closing via explicit button click, not by clicking outside or ESC
    if (!newOpen && !isLoading) {
      // Do nothing - user must click a button
      return;
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lg">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-500" />
            </div>
            Confirmar Recebimento
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-foreground">
                Confirme que você recebeu do cliente o valor de{' '}
                <strong className="text-primary">R$ {formatCurrency(serviceValue)}</strong>{' '}
                referente ao serviço.
              </p>
              
              {/* Fee breakdown card */}
              <div className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa do app:</span>
                  <span className="font-medium">{formatPercentage(safeFeePercent)} (R$ {formatCurrency(feeAmount)})</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border/50 pt-2">
                  <span className="text-muted-foreground">Valor líquido para você:</span>
                  <span className="font-bold text-primary">R$ {formatCurrency(providerNetAmount)}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  A taxa será cobrada posteriormente conforme os Termos de Uso. Só confirme se você já recebeu o valor do cliente.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel 
            onClick={onNotReceived}
            disabled={isLoading}
            className="flex-1"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmReceived}
            disabled={isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Finalizando...
              </>
            ) : (
              '✅ Recebido'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
