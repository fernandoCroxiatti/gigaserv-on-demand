import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Clock, CheckCircle } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';

/**
 * Provider Pending Confirmation View
 * Shows when the provider has finished the service and is waiting for client confirmation.
 */
export function ProviderPendingConfirmationView() {
  const { chamado } = useApp();

  if (!chamado) return null;

  const serviceConfig = SERVICE_CONFIG[chamado.tipoServico];
  const serviceValue = chamado.valor || chamado.valorProposto || 0;

  return (
    <div className="h-full flex flex-col bg-background p-6">
      {/* Header */}
      <div className="text-center mb-8 pt-8">
        <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 relative">
          <Clock className="w-10 h-10 text-orange-500" />
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-white" />
          </span>
        </div>
        <h1 className="text-2xl font-bold mb-2">Aguardando Confirmação</h1>
        <p className="text-muted-foreground">
          Você finalizou o serviço. Aguarde o cliente confirmar a conclusão.
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
            <span className="text-xl font-bold text-green-600">R$ {serviceValue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Animated waiting indicator */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
          <p className="text-sm text-muted-foreground">
            O cliente está analisando o serviço...
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-muted/50 rounded-xl p-4">
        <p className="text-sm text-muted-foreground text-center">
          Quando o cliente confirmar, você receberá uma notificação e poderá avaliar o serviço.
        </p>
      </div>
    </div>
  );
}
