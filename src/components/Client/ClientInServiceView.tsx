import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { Phone, MessageCircle, Star, Navigation, Shield, Clock } from 'lucide-react';

export function ClientInServiceView() {
  const { chamado, availableProviders, cancelChamado } = useApp();

  if (!chamado) return null;

  const provider = availableProviders.find(p => p.id === chamado.prestadorId);

  return (
    <div className="relative h-full">
      {/* Map with active route */}
      <MapView 
        origem={chamado.origem}
        destino={chamado.destino}
        showRoute
        className="absolute inset-0" 
      />

      {/* Status header */}
      <div className="absolute top-24 left-4 right-4 z-10 animate-slide-down">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-status-inService/10 rounded-full flex items-center justify-center">
                <Navigation className="w-6 h-6 text-status-inService animate-pulse" />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-status-inService">Serviço em andamento</p>
              <p className="text-sm text-muted-foreground">O prestador está a caminho</p>
            </div>
            <div className="flex items-center gap-1 text-sm bg-secondary px-3 py-1.5 rounded-full">
              <Clock className="w-4 h-4" />
              <span>~15 min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety tip */}
      <div className="absolute top-44 left-4 right-4 z-10 animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <div className="bg-status-searching/10 rounded-xl p-3 flex items-center gap-3">
          <Shield className="w-5 h-5 text-status-searching" />
          <p className="text-sm text-status-searching">
            Compartilhe sua viagem com amigos e família
          </p>
        </div>
      </div>

      {/* Bottom provider card */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg">
          {/* Provider info */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img 
                  src={provider?.avatar} 
                  alt={provider?.name}
                  className="w-16 h-16 rounded-full border-2 border-status-inService"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-status-inService rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{provider?.name}</h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="w-4 h-4 text-status-searching fill-current" />
                  <span>{provider?.rating}</span>
                  <span>•</span>
                  <span>{provider?.totalServices} serviços</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">R$ {chamado.valor?.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Trip progress */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-status-inService rounded-full transition-all duration-1000"
                  style={{ width: '35%' }}
                />
              </div>
              <span className="text-sm text-muted-foreground">35%</span>
            </div>
          </div>

          {/* Route info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-3 h-3 bg-status-inService rounded-full" />
                <div className="w-0.5 h-8 bg-status-inService/30" />
                <div className="w-3 h-3 border-2 border-foreground rounded-full" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Origem</p>
                  <p className="font-medium text-sm">{chamado.origem.address}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Destino</p>
                  <p className="font-medium text-sm">{chamado.destino.address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
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

          {/* Emergency cancel */}
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
