import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView, MapProvider } from '../Map/RealMapView';
import { PlacesAutocomplete } from '../Map/PlacesAutocomplete';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearbyProviders } from '@/hooks/useNearbyProviders';
import { Button } from '../ui/button';
import { Navigation, ChevronRight, Check, Loader2, RefreshCw, Crosshair } from 'lucide-react';
import { Location, ServiceType, SERVICE_CONFIG, serviceRequiresDestination } from '@/types/chamado';

const NEARBY_RADIUS_KM = 15;

export function ClientIdleView() {
  const { createChamado } = useApp();
  const { location: userLocation, loading: locationLoading, error: locationError, refresh: refreshLocation } = useGeolocation();
  
  const [selectedService, setSelectedService] = useState<ServiceType>('guincho');
  const [origem, setOrigem] = useState<Location | null>(null);
  const [origemText, setOrigemText] = useState<string>('');
  const [usingGpsLocation, setUsingGpsLocation] = useState(false);
  const [destino, setDestino] = useState<Location | null>(null);
  const [destinoText, setDestinoText] = useState<string>('');

  const serviceConfig = SERVICE_CONFIG[selectedService];
  const needsDestination = serviceRequiresDestination(selectedService);

  // Location for fetching nearby providers
  const searchLocation = useMemo(() => origem || userLocation, [origem, userLocation]);
  
  // Fetch nearby providers within 15km (no progressive search)
  const { providers: nearbyProviders, loading: providersLoading } = useNearbyProviders({
    userLocation: searchLocation,
    radiusKm: NEARBY_RADIUS_KM,
    enabled: !!searchLocation,
  });

  // Convert nearby providers to map format
  const mapProviders: MapProvider[] = useMemo(() => {
    return nearbyProviders.map(p => ({
      id: p.id,
      location: p.location,
      name: p.name,
      services: p.services,
      distance: p.distance,
    }));
  }, [nearbyProviders]);

  // Count providers for selected service
  const serviceProviderCount = useMemo(() => {
    return nearbyProviders.filter(p => p.services.includes(selectedService)).length;
  }, [nearbyProviders, selectedService]);

  const handleOrigemSelect = (location: Location) => {
    setOrigem(location);
    setOrigemText(location.address);
    setUsingGpsLocation(false);
  };

  const handleOrigemTextChange = (text: string) => {
    setOrigemText(text);
    if (!text.trim()) {
      setOrigem(null);
      setUsingGpsLocation(false);
    } else {
      setUsingGpsLocation(false);
    }
  };

  const handleUseMyLocation = () => {
    if (userLocation) {
      setOrigem(userLocation);
      setOrigemText(userLocation.address);
      setUsingGpsLocation(true);
    } else {
      refreshLocation();
    }
  };

  const handleDestinoSelect = (location: Location) => {
    setDestino(location);
    setDestinoText(location.address);
  };

  const handleDestinoTextChange = (text: string) => {
    setDestinoText(text);
    setDestino(null);
  };

  const handleSolicitar = () => {
    if (!origem) return;
    if (needsDestination && !destino) return;
    
    // Progressive search will be activated in searching state
    createChamado(selectedService, origem, needsDestination ? destino : null);
  };

  const canSubmit = origem && (!needsDestination || destino);

  return (
    <div className="relative h-full">
      {/* Real Google Map with provider markers */}
      <RealMapView 
        center={searchLocation}
        origem={origem}
        destino={needsDestination ? destino : null}
        showRoute={needsDestination && !!origem && !!destino}
        providers={mapProviders}
        showUserLocation={!origem}
        animateProviders={true}
        className="absolute inset-0" 
        zoom={origem ? 14 : 13}
      />
      
      {/* Providers indicator */}
      <div className="absolute top-24 left-4 right-4 z-10">
        <div className="glass-card rounded-2xl p-3 flex items-center gap-3 animate-fade-in">
          <div className="relative">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Navigation className="w-5 h-5 text-primary" />
            </div>
            {nearbyProviders.length > 0 && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                {nearbyProviders.length}
              </div>
            )}
          </div>
          <div className="flex-1">
            {providersLoading ? (
              <>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Buscando prestadores...
                </p>
                <p className="text-xs text-muted-foreground">Raio de {NEARBY_RADIUS_KM}km</p>
              </>
            ) : nearbyProviders.length > 0 ? (
              <>
                <p className="text-sm font-medium">
                  {nearbyProviders.length} prestador{nearbyProviders.length > 1 ? 'es' : ''} próximo{nearbyProviders.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {serviceProviderCount > 0 
                    ? `${serviceProviderCount} oferece${serviceProviderCount > 1 ? 'm' : ''} ${serviceConfig.label.toLowerCase()}`
                    : `Nenhum oferece ${serviceConfig.label.toLowerCase()}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhum prestador disponível
                </p>
                <p className="text-xs text-muted-foreground">Tente novamente em alguns minutos</p>
              </>
            )}
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
                const typeProviderCount = nearbyProviders.filter(p => 
                  p.services.includes(serviceType)
                ).length;
                
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
                        {typeProviderCount > 0 
                          ? `${typeProviderCount} disponíve${typeProviderCount > 1 ? 'is' : 'l'}` 
                          : config.estimatedTime}
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
              </div>

              {/* My Location Button */}
              <button
                onClick={handleUseMyLocation}
                disabled={locationLoading}
                className={`w-full flex items-center gap-3 p-3 mb-2 rounded-xl transition-colors border disabled:opacity-50 ${
                  usingGpsLocation 
                    ? 'bg-primary/20 border-primary' 
                    : 'bg-secondary hover:bg-secondary/80 border-border'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  usingGpsLocation ? 'bg-primary' : 'bg-muted-foreground/20'
                }`}>
                  {locationLoading ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Crosshair className={`w-4 h-4 ${usingGpsLocation ? 'text-white' : 'text-muted-foreground'}`} />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium text-sm ${usingGpsLocation ? 'text-primary' : 'text-foreground'}`}>
                    Usar minha localização
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {usingGpsLocation ? 'Localização GPS ativa' : 'Detectar local exato via GPS'}
                  </p>
                </div>
                {usingGpsLocation && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </button>

              <PlacesAutocomplete
                value={origemText}
                onChange={handleOrigemTextChange}
                onSelect={handleOrigemSelect}
                placeholder={locationLoading ? "Obtendo localização..." : "Ou digite o endereço"}
                icon={
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                }
              />
              {locationError && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  {locationError}
                </p>
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
                  onChange={handleDestinoTextChange}
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
