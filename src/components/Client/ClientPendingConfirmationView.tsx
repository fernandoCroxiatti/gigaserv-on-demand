import React, { useState, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '../ui/button';
import { CheckCircle, XCircle, Loader2, AlertTriangle, Clock, Timer } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { toast } from 'sonner';
import { useAutoFinishCountdown } from '@/hooks/useAutoFinishCountdown';
import { useAutoFinishCheck } from '@/hooks/useAutoFinishCheck';
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
import { Progress } from "@/components/ui/progress";

/**
 * Client Pending Confirmation View
 * Shows when the provider has finished the service and is waiting for client confirmation.
 * Client can confirm that the service was completed or report an issue.
 * Includes a countdown timer showing when the service will be auto-finished.
 */
export function ClientPendingConfirmationView() {
  const { chamado, confirmServiceFinish, disputeServiceFinish } = useApp();
  const [isConfirming, setIsConfirming] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [isDisputing, setIsDisputing] = useState(false);

  const { formattedTime, progressPercent, remainingMinutes, isExpired } = useAutoFinishCountdown(
    chamado?.providerFinishRequestedAt
  );

  // Auto-finish check (client-side backup)
  const handleAutoFinished = useCallback(() => {
    toast.info('Serviço finalizado automaticamente pelo sistema.');
  }, []);

  useAutoFinishCheck({
    chamadoId: chamado?.id,
    status: chamado?.status,
    providerFinishRequestedAt: chamado?.providerFinishRequestedAt,
    onAutoFinished: handleAutoFinished,
  });

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
      {/* Urgent Banner */}
      <div className="bg-orange-500 text-white rounded-xl p-4 mb-4 animate-pulse">
        <div className="flex items-center gap-3">
          <Timer className="w-6 h-6 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm">Confirmação Pendente</p>
            <p className="text-xs opacity-90">
              Confirme o serviço para liberar o prestador
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-6 pt-4">
        <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-10 h-10 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Confirmar Finalização</h1>
        <p className="text-muted-foreground">
          O prestador finalizou o serviço. Por favor, confirme se tudo foi concluído corretamente.
        </p>
      </div>

      {/* Countdown Timer */}
      <div className="bg-muted rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-medium">Tempo restante</span>
          </div>
          <span className={`text-xl font-bold tabular-nums ${remainingMinutes <= 2 ? 'text-destructive' : 'text-orange-500'}`}>
            {isExpired ? '00:00' : formattedTime}
          </span>
        </div>
        <Progress 
          value={progressPercent} 
          className="h-2"
        />
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {isExpired 
            ? 'O serviço será finalizado automaticamente a qualquer momento.'
            : `O serviço será finalizado automaticamente em ${remainingMinutes} minuto${remainingMinutes !== 1 ? 's' : ''}.`
          }
        </p>
      </div>

      {/* Service Details */}
      <div className="bg-card rounded-xl p-4 mb-4 shadow-card">
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
      <div className="bg-muted/50 rounded-xl p-4 mb-4">
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