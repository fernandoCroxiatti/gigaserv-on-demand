import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { PlacesAutocomplete } from '../Map/PlacesAutocomplete';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Button } from '../ui/button';
import { MapPin, Navigation, ChevronRight, Clock, Check, Loader2, RefreshCw } from 'lucide-react';
import { Location, ServiceType, SERVICE_CONFIG, serviceRequiresDestination } from '@/types/chamado';

export function ClientIdleView() {
  const { createChamado, availableProviders } = useApp();
  const { location: userLocation, loading: locationLoading, error: locationError, refresh: refreshLocation } = useGeolocation();
  
  const [selectedService, setSelectedService] = useState<ServiceType>('guincho');
  const [origem, setOrigem] = useState<Location | null>(null);
  const [origemText, setOrigemText] = useState<string>('');
  const [origemManuallySet, setOrigemManuallySet] = useState(false);
  const [destino, setDestino] = useState<Location | null>(null);
  const [destinoText, setDestinoText] = useState<string>('');

  const serviceConfig = SERVICE_CONFIG[selectedService];
  const needsDestination = serviceRequiresDestination(selectedService);

  // Auto-fill origin with GPS location ONLY if not manually set
  useEffect(() => {
    if (userLocation && !origem && !origemManuallySet) {
      setOrigem(userLocation);
      setOrigemText(userLocation.address);
    }
  }, [userLocation, origem, origemManuallySet]);

  const handleOrigemSelect = (location: Location) => {
    setOrigem(location);
    setOrigemText(location.address);
    setOrigemManuallySet(true); // Mark as manually set to prevent GPS override
  };

  const handleOrigemTextChange = (text: string) => {
    setOrigemText(text);
    // If user clears the field, allow GPS to re-fill
    if (!text.trim()) {
      setOrigemManuallySet(false);
      setOrigem(null);
    }
  };

  const handleDestinoSelect = (location: Location) => {
    setDestino(location);
    setDestinoText(location.address);
  };

  const handleSolicitar = () => {
    if (!origem) return;
    if (needsDestination && !destino) return;
    
    createChamado(selectedService, origem, needsDestination ? destino : null);
  };

  const onlineProviders = availableProviders.filter(p => p.online).length;
  const canSubmit = origem && (!needsDestination || destino);

  return (
    <div className="relative h-full">
      {/* Real Google Map */}
      <RealMapView 
        center={origem || userLocation}
        origem={origem}
        destino={needsDestination ? destino : null}
        showRoute={needsDestination && !!origem && !!destino}
        providers={availableProviders.filter(p => p.online).map(p => ({
          id: p.id,
          location: p.location,
          name: p.name,
        }))}
        showUserLocation={!origem}
        className="absolute inset-0" 
        zoom={origem ? 16 : 15}
      />
      
      {/* Providers online indicator */}
      <div className="absolute top-24 left-4 right-4 z-10">
        <div className="glass-card rounded-2xl p-3 flex items-center gap-3 animate-fade-in">
          <div className="relative">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Navigation className="w-5 h-5 text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {onlineProviders}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{onlineProviders} prestadores online</p>
            <p className="text-xs text-muted-foreground">Prontos para atender você</p>
          </div>
        </div>
      </div>

      {/* Bottom card */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Service type selector */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Tipo de serviço</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SERVICE_CONFIG) as ServiceType[]).map((serviceType) => {
                const config = SERVICE_CONFIG[serviceType];
                const isSelected = selectedService === serviceType;
                return (
                  <button
                    key={serviceType}
                    onClick={() => {
                      setSelectedService(serviceType);
                      if (!serviceRequiresDestination(serviceType)) {
                        setDestino(null);
                        setDestinoText('');
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      isSelected 
                        ? 'bg-primary/10 border-2 border-primary' 
                        : 'bg-secondary border-2 border-transparent hover:border-border'
                    }`}
                  >
                    <span className="text-2xl">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${isSelected ? 'text-primary' : ''}`}>
                        {config.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {config.estimatedTime}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded-lg">
              {serviceConfig.description}
            </p>
          </div>

          {/* Location inputs */}
          <div className="space-y-3">
            {/* Origin with Places Autocomplete */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">
                  🚗 Onde está o veículo?
                </p>
                {locationLoading && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                {locationError && (
                  <button onClick={refreshLocation} className="flex items-center gap-1 text-xs text-destructive">
                    <RefreshCw className="w-3 h-3" />
                    Tentar novamente
                  </button>
                )}
              </div>
              <PlacesAutocomplete
                value={origemText}
                onChange={handleOrigemTextChange}
                onSelect={handleOrigemSelect}
                placeholder={locationLoading ? "Obtendo localização..." : "Digite o endereço"}
                icon={
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                }
              />
              {locationError && (
                <p className="text-xs text-destructive mt-1">{locationError}</p>
              )}
            </div>

            {/* Destination - only for guincho */}
            {needsDestination && (
              <div className="animate-fade-in">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  📍 Para onde deseja levar?
                </p>
                <PlacesAutocomplete
                  value={destinoText}
                  onChange={setDestinoText}
                  onSelect={handleDestinoSelect}
                  placeholder="Oficina, casa ou outro destino"
                  icon={
                    <div className="w-6 h-6 bg-foreground rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  }
                />
              </div>
            )}

            {/* Info for local services */}
            {!needsDestination && (
              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl animate-fade-in">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  O prestador irá até você. Não é necessário informar destino.
                </p>
              </div>
            )}
          </div>

          {/* Submit button */}
          <Button 
            onClick={handleSolicitar}
            className="w-full"
            size="lg"
            disabled={!canSubmit}
          >
            <span className="mr-2">{serviceConfig.icon}</span>
            Solicitar {serviceConfig.label}
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
