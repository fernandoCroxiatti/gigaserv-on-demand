import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { Button } from '../ui/button';
import { 
  Clock, 
  User, 
  DollarSign, 
  Navigation, 
  Loader2,
  CreditCard,
  CheckCircle,
  Phone,
  MessageCircle
} from 'lucide-react';

export function ProviderAwaitingPaymentView() {
  const { chamado, cancelChamado } = useApp();

  if (!chamado) return null;

  const hasDestination = chamado.destino !== null;

  return (
    <div className="relative h-full provider-theme">
      {/* Map with route */}
      <RealMapView 
        origem={chamado.origem}
        destino={chamado.destino || undefined}
        showRoute={hasDestination}
        className="absolute inset-0" 
      />

      {/* Status header */}
      <div className="absolute top-24 left-4 right-4 z-10 animate-slide-down">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-status-searching/10 rounded-full flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-status-searching" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-status-searching rounded-full flex items-center justify-center">
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-status-searching">Aguardando pagamento</p>
              <p className="text-sm text-muted-foreground">Cliente confirmando pagamento</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom info panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg">
          {/* Payment waiting header */}
          <div className="p-6 border-b border-border text-center">
            <div className="w-16 h-16 bg-status-searching/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-status-searching animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Aguardando pagamento do cliente</h3>
            <p className="text-sm text-muted-foreground">
              Você será notificado assim que o pagamento for confirmado
            </p>
          </div>

          {/* Service details */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Cliente</p>
                <p className="text-sm text-muted-foreground">Aguardando confirmação</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-provider-primary">R$ {chamado.valor?.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Valor acordado</p>
              </div>
            </div>

            {/* Payment status indicator */}
            <div className="flex items-center gap-3 p-3 bg-status-searching/10 rounded-xl">
              <Loader2 className="w-5 h-5 text-status-searching animate-spin" />
              <div className="flex-1">
                <p className="text-sm font-medium text-status-searching">Processando pagamento</p>
                <p className="text-xs text-muted-foreground">
                  O serviço iniciará automaticamente após confirmação
                </p>
              </div>
            </div>
          </div>

          {/* Route info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-3 h-3 bg-provider-primary rounded-full" />
                {hasDestination && (
                  <>
                    <div className="w-0.5 h-8 bg-border" />
                    <div className="w-3 h-3 border-2 border-foreground rounded-full" />
                  </>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {hasDestination ? 'Buscar cliente em' : 'Local do atendimento'}
                  </p>
                  <p className="font-medium text-sm">{chamado.origem.address}</p>
                </div>
                {hasDestination && chamado.destino && (
                  <div>
                    <p className="text-xs text-muted-foreground">Destino final</p>
                    <p className="font-medium text-sm">{chamado.destino.address}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Navigation className="w-4 h-4 text-provider-primary" />
                <span>--</span>
              </div>
            </div>
          </div>

          {/* What happens next */}
          <div className="p-4 border-b border-border">
            <p className="text-sm font-medium text-muted-foreground mb-3">Próximos passos</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-status-searching/10 rounded-full flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-status-searching" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">Cliente confirma pagamento</p>
                </div>
                <Loader2 className="w-4 h-4 text-status-searching animate-spin" />
              </div>
              <div className="flex items-center gap-3 opacity-50">
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">Navegação é liberada</p>
                </div>
              </div>
              <div className="flex items-center gap-3 opacity-50">
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                  <Navigation className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">Inicie o serviço</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact buttons */}
          <div className="p-4 flex gap-3">
            <Button variant="outline" className="flex-1" size="lg">
              <Phone className="w-5 h-5" />
              Ligar
            </Button>
            <Button variant="outline" className="flex-1" size="lg">
              <MessageCircle className="w-5 h-5" />
              Mensagem
            </Button>
          </div>

          {/* Cancel option */}
          <div className="p-4 pt-0">
            <button 
              onClick={cancelChamado}
              className="w-full text-center text-sm text-destructive py-2"
            >
              Cancelar serviço
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
