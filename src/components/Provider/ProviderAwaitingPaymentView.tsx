import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { Button } from '../ui/button';
import { 
  Clock, 
  User, 
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

      {/* Status header - compact */}
      <div className="absolute top-20 left-3 right-3 z-10 animate-slide-down">
        <div className="bg-card/95 backdrop-blur-md rounded-xl p-3 shadow-card">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-status-searching/10 rounded-full flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-status-searching" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-status-searching rounded-full flex items-center justify-center">
                <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-status-searching">Aguardando pagamento</p>
              <p className="text-xs text-muted-foreground">Cliente confirmando</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom info panel - compact */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-2xl shadow-uber-lg">
          {/* Payment waiting header - compact */}
          <div className="p-4 border-b border-border/50 text-center">
            <div className="w-12 h-12 bg-status-searching/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Clock className="w-6 h-6 text-status-searching animate-pulse" />
            </div>
            <h3 className="text-sm font-semibold mb-0.5">Aguardando pagamento</h3>
            <p className="text-xs text-muted-foreground">
              Você será notificado quando confirmado
            </p>
          </div>

          {/* Service details - compact */}
          <div className="p-3 border-b border-border/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Cliente</p>
                <p className="text-xs text-muted-foreground">Aguardando confirmação</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-provider-primary">R$ {chamado.valor?.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">Valor acordado</p>
              </div>
            </div>

            {/* Payment status indicator - compact */}
            <div className="flex items-center gap-2 p-2 bg-status-searching/10 rounded-lg">
              <Loader2 className="w-4 h-4 text-status-searching animate-spin" />
              <div className="flex-1">
                <p className="text-xs font-medium text-status-searching">Processando pagamento</p>
                <p className="text-[10px] text-muted-foreground">
                  Serviço inicia após confirmação
                </p>
              </div>
            </div>
          </div>

          {/* Route info - compact */}
          <div className="p-3 border-b border-border/30">
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-center gap-0.5 pt-0.5">
                <div className="w-2 h-2 bg-provider-primary rounded-full" />
                {hasDestination && (
                  <>
                    <div className="w-px h-5 bg-border" />
                    <div className="w-2 h-2 border border-foreground rounded-full" />
                  </>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {hasDestination ? 'Buscar cliente em' : 'Local do atendimento'}
                  </p>
                  <p className="font-medium text-xs truncate">{chamado.origem.address}</p>
                </div>
                {hasDestination && chamado.destino && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Destino final</p>
                    <p className="font-medium text-xs truncate">{chamado.destino.address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* What happens next - compact */}
          <div className="p-3 border-b border-border/30">
            <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Próximos passos</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-status-searching/10 rounded-full flex items-center justify-center">
                  <CreditCard className="w-3 h-3 text-status-searching" />
                </div>
                <div className="flex-1">
                  <p className="text-xs">Cliente confirma pagamento</p>
                </div>
                <Loader2 className="w-3 h-3 text-status-searching animate-spin" />
              </div>
              <div className="flex items-center gap-2 opacity-50">
                <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center">
                  <CheckCircle className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs">Navegação é liberada</p>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-50">
                <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center">
                  <Navigation className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs">Inicie o serviço</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact buttons - compact */}
          <div className="p-3 flex gap-2">
            <Button variant="outline" className="flex-1 h-10 text-sm" size="sm">
              <Phone className="w-4 h-4" />
              Ligar
            </Button>
            <Button variant="outline" className="flex-1 h-10 text-sm" size="sm">
              <MessageCircle className="w-4 h-4" />
              Mensagem
            </Button>
          </div>

          {/* Cancel option */}
          <div className="px-4 pb-4">
            <button 
              onClick={cancelChamado}
              className="w-full text-center text-xs text-destructive py-1.5"
            >
              Cancelar serviço
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
