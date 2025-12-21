import React, { useEffect, useState } from 'react';
import { Loader2, DollarSign, AlertTriangle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { calculateFee, formatCurrency, formatPercentage, canFinalizeWithFee, createFeeAuditLog } from '@/lib/feeCalculator';
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
  chamadoId?: string;
  onConfirmReceived: () => void;
  onNotReceived: () => void;
  isLoading?: boolean;
}

/**
 * Blocking modal that requires provider to confirm they received payment
 * before the ride can be finalized.
 * 
 * REQUIRED TEXT (compliance):
 * "Confirme que você recebeu o pagamento de R$ {valorCorrida} diretamente do cliente."
 * 
 * Cannot be dismissed without explicit action.
 */
export function DirectPaymentConfirmationDialog({
  open,
  onOpenChange,
  amount,
  chamadoId,
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

  // Calculate fee using safe utility with invariant checks
  const feeCalc = calculateFee(amount, feePercentage);
  const canFinalize = canFinalizeWithFee(feeCalc);

  // Prevent closing via outside click or ESC - force explicit action
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      return; // User must click a button
    }
    onOpenChange(newOpen);
  };

  // Handle confirmation with audit logging
  const handleConfirm = async () => {
    if (!canFinalize) {
      console.error('[DirectPaymentConfirmation] Cannot finalize - invalid calculation');
      return;
    }
    
    // Create audit log
    const auditLog = createFeeAuditLog(feeCalc);
    console.log('[DirectPaymentConfirmation] Audit log:', auditLog);
    
    // Call the parent handler
    onConfirmReceived();
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
              {/* REQUIRED CONFIRMATION TEXT */}
              <p className="text-sm text-foreground font-medium">
                Confirme que você recebeu o pagamento de{' '}
                <strong className="text-primary">R$ {formatCurrency(feeCalc.serviceValue)}</strong>{' '}
                diretamente do cliente.
              </p>
              
              {/* Fee breakdown card */}
              <div className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor da corrida:</span>
                  <span className="font-medium">R$ {formatCurrency(feeCalc.serviceValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa do app:</span>
                  <span className="font-medium">{formatPercentage(feeCalc.feePercentage)} (R$ {formatCurrency(feeCalc.feeAmount)})</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border/50 pt-2">
                  <span className="text-muted-foreground">Valor líquido para você:</span>
                  <span className="font-bold text-primary">R$ {formatCurrency(feeCalc.providerNetAmount)}</span>
                </div>
              </div>
              
              {/* Warning about fee */}
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  A taxa de R$ {formatCurrency(feeCalc.feeAmount)} será registrada como devida ao GIGA S.O.S conforme os Termos de Uso.
                </p>
              </div>
              
              {/* Validation error if any */}
              {!canFinalize && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">
                    {feeCalc.validationError || 'Erro no cálculo. Contate o suporte.'}
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel 
            onClick={onNotReceived}
            disabled={isLoading}
            className="flex-1"
          >
            ❌ Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || !canFinalize}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50"
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
