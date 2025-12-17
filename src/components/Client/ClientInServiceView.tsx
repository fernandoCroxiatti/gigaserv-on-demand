import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { NavigationMapView } from '../Map/NavigationMapView';
import { Button } from '../ui/button';
import { Phone, MessageCircle, Star, Navigation, Shield, Clock, CheckCircle, MapPin, Route, Loader2 } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { useProviderTracking } from '@/hooks/useProviderTracking';

export function ClientInServiceView() {
  const { chamado, availableProviders, cancelChamado } = useApp();
  const [eta, setEta] = useState<string>('Calculando...');
  const [distance, setDistance] = useState<string>('Calculando...');

  // Real-time provider location tracking
  const { location: providerLocation, loading: trackingLoading } = useProviderTracking(
    chamado?.prestadorId
  );

  if (!chamado) return null;

  const provider = availableProviders.find(p => p.id === chamado.prestadorId);
  const serviceConfig = SERVICE_CONFIG[chamado.tipoServico];
  const hasDestination = chamado.destino !== null;

  const handleRouteUpdate = useCallback((duration: string, dist: string) => {
    setEta(duration);
    setDistance(dist);
  }, []);

  return (
    <div className="relative h-full">
      {/* Map with provider tracking */}
      <NavigationMapView 
        providerLocation={providerLocation}
        destination={chamado.origem}
        onRouteUpdate={handleRouteUpdate}
        followProvider={false}
        className="absolute inset-0" 
      />

      {/* Status header with ETA */}
      <div className="absolute top-24 left-4 right-4 z-10 animate-slide-down">
        <div className="glass-card rounded-2xl p-4 bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-status-inService/10 rounded-full flex items-center justify-center">
                <Navigation className="w-6 h-6 text-status-inService animate-pulse" />
              </div>
              {providerLocation && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-status-inService">
                {providerLocation ? 'Prestador a caminho' : 'Localizando prestador...'}
              </p>
              <p className="text-sm text-muted-foreground">
                {serviceConfig.label}
              </p>
            </div>
          </div>

          {/* ETA and Distance */}
          {providerLocation && (
            <div className="mt-3 flex items-center gap-4 pt-3 border-t border-border">
              <div className="flex items-center gap-2 flex-1">
                <Clock className="w-5 h-5 text-status-inService" />
                <div>
                  <p className="text-xs text-muted-foreground">Chegada em</p>
                  <p className="font-bold text-lg">{eta}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Route className="w-5 h-5 text-status-inService" />
                <div>
                  <p className="text-xs text-muted-foreground">Distância</p>
                  <p className="font-bold text-lg">{distance}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator when tracking */}
          {trackingLoading && (
            <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Conectando ao GPS do prestador...</p>
            </div>
          )}
        </div>
      </div>

      {/* Safety tip */}
      <div className="absolute top-52 left-4 right-4 z-10 animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <div className="bg-status-searching/10 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3">
          <Shield className="w-5 h-5 text-status-searching" />
          <p className="text-sm text-status-searching">
            Acompanhe o prestador em tempo real
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

          {/* Live location indicator */}
          {providerLocation && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-xl">
                <div className="relative">
                  <MapPin className="w-5 h-5 text-green-600" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700">GPS ativo em tempo real</p>
                  <p className="text-xs text-green-600 truncate">{providerLocation.address}</p>
                </div>
              </div>
            </div>
          )}

          {/* Route info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-3 h-3 bg-status-inService rounded-full" />
                {hasDestination && (
                  <>
                    <div className="w-0.5 h-8 bg-status-inService/30" />
                    <div className="w-3 h-3 border-2 border-foreground rounded-full" />
                  </>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {hasDestination ? 'Local do veículo' : 'Local do atendimento'}
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
            </div>
          </div>

          {/* Service type info for local services */}
          {!hasDestination && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl">
                <CheckCircle className="w-5 h-5 text-primary" />
                <p className="text-sm">
                  {serviceConfig.label}: atendimento no local do veículo
                </p>
              </div>
            </div>
          )}

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
