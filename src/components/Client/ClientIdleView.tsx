import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView, MapProvider } from '../Map/RealMapView';
import { PlacesAutocomplete } from '../Map/PlacesAutocomplete';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useProgressiveSearch } from '@/hooks/useProgressiveSearch';
import { SearchingIndicator } from './SearchingIndicator';
import { Button } from '../ui/button';
import { MapPin, Navigation, ChevronRight, Clock, Check, Loader2, RefreshCw, Crosshair } from 'lucide-react';
import { Location, ServiceType, SERVICE_CONFIG, serviceRequiresDestination } from '@/types/chamado';

export function ClientIdleView() {
  const { createChamado, availableProviders } = useApp();
  const { location: userLocation, loading: locationLoading, error: locationError, refresh: refreshLocation } = useGeolocation();
  
  const [selectedService, setSelectedService] = useState<ServiceType>('guincho');
  const [origem, setOrigem] = useState<Location | null>(null);
  const [origemText, setOrigemText] = useState<string>('');
  const [usingGpsLocation, setUsingGpsLocation] = useState(false);
  const [destino, setDestino] = useState<Location | null>(null);
  const [destinoText, setDestinoText] = useState<string>('');
  const [showProvidersSearch, setShowProvidersSearch] = useState(true);

  const serviceConfig = SERVICE_CONFIG[selectedService];
  const needsDestination = serviceRequiresDestination(selectedService);

  // Progressive search for nearby providers
  const searchLocation = useMemo(() => origem || userLocation, [origem, userLocation]);
  
  const {
    searchState,
    currentRadius,
    nearbyProviders,
    radiusIndex,
    totalRadii,
    startSearch,
    resetSearch,
  } = useProgressiveSearch({
    userLocation: searchLocation,
    serviceType: selectedService,
    enabled: showProvidersSearch && !!searchLocation,
  });

  // Reset search when service type changes
  useEffect(() => {
    if (searchLocation) {
      resetSearch();
      // Search will auto-restart due to enabled dependency
    }
  }, [selectedService]);

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

  const handleOrigemSelect = (location: Location) => {
    setOrigem(location);
    setOrigemText(location.address);
    setUsingGpsLocation(false);
    resetSearch(); // Reset search to start with new location
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
      resetSearch(); // Reset search to start with GPS location
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
        showSearchRadius={searchState === 'searching' || searchState === 'expanding_radius'}
        searchRadius={currentRadius}
        animateProviders={true}
        className="absolute inset-0" 
      />
      
      {/* Search status indicator */}
      <div className="absolute top-24 left-4 right-4 z-10">
        <SearchingIndicator
          state={searchState}
          currentRadius={currentRadius}
          providersCount={nearbyProviders.length}
          radiusIndex={radiusIndex}
          totalRadii={totalRadii}
        />
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
                // Count providers that offer this service
                const serviceProviderCount = nearbyProviders.filter(p => 
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
                        {serviceProviderCount > 0 
                          ? `${serviceProviderCount} disponíve${serviceProviderCount > 1 ? 'is' : 'l'}` 
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
