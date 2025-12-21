import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DollarSign, XCircle, CheckCircle } from 'lucide-react';

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
 */
export function DirectPaymentConfirmationDialog({
  open,
  onOpenChange,
  amount,
  onConfirmReceived,
  onNotReceived,
  isLoading = false,
}: DirectPaymentConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
              <DollarSign className="w-8 h-8 text-amber-500" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Confirmação de recebimento
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base">
            Você recebeu do cliente o valor de{' '}
            <span className="font-bold text-foreground">R$ {amount.toFixed(2)}</span>?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction
            onClick={onConfirmReceived}
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            {isLoading ? 'Processando...' : 'Recebido'}
          </AlertDialogAction>
          <AlertDialogCancel
            onClick={onNotReceived}
            disabled={isLoading}
            className="w-full h-12 text-base mt-0"
          >
            <XCircle className="w-5 h-5 mr-2" />
            Ainda não recebi
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
