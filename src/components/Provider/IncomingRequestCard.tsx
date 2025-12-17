import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '../ui/button';
import { MapPin, Navigation, Clock, DollarSign, X, Check } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { calculateDistance } from '@/lib/distance';

export function IncomingRequestCard() {
  const { incomingRequest, acceptIncomingRequest, declineIncomingRequest, providerData } = useApp();
  const [timeLeft, setTimeLeft] = useState(30);

  // Calculate distance from provider to client
  const distanceToClient = useMemo(() => {
    if (!incomingRequest || !providerData?.current_lat || !providerData?.current_lng) {
      return null;
    }
    
    const distance = calculateDistance(
      Number(providerData.current_lat),
      Number(providerData.current_lng),
      incomingRequest.origem.lat,
      incomingRequest.origem.lng
    );
    
    return distance;
  }, [incomingRequest, providerData?.current_lat, providerData?.current_lng]);

  const formattedDistance = distanceToClient !== null 
    ? distanceToClient < 1 
      ? `${Math.round(distanceToClient * 1000)} m`
      : `${distanceToClient.toFixed(1)} km`
    : '--';

  useEffect(() => {
    if (!incomingRequest) return;
    
    setTimeLeft(30);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          declineIncomingRequest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingRequest, declineIncomingRequest]);

  if (!incomingRequest) return null;

  const serviceConfig = SERVICE_CONFIG[incomingRequest.tipoServico];
  const hasDestination = incomingRequest.destino !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 pointer-events-auto"
        onClick={declineIncomingRequest}
      />

      {/* Card */}
      <div className="relative w-full max-w-lg bg-card rounded-t-3xl shadow-uber-lg animate-slide-up pointer-events-auto provider-theme">
        {/* Timer bar */}
        <div className="h-1 bg-secondary rounded-t-3xl overflow-hidden">
          <div 
            className="h-full bg-provider-primary transition-all duration-1000"
            style={{ width: `${(timeLeft / 30) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-provider-primary/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">{serviceConfig.icon}</span>
            </div>
            <div>
              <h3 className="font-semibold">Novo chamado!</h3>
              <div className="flex items-center gap-2">
                <span className="status-badge bg-provider-primary/10 text-provider-primary text-xs">
                  {serviceConfig.label}
                </span>
                <span className="text-sm text-muted-foreground">• {timeLeft}s</span>
              </div>
            </div>
          </div>
          <button 
            onClick={declineIncomingRequest}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Route info */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-3 bg-provider-primary rounded-full" />
              {hasDestination && (
                <>
                  <div className="w-0.5 h-12 bg-border" />
                  <div className="w-3 h-3 bg-foreground rounded-full" />
                </>
              )}
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {hasDestination ? 'Buscar veículo em' : 'Atender em'}
                </p>
                <p className="font-medium">{incomingRequest.origem.address}</p>
              </div>
              {hasDestination && incomingRequest.destino && (
                <div>
                  <p className="text-xs text-muted-foreground">Levar até</p>
                  <p className="font-medium">{incomingRequest.destino.address}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 pb-4 grid grid-cols-3 gap-3">
          <div className="bg-secondary rounded-xl p-3 text-center">
            <Navigation className="w-5 h-5 mx-auto mb-1 text-provider-primary" />
            <p className="font-semibold">{formattedDistance}</p>
            <p className="text-xs text-muted-foreground">Até cliente</p>
          </div>
          <div className="bg-secondary rounded-xl p-3 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-provider-primary" />
            <p className="font-semibold">{serviceConfig.estimatedTime}</p>
            <p className="text-xs text-muted-foreground">Estimado</p>
          </div>
          <div className="bg-secondary rounded-xl p-3 text-center">
            <DollarSign className="w-5 h-5 mx-auto mb-1 text-provider-primary" />
            <p className="font-semibold">A combinar</p>
            <p className="text-xs text-muted-foreground">Valor</p>
          </div>
        </div>

        {/* Service type info */}
        {!hasDestination && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 p-3 bg-provider-primary/5 rounded-xl">
              <Check className="w-4 h-4 text-provider-primary" />
              <p className="text-sm text-muted-foreground">
                Serviço no local - sem necessidade de reboque
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="p-4 pt-0 flex gap-3">
          <Button 
            variant="outline" 
            onClick={declineIncomingRequest}
            className="flex-1"
            size="lg"
          >
            <X className="w-5 h-5" />
            Recusar
          </Button>
          <Button 
            variant="provider"
            onClick={acceptIncomingRequest}
            className="flex-1"
            size="lg"
          >
            <Check className="w-5 h-5" />
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
