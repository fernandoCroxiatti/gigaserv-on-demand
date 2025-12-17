import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { X, Search, MapPin } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';

export function ClientSearchingView() {
  const { chamado, cancelChamado, availableProviders } = useApp();

  if (!chamado) return null;

  const serviceConfig = SERVICE_CONFIG[chamado.tipoServico];
  const hasDestination = chamado.destino !== null;

  return (
    <div className="relative h-full">
      {/* Full screen map with providers */}
      <MapView 
        showProviders 
        origem={chamado.origem}
        destino={chamado.destino}
        showRoute={hasDestination}
        className="absolute inset-0" 
      />

      {/* Search overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top info card */}
        <div className="absolute top-24 left-4 right-4 pointer-events-auto">
          <div className="glass-card rounded-2xl p-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl">{serviceConfig.icon}</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold">Buscando {serviceConfig.label}...</p>
                <p className="text-sm text-muted-foreground">
                  {availableProviders.filter(p => p.online).length} prestadores na região
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Animated search ring */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-48 h-48">
            <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-4 rounded-full border-4 border-primary/40 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
            <div className="absolute inset-8 rounded-full border-4 border-primary/50 animate-ping" style={{ animationDuration: '2s', animationDelay: '1s' }} />
          </div>
        </div>
      </div>

      {/* Bottom card */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg p-6 space-y-4">
          {/* Service type badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{serviceConfig.icon}</span>
            <span className="status-badge bg-primary/10 text-primary">{serviceConfig.label}</span>
          </div>

          {/* Trip info */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-3 bg-primary rounded-full" />
              {hasDestination && (
                <>
                  <div className="w-0.5 h-8 bg-border" />
                  <div className="w-3 h-3 bg-foreground rounded-full" />
                </>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {hasDestination ? 'Origem' : 'Local do atendimento'}
                </p>
                <p className="font-medium text-sm">{chamado.origem.address}</p>
              </div>
              {hasDestination && chamado.destino && (
                <div>
                  <p className="text-xs text-muted-foreground">Destino</p>
                  <p className="font-medium text-sm">{chamado.destino.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Loading animation */}
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">Aguardando resposta</span>
          </div>

          {/* Cancel button */}
          <Button 
            variant="outline" 
            onClick={cancelChamado}
            className="w-full"
            size="lg"
          >
            <X className="w-5 h-5" />
            Cancelar busca
          </Button>
        </div>
      </div>
    </div>
  );
}
