import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { DollarSign, CheckCircle, Loader2 } from 'lucide-react';

interface DirectPaymentConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  onConfirmReceived: () => void;
  onNotReceived: () => void;
  isLoading?: boolean;
}

/**
 * Blocking dialog that requires provider to confirm they received
 * direct payment from client before finishing the service.
 * 
 * IMPORTANT: This dialog cannot be dismissed by clicking outside or pressing ESC.
 * Provider MUST explicitly choose an action.
 */
export function DirectPaymentConfirmationDialog({
  open,
  onOpenChange,
  amount,
  onConfirmReceived,
  onNotReceived,
  isLoading = false,
}: DirectPaymentConfirmationDialogProps) {
  // Safely format amount with fallback
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  
  return (
    <AlertDialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // Only allow closing via explicit button actions, not outside clicks
        if (!newOpen && !isLoading) {
          // Don't allow close - user must choose an action
          return;
        }
        onOpenChange(newOpen);
      }}
    >
      <AlertDialogContent 
        className="max-w-sm"
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
              <DollarSign className="w-8 h-8 text-amber-500" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Confirmar recebimento
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-center text-base space-y-3">
              <p>
                Confirme que você recebeu do cliente o valor de{' '}
                <span className="font-bold text-foreground">R$ {safeAmount.toFixed(2)}</span>{' '}
                referente ao serviço.
              </p>
              <p className="text-sm text-muted-foreground">
                A corrida só pode ser finalizada após confirmar o recebimento.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col mt-4">
          <Button
            onClick={onConfirmReceived}
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Recebido
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onNotReceived}
            disabled={isLoading}
            className="w-full h-12 text-base"
          >
            Cancelar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
