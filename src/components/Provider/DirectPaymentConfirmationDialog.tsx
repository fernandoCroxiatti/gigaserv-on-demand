import React, { useEffect, useState } from 'react';
import { Loader2, DollarSign, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
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
 * MANDATORY blocking modal that requires provider to confirm they received payment
 * before the ride can be finalized.
 * 
 * REQUIRED TEXT (compliance - Play Store Safe):
 * "O cliente informou que realizou o pagamento diretamente a você.
 *  Valor recebido: R$ {valorCorrida}
 *  Taxa do app: {taxaAppPercentual}% (R$ {taxaAppValor})
 *  Valor líquido para você: R$ {valorLiquidoPrestador}
 *  Confirme apenas se o pagamento foi recebido."
 * 
 * BUTTONS:
 * - ✅ Confirmar recebimento → authorize finalization
 * - ❌ Ainda não recebi → return to ride
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
  const [feePercentage, setFeePercentage] = useState<number | null>(null);
  const [loadingFee, setLoadingFee] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Fetch commission percentage when dialog opens
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
    
    if (open) {
      fetchCommission();
    }
  }, [open]);

  // Calculate fee using safe utility with invariant checks
  const feeCalc = calculateFee(amount, feePercentage);
  const canFinalize = canFinalizeWithFee(feeCalc) && !fetchError && !loadingFee;

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
            Confirmação de Recebimento
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              {/* Valor sempre visível */}
              <div className="bg-secondary/40 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Valor total da corrida</p>
                <p className="text-lg font-bold text-primary">R$ {formatCurrency(amount)}</p>
              </div>

              {/* Loading state */}
              {loadingFee && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
              
              {/* Error state - BLOCK */}
              {!loadingFee && (fetchError || feePercentage === null) && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">
                    Não foi possível calcular a taxa do app. Verifique a configuração antes de continuar.
                  </p>
                </div>
              )}
              
              {/* Valid calculation state */}
              {!loadingFee && !fetchError && feePercentage !== null && (
                <>
                  {/* REQUIRED CONFIRMATION TEXT (compliance) */}
                  <p className="text-sm text-foreground">
                    Confirme que você recebeu o pagamento do cliente.
                  </p>
                  
                  {/* Fee breakdown card - MANDATORY DISPLAY */}
                  <div className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa do app:</span>
                      <span className="font-medium">{formatPercentage(feeCalc.feePercentage)} (R$ {formatCurrency(feeCalc.feeAmount)})</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-border/50 pt-2">
                      <span className="text-muted-foreground">Valor líquido para você:</span>
                      <span className="font-bold text-primary">R$ {formatCurrency(feeCalc.providerNetAmount)}</span>
                    </div>
                  </div>
                  
                  {/* REQUIRED instruction */}
                  <p className="text-sm text-foreground font-medium text-center">
                    Clique em "Recebi o pagamento" apenas se o cliente já pagou.
                  </p>
                  
                  {/* Warning about fee registration */}
                  <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      A taxa de R$ {formatCurrency(feeCalc.feeAmount)} será registrada como devida ao GIGA S.O.S conforme os Termos de Uso.
                    </p>
                  </div>
                  
                  {/* Validation error if any */}
                  {!feeCalc.isValid && (
                    <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">
                        {feeCalc.validationError || 'Erro no cálculo. Contate o suporte.'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 flex-col gap-2 sm:flex-col">
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || !canFinalize}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 h-12 text-base font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Recebi o pagamento
              </>
            )}
          </AlertDialogAction>
          <AlertDialogCancel 
            onClick={onNotReceived}
            disabled={isLoading}
            className="w-full mt-0"
          >
            Cancelar
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
