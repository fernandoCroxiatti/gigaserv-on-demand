import React, { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { Button } from '../ui/button';
import { Power, Radar, Star, TrendingUp, Clock, DollarSign, MapPin, Settings2, Check } from 'lucide-react';
import { Slider } from '../ui/slider';
import { useGeolocation } from '@/hooks/useGeolocation';
import { SERVICE_CONFIG, ServiceType } from '@/types/chamado';

const ALL_SERVICES: ServiceType[] = ['guincho', 'borracharia', 'mecanica', 'chaveiro'];

export function ProviderIdleView() {
  const { user, toggleProviderOnline, setProviderRadarRange, setProviderServices, updateProviderLocation, providerData } = useApp();
  const { location, error: geoError } = useGeolocation(true);
  const [showServiceConfig, setShowServiceConfig] = useState(false);
  
  const isOnline = user?.providerData?.online || false;
  const radarRange = user?.providerData?.radarRange || 15;
  const currentServices = (providerData?.services_offered as ServiceType[]) || ['guincho'];

  const toggleService = (service: ServiceType) => {
    const newServices = currentServices.includes(service)
      ? currentServices.filter(s => s !== service)
      : [...currentServices, service];
    
    if (newServices.length > 0) {
      setProviderServices(newServices);
    }
  };

  // Update provider location when location changes
  useEffect(() => {
    if (isOnline && location) {
      updateProviderLocation({
        lat: location.lat,
        lng: location.lng,
        address: location.address,
      });
    }
  }, [isOnline, location, updateProviderLocation]);

  return (
    <div className="relative h-full provider-theme">
      {/* Map with search radius circle */}
      <RealMapView 
        className="absolute inset-0"
        center={location || undefined}
        showSearchRadius={isOnline}
        searchRadius={radarRange}
      />

      {/* GPS Error */}
      {geoError && (
        <div className="absolute top-24 left-4 right-4 z-10">
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">{geoError}</p>
          </div>
        </div>
      )}

      {/* Status card */}
      <div className={`absolute ${geoError ? 'top-40' : 'top-24'} left-4 right-4 z-10 animate-slide-down`}>
        <div className={`glass-card rounded-2xl p-4 ${isOnline ? 'border-2 border-provider-primary' : ''}`}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <img 
                src={user?.avatar} 
                alt={user?.name}
                className={`w-14 h-14 rounded-full border-2 ${isOnline ? 'border-provider-primary' : 'border-muted'}`}
              />
              {isOnline && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-provider-primary rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{user?.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="w-4 h-4 text-status-searching fill-current" />
                <span>{user?.providerData?.rating?.toFixed(1)}</span>
                <span>•</span>
                <span>{user?.providerData?.totalServices} serviços</span>
              </div>
            </div>
            <span className={`status-badge ${
              isOnline 
                ? 'bg-provider-primary/10 text-provider-primary' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      {isOnline && (
        <div className={`absolute ${geoError ? 'top-60' : 'top-44'} left-4 right-4 z-10 grid grid-cols-3 gap-2 animate-fade-in`} style={{ animationDelay: '0.2s' }}>
          <div className="glass-card rounded-xl p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-provider-primary" />
            <p className="text-lg font-bold">{user?.providerData?.totalServices || 0}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-provider-primary" />
            <p className="text-lg font-bold">--</p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <DollarSign className="w-5 h-5 mx-auto mb-1 text-provider-primary" />
            <p className="text-lg font-bold">--</p>
            <p className="text-xs text-muted-foreground">Ganhos</p>
          </div>
        </div>
      )}

      {/* Bottom control panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg p-6 space-y-6">
          {/* Online toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power className={`w-6 h-6 ${isOnline ? 'text-provider-primary' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-semibold">{isOnline ? 'Você está online' : 'Você está offline'}</p>
                <p className="text-sm text-muted-foreground">
                  {isOnline ? 'Recebendo chamados' : 'Ative para receber chamados'}
                </p>
              </div>
            </div>
            <Button
              variant={isOnline ? 'provider' : 'outline'}
              onClick={toggleProviderOnline}
              size="lg"
            >
              {isOnline ? 'Ficar offline' : 'Ficar online'}
            </Button>
          </div>

          {/* Radar range slider */}
          {isOnline && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radar className="w-5 h-5 text-provider-primary" />
                  <span className="font-medium">Raio de busca</span>
                </div>
                <span className="text-lg font-bold text-provider-primary">{radarRange} km</span>
              </div>
              <Slider
                value={[radarRange]}
                onValueChange={(value) => setProviderRadarRange(value[0])}
                max={100}
                min={5}
                step={5}
                className="provider-theme"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 km</span>
                <span>100 km</span>
              </div>
            </div>
          )}

          {/* Service selection */}
          {isOnline && (
            <div className="space-y-3 animate-fade-in">
              <button 
                onClick={() => setShowServiceConfig(!showServiceConfig)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-provider-primary" />
                  <span className="font-medium">Serviços oferecidos</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentServices.length} selecionado(s)
                </span>
              </button>
              
              {showServiceConfig && (
                <div className="grid grid-cols-2 gap-2">
                  {ALL_SERVICES.map((service) => {
                    const config = SERVICE_CONFIG[service];
                    const isSelected = currentServices.includes(service);
                    return (
                      <button
                        key={service}
                        onClick={() => toggleService(service)}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          isSelected 
                            ? 'border-provider-primary bg-provider-primary/10' 
                            : 'border-border bg-secondary hover:border-provider-primary/50'
                        }`}
                      >
                        <span className="text-xl">{config.icon}</span>
                        <span className={`text-sm font-medium ${isSelected ? 'text-provider-primary' : ''}`}>
                          {config.label}
                        </span>
                        {isSelected && <Check className="w-4 h-4 ml-auto text-provider-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tips when offline */}
          {!isOnline && (
            <div className="bg-secondary rounded-xl p-4">
              <p className="text-sm text-muted-foreground text-center">
                💡 Fique online para começar a receber chamados de clientes na sua região
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
