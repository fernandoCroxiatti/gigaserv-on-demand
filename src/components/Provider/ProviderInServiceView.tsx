import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { Button } from '../ui/button';
import { Phone, MessageCircle, Navigation, CheckCircle, DollarSign, Flag, MapPin, ArrowRight } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';

type NavigationStep = 'going_to_vehicle' | 'going_to_destination';

export function ProviderInServiceView() {
  const { chamado, finishService } = useApp();
  const [navigationStep, setNavigationStep] = useState<NavigationStep>('going_to_vehicle');
  const [showDetails, setShowDetails] = useState(false);

  if (!chamado) return null;

  const serviceConfig = SERVICE_CONFIG[chamado.tipoServico];
  const hasDestination = chamado.destino !== null;

  // Determine current navigation target based on step
  const isGoingToVehicle = navigationStep === 'going_to_vehicle';
  
  // For services without destination, only show going to vehicle then finish
  const canConfirmArrival = isGoingToVehicle;
  const canFinish = !hasDestination || navigationStep === 'going_to_destination';

  const handleConfirmArrival = () => {
    if (hasDestination) {
      setNavigationStep('going_to_destination');
    }
  };

  // Map props based on current step
  const mapOrigin = isGoingToVehicle ? null : chamado.origem;
  const mapDestination = isGoingToVehicle ? chamado.origem : chamado.destino;
  const showRoute = !isGoingToVehicle && hasDestination;

  return (
    <div className="relative h-full provider-theme">
      {/* Full screen map */}
      <RealMapView 
        center={isGoingToVehicle ? chamado.origem : chamado.destino}
        origem={mapOrigin}
        destino={mapDestination}
        showRoute={showRoute}
        showUserLocation={true}
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
        <div className="absolute top-48 left-1/2 -translate-x-1/2 z-10 animate-fade-in">
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
                <p className="text-sm text-muted-foreground">
                  {isGoingToVehicle 
                    ? chamado.origem.address
                    : chamado.destino?.address || 'Finalize o serviço no local'
                  }
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
              >
                <CheckCircle className="w-5 h-5" />
                Confirmar chegada ao veículo
              </Button>
            ) : (
              <Button 
                variant="provider"
                onClick={finishService}
                className="w-full"
                size="lg"
              >
                <Flag className="w-5 h-5" />
                Finalizar serviço
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
