import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { NavigationMapView } from '../Map/NavigationMapView';
import { Button } from '../ui/button';
import { Phone, MessageCircle, Navigation, CheckCircle, Flag, MapPin, ArrowRight, Clock, Route, AlertCircle, Loader2 } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { useRealtimeGPS } from '@/hooks/useRealtimeGPS';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type NavigationStep = 'going_to_vehicle' | 'going_to_destination';

export function ProviderInServiceView() {
  const { chamado, finishService, profile } = useApp();
  const [navigationStep, setNavigationStep] = useState<NavigationStep>('going_to_vehicle');
  const [showDetails, setShowDetails] = useState(false);
  const [eta, setEta] = useState<string>('Calculando...');
  const [distance, setDistance] = useState<string>('Calculando...');
  const [isConfirming, setIsConfirming] = useState(false);

  // Real-time GPS tracking
  const { location: providerLocation, error: gpsError, loading: gpsLoading } = useRealtimeGPS({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
    onLocationUpdate: async (location) => {
      // Update provider location in database
      if (profile?.user_id) {
        try {
          await supabase
            .from('provider_data')
            .update({
              current_lat: location.lat,
              current_lng: location.lng,
              current_address: location.address,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', profile.user_id);
        } catch (error) {
          console.error('[GPS] Failed to update provider location:', error);
        }
      }
    },
  });

  if (!chamado) return null;

  const serviceConfig = SERVICE_CONFIG[chamado.tipoServico];
  const hasDestination = chamado.destino !== null;

  // Determine current navigation target based on step
  const isGoingToVehicle = navigationStep === 'going_to_vehicle';
  
  // For services without destination, only show going to vehicle then finish
  const canConfirmArrival = isGoingToVehicle;
  const canFinish = !hasDestination || navigationStep === 'going_to_destination';

  // Current destination based on navigation step
  const currentDestination = isGoingToVehicle ? chamado.origem : chamado.destino;

  const handleRouteUpdate = useCallback((duration: string, dist: string) => {
    setEta(duration);
    setDistance(dist);
  }, []);

  const handleConfirmArrival = async () => {
    if (!hasDestination) return;
    
    setIsConfirming(true);
    try {
      // Could update database status here if needed
      setNavigationStep('going_to_destination');
      setEta('Calculando...');
      setDistance('Calculando...');
      toast.success('Chegada confirmada!', {
        description: 'Agora leve o veículo ao destino.',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleFinishService = async () => {
    setIsConfirming(true);
    try {
      await finishService();
    } finally {
      setIsConfirming(false);
    }
  };

  // GPS Error state
  if (gpsError) {
    return (
      <div className="h-full flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">GPS Necessário</h2>
          <p className="text-muted-foreground mb-4">{gpsError}</p>
          <p className="text-sm text-muted-foreground">
            Ative a localização nas configurações do seu navegador para usar a navegação.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (gpsLoading || !providerLocation) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-provider-primary mx-auto mb-4" />
          <p className="font-medium">Iniciando GPS...</p>
          <p className="text-sm text-muted-foreground">Aguarde a localização</p>
        </div>
      </div>
    );
  }

  if (!currentDestination) return null;

  return (
    <div className="relative h-full provider-theme">
      {/* Full screen navigation map - key forces recalculation when step changes */}
      <NavigationMapView 
        key={`nav-${navigationStep}`}
        providerLocation={providerLocation}
        destination={currentDestination}
        onRouteUpdate={handleRouteUpdate}
        followProvider={true}
        className="absolute inset-0" 
      />

      {/* Navigation header - floating */}
      <div className="absolute top-24 left-4 right-4 z-10 animate-slide-down">
        <div className="glass-card rounded-2xl p-4 bg-white/95 backdrop-blur-sm shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-provider-primary rounded-full flex items-center justify-center">
              <Navigation className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-provider-primary text-lg">
                {isGoingToVehicle ? 'Indo até o veículo' : 'Levando ao destino'}
              </p>
              <p className="text-sm text-muted-foreground">
                {serviceConfig.label} • R$ {chamado.valor?.toFixed(2)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="text-provider-primary"
            >
              {showDetails ? 'Ocultar' : 'Detalhes'}
            </Button>
          </div>

          {/* ETA and Distance - always visible */}
          <div className="mt-3 flex items-center gap-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2 flex-1">
              <Clock className="w-5 h-5 text-provider-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Tempo estimado</p>
                <p className="font-bold text-lg">{eta}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Route className="w-5 h-5 text-provider-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Distância</p>
                <p className="font-bold text-lg">{distance}</p>
              </div>
            </div>
          </div>

          {/* Expandable destination info */}
          {showDetails && (
            <div className="mt-4 pt-4 border-t border-border space-y-3 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-provider-primary rounded-full mt-1" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {isGoingToVehicle ? 'Buscar veículo em' : 'Origem'}
                  </p>
                  <p className="font-medium text-sm">{chamado.origem.address}</p>
                </div>
              </div>
              {hasDestination && chamado.destino && (
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 border-2 border-foreground rounded-full mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground">Entregar em</p>
                    <p className="font-medium text-sm">{chamado.destino.address}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step indicator - floating */}
      {hasDestination && (
        <div className="absolute top-56 left-1/2 -translate-x-1/2 z-10 animate-fade-in">
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isGoingToVehicle 
                ? 'bg-provider-primary text-white' 
                : 'bg-green-500 text-white'
            }`}>
              {isGoingToVehicle ? '1' : <CheckCircle className="w-4 h-4" />}
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              !isGoingToVehicle 
                ? 'bg-provider-primary text-white' 
                : 'bg-muted text-muted-foreground'
            }`}>
              2
            </div>
          </div>
        </div>
      )}

      {/* Bottom action card */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg">
          {/* Current step info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                isGoingToVehicle ? 'bg-provider-primary/10' : 'bg-green-500/10'
              }`}>
                {isGoingToVehicle ? (
                  <MapPin className="w-7 h-7 text-provider-primary" />
                ) : (
                  <Flag className="w-7 h-7 text-green-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">
                  {isGoingToVehicle 
                    ? 'Chegue até o veículo' 
                    : 'Leve ao destino final'
                  }
                </p>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {currentDestination.address}
                </p>
              </div>
            </div>
          </div>

          {/* Progress indicator */}
          {hasDestination && (
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Progresso</span>
                <span className="text-sm font-medium">
                  {isGoingToVehicle ? 'Etapa 1 de 2' : 'Etapa 2 de 2'}
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-provider-primary rounded-full transition-all duration-500"
                  style={{ width: isGoingToVehicle ? '25%' : '75%' }}
                />
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

          {/* Main action button */}
          <div className="p-4 pt-0">
            {canConfirmArrival && hasDestination ? (
              <Button 
                variant="provider"
                onClick={handleConfirmArrival}
                className="w-full"
                size="lg"
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                Cheguei ao local
              </Button>
            ) : (
              <Button 
                variant="provider"
                onClick={handleFinishService}
                className="w-full"
                size="lg"
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Flag className="w-5 h-5" />
                )}
                Finalizar serviço
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
