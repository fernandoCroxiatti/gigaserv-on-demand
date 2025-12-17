import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { Phone, MessageCircle, Navigation, MapPin, CheckCircle, DollarSign, Clock } from 'lucide-react';

export function ProviderInServiceView() {
  const { chamado, finishService } = useApp();

  if (!chamado) return null;

  return (
    <div className="relative h-full provider-theme">
      {/* Map with active route */}
      <MapView 
        origem={chamado.origem}
        destino={chamado.destino}
        showRoute
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
              <p className="font-semibold text-provider-primary">Navegando até o cliente</p>
              <p className="text-sm text-muted-foreground">Siga as instruções do GPS</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">2.3 km</p>
              <p className="text-sm text-muted-foreground">~8 min</p>
            </div>
          </div>
        </div>
      </div>

      {/* Turn-by-turn instruction */}
      <div className="absolute top-44 left-4 right-4 z-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-provider-primary text-white rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold">Vire à direita</p>
            <p className="text-sm opacity-80">Em 200m na Rua Augusta</p>
          </div>
        </div>
      </div>

      {/* Bottom card */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg">
          {/* Service info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-provider-primary/10 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-provider-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Serviço em andamento</p>
                <p className="text-sm text-muted-foreground">Iniciado às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
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
              <span className="text-sm font-medium">35%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-provider-primary rounded-full transition-all duration-1000"
                style={{ width: '35%' }}
              />
            </div>
          </div>

          {/* Route info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-3 h-3 bg-provider-primary rounded-full" />
                <div className="w-0.5 h-8 bg-provider-primary/30" />
                <div className="w-3 h-3 border-2 border-foreground rounded-full" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Buscando cliente em</p>
                  <p className="font-medium text-sm">{chamado.origem.address}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Destino final</p>
                  <p className="font-medium text-sm">{chamado.destino.address}</p>
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

          {/* Finish button */}
          <div className="p-4 pt-0">
            <Button 
              variant="provider"
              onClick={finishService}
              className="w-full"
              size="lg"
            >
              <CheckCircle className="w-5 h-5" />
              Finalizar serviço
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
