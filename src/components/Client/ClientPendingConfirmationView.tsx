import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '../ui/button';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

/**
 * Client Pending Confirmation View
 * Shows when the provider has finished the service and is waiting for client confirmation.
 * Client can confirm that the service was completed or report an issue.
 */
export function ClientPendingConfirmationView() {
  const { chamado, confirmServiceFinish, disputeServiceFinish } = useApp();
  const [isConfirming, setIsConfirming] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [isDisputing, setIsDisputing] = useState(false);

  if (!chamado) return null;

  const serviceConfig = SERVICE_CONFIG[chamado.tipoServico];
  const serviceValue = chamado.valor || chamado.valorProposto || 0;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await confirmServiceFinish();
      toast.success('Serviço confirmado com sucesso!');
    } catch (error) {
      console.error('Error confirming service:', error);
      toast.error('Erro ao confirmar serviço');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDispute = async () => {
    setShowDisputeDialog(false);
    setIsDisputing(true);
    try {
      await disputeServiceFinish();
      toast.info('Disputa registrada. Entraremos em contato.');
    } catch (error) {
      console.error('Error disputing service:', error);
      toast.error('Erro ao registrar disputa');
    } finally {
      setIsDisputing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background p-6">
      {/* Header */}
      <div className="text-center mb-8 pt-8">
        <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-10 h-10 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Confirmar Finalização</h1>
        <p className="text-muted-foreground">
          O prestador finalizou o serviço. Por favor, confirme se tudo foi concluído corretamente.
        </p>
      </div>

      {/* Service Details */}
      <div className="bg-card rounded-xl p-4 mb-6 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{serviceConfig.icon}</span>
          <div className="flex-1">
            <p className="font-semibold">{serviceConfig.label}</p>
            <p className="text-sm text-muted-foreground">{serviceConfig.description}</p>
          </div>
        </div>
        
        <div className="border-t border-border pt-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Valor do serviço</span>
            <span className="text-xl font-bold">R$ {serviceValue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-muted/50 rounded-xl p-4 mb-8">
        <p className="text-sm text-muted-foreground text-center">
          Ao confirmar, você indica que o serviço foi realizado conforme combinado.
          Se houver algum problema, clique em "Reportar Problema".
        </p>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleConfirm}
          disabled={isConfirming || isDisputing}
          className="w-full h-14 text-lg font-semibold bg-green-600 hover:bg-green-700"
        >
          {isConfirming ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <CheckCircle className="w-5 h-5 mr-2" />
          )}
          Confirmar Finalização
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowDisputeDialog(true)}
          disabled={isConfirming || isDisputing}
          className="w-full h-12 text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          {isDisputing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <XCircle className="w-4 h-4 mr-2" />
          )}
          Reportar Problema
        </Button>
      </div>

      {/* Dispute Dialog */}
      <AlertDialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Reportar Problema
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está indicando que o serviço não foi concluído corretamente.
              Nossa equipe entrará em contato para resolver a situação.
              O chamado retornará ao status "Em Serviço".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDispute}
              className="bg-destructive hover:bg-destructive/90"
            >
              Reportar Problema
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
