import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { Button } from '../ui/button';
import { Phone, MessageCircle, Navigation, CheckCircle, DollarSign, Flag } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';

export function ProviderInServiceView() {
  const { chamado, finishService } = useApp();

  if (!chamado) return null;

  const serviceConfig = SERVICE_CONFIG[chamado.tipoServico];
  const hasDestination = chamado.destino !== null;

  return (
    <div className="relative h-full provider-theme">
      {/* Map with active route */}
      <RealMapView 
        origem={chamado.origem}
        destino={chamado.destino || undefined}
        showRoute={hasDestination}
        className="absolute inset-0" 
      />

      {/* Navigation header */}
      <div className="absolute top-24 left-4 right-4 z-10 animate-slide-down">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-provider-primary rounded-full flex items-center justify-center">
              <Navigation className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-provider-primary">
                {hasDestination ? 'Navegando com veículo' : 'Navegando até o cliente'}
              </p>
              <p className="text-sm text-muted-foreground">
                {serviceConfig.label} em andamento
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">--</p>
              <p className="text-sm text-muted-foreground">--</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom card */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg">
          {/* Service info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-provider-primary/10 rounded-full flex items-center justify-center">
                <span className="text-2xl">{serviceConfig.icon}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold">{serviceConfig.label}</p>
                <p className="text-sm text-muted-foreground">
                  Iniciado às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-1 text-lg font-bold">
                <DollarSign className="w-5 h-5 text-provider-primary" />
                R$ {chamado.valor?.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Progresso</span>
              <span className="text-sm font-medium">Em andamento</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-provider-primary rounded-full transition-all duration-1000 animate-pulse"
                style={{ width: '50%' }}
              />
            </div>
          </div>

          {/* Route info - adapts based on service type */}
          <div className="p-4 border-b border-border">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-3 h-3 bg-provider-primary rounded-full" />
                {hasDestination && (
                  <>
                    <div className="w-0.5 h-8 bg-provider-primary/30" />
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
                    <p className="text-xs text-muted-foreground">Entregar em</p>
                    <p className="font-medium text-sm">{chamado.destino.address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Service mode info */}
          {!hasDestination && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3 p-3 bg-provider-primary/5 rounded-xl">
                <CheckCircle className="w-5 h-5 text-provider-primary" />
                <p className="text-sm">
                  Atendimento no local - realize o serviço e finalize
                </p>
              </div>
            </div>
          )}

          {/* Guincho multi-step info */}
          {hasDestination && (
            <div className="p-4 border-b border-border">
              <p className="text-xs text-muted-foreground mb-2">Etapas do serviço</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-provider-primary" />
                  <span className="text-sm">1. Buscar veículo na origem</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-provider-primary" />
                  <span className="text-sm text-muted-foreground">2. Levar até o destino</span>
                </div>
              </div>
            </div>
          )}

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

          {/* Finish button */}
          <div className="p-4 pt-0">
            <Button 
              variant="provider"
              onClick={finishService}
              className="w-full"
              size="lg"
            >
              <Flag className="w-5 h-5" />
              Finalizar serviço
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
