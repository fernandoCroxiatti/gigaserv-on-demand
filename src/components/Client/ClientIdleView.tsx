import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { MapPin, Navigation, ChevronRight, Clock, Check } from 'lucide-react';
import { Location, ServiceType, SERVICE_CONFIG, serviceRequiresDestination } from '@/types/chamado';

const recentPlaces = [
  { id: 1, name: 'Casa', address: 'Rua das Flores, 123', icon: '🏠' },
  { id: 2, name: 'Trabalho', address: 'Av. Paulista, 1578', icon: '💼' },
  { id: 3, name: 'Oficina Parceira', address: 'Rua Augusta, 500', icon: '🔧' },
];

export function ClientIdleView() {
  const { createChamado, availableProviders } = useApp();
  const [selectedService, setSelectedService] = useState<ServiceType>('guincho');
  const [origem, setOrigem] = useState<string>('Minha localização atual');
  const [destino, setDestino] = useState<string>('');
  const [showDestinationInput, setShowDestinationInput] = useState(false);

  const serviceConfig = SERVICE_CONFIG[selectedService];
  const needsDestination = serviceRequiresDestination(selectedService);

  const handleSolicitar = () => {
    if (!origem) return;
    if (needsDestination && !destino) return;
    
    const origemLocation: Location = {
      lat: -23.5505,
      lng: -46.6333,
      address: origem,
    };
    
    const destinoLocation: Location | null = needsDestination && destino ? {
      lat: -23.5615,
      lng: -46.6543,
      address: destino,
    } : null;
    
    createChamado(selectedService, origemLocation, destinoLocation);
  };

  const onlineProviders = availableProviders.filter(p => p.online).length;
  const canSubmit = origem && (!needsDestination || destino);

  return (
    <div className="relative h-full">
      {/* Map */}
      <MapView showProviders className="absolute inset-0" />
      
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
                        setDestino('');
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
            {/* Origin - always shown */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                🚗 Onde está o veículo?
              </p>
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <input
                  type="text"
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  placeholder="Endereço do veículo"
                  className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
                />
                <MapPin className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* Destination - only for guincho */}
            {needsDestination && (
              <div className="animate-fade-in">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  📍 Para onde deseja levar?
                </p>
                <div 
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    showDestinationInput 
                      ? 'border-primary bg-primary/5' 
                      : 'border-transparent bg-secondary'
                  }`}
                  onClick={() => setShowDestinationInput(true)}
                >
                  <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                  <input
                    type="text"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    placeholder="Oficina, casa ou outro destino"
                    className="flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder:text-muted-foreground"
                    autoFocus={showDestinationInput}
                  />
                  <Navigation className="w-4 h-4 text-muted-foreground" />
                </div>
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

          {/* Recent places - only for guincho destination */}
          {needsDestination && !destino && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Destinos recentes</span>
              </div>
              <div className="space-y-1">
                {recentPlaces.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => setDestino(place.address)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left"
                  >
                    <span className="text-xl">{place.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{place.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

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
