import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '../ui/button';
import { Navigation, Clock, DollarSign, X, Check, Route, MapPin, Truck } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { calculateDistance } from '@/lib/distance';
import { VEHICLE_TYPES, VehicleType } from '@/types/vehicleTypes';
import { useAntiFraud } from '@/hooks/useAntiFraud';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cancelChamadaNotification } from '@/lib/oneSignalNotify';
import { playNotificationSound } from '@/lib/audioManager';

export function IncomingRequestCard() {
  const { incomingRequest, acceptIncomingRequest, declineIncomingRequest, providerData } = useApp();
  const { user } = useAuth();
  const [timeLeft, setTimeLeft] = useState(30);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { checkProviderCanAccept } = useAntiFraud();
  const navigate = useNavigate();

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

  // Calculate total distance from origin to destination (for transport services)
  const distanceToDestination = useMemo(() => {
    if (!incomingRequest || !incomingRequest.destino) {
      return null;
    }
    
    const distance = calculateDistance(
      incomingRequest.origem.lat,
      incomingRequest.origem.lng,
      incomingRequest.destino.lat,
      incomingRequest.destino.lng
    );
    
    return distance;
  }, [incomingRequest]);

  const formattedDistance = distanceToClient !== null 
    ? distanceToClient < 1 
      ? `${Math.round(distanceToClient * 1000)} m`
      : `${distanceToClient.toFixed(1)} km`
    : '--';

  const formattedDistanceToDestination = distanceToDestination !== null 
    ? distanceToDestination < 1 
      ? `${Math.round(distanceToDestination * 1000)} m`
      : `${distanceToDestination.toFixed(1)} km`
    : '--';

  // Timer for request expiration - play in-app sound as fallback
  useEffect(() => {
    if (!incomingRequest) {
      return;
    }
    
    // Reset collapsed state when new request arrives
    setIsCollapsed(false);
    
    // Tocar som de notificação in-app (fallback se OneSignal não tocar)
    playNotificationSound();
    
    setTimeLeft(30);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Cancel notification when expired
          if (user?.id) {
            cancelChamadaNotification([user.id], incomingRequest.id);
          }
          declineIncomingRequest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [incomingRequest, declineIncomingRequest, user?.id]);

  // Handle accept with anti-fraud check
  const handleAccept = async () => {
    if (isAccepting || !user?.id || !incomingRequest) return;
    setIsAccepting(true);
    
    try {
      // Check if provider can accept using the anti-fraud system
      const { canAccept, blockReason } = await checkProviderCanAccept(user.id);
      
      if (!canAccept) {
        // Cancel OneSignal notification
        cancelChamadaNotification([user.id], incomingRequest.id);
        
        // Determine appropriate message based on block reason
        let message = 'Você não pode aceitar chamados no momento.';
        let actionLabel = 'Ver detalhes';
        let actionPath = '/profile';
        
        if (blockReason === 'financial_blocked' || blockReason === 'over_debt_limit') {
          message = 'Você possui pendências financeiras que precisam ser regularizadas.';
          actionLabel = 'Ver taxas';
          actionPath = '/profile?tab=fees';
        } else if (blockReason === 'fraud_flagged') {
          message = 'Sua conta foi bloqueada. Entre em contato com o suporte.';
          actionLabel = 'Suporte';
          actionPath = '/support';
        } else if (blockReason === 'permanently_blocked') {
          message = 'Sua conta foi bloqueada permanentemente.';
          actionLabel = 'Suporte';
          actionPath = '/support';
        } else if (blockReason === 'admin_blocked') {
          message = 'Sua conta foi bloqueada pelo administrador.';
          actionLabel = 'Suporte';
          actionPath = '/support';
        }
        
        toast.error(message, {
          action: {
            label: actionLabel,
            onClick: () => navigate(actionPath),
          },
          duration: 5000,
        });
        declineIncomingRequest();
        return;
      }
      
      // Cancel OneSignal notification before accepting
      cancelChamadaNotification([user.id], incomingRequest.id);
      await acceptIncomingRequest();
    } finally {
      setIsAccepting(false);
    }
  };
  
  // Handle decline
  const handleDecline = () => {
    if (user?.id && incomingRequest) {
      cancelChamadaNotification([user.id], incomingRequest.id);
    }
    declineIncomingRequest();
  };

  // Handle drag to collapse
  const handleDragDown = () => {
    setIsCollapsed(true);
  };

  if (!incomingRequest) return null;

  const serviceConfig = SERVICE_CONFIG[incomingRequest.tipoServico];
  const hasDestination = incomingRequest.destino !== null;
  const vehicleTypeConfig = incomingRequest.vehicleType 
    ? VEHICLE_TYPES[incomingRequest.vehicleType as VehicleType] 
    : null;

  // Collapsed compact view
  if (isCollapsed) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
        <div 
          className="bg-card rounded-2xl shadow-uber-lg pointer-events-auto provider-theme cursor-pointer"
          onClick={() => setIsCollapsed(false)}
        >
          {/* Timer bar */}
          <div className="h-1 bg-secondary rounded-t-2xl overflow-hidden">
            <div 
              className="h-full bg-provider-primary transition-all duration-1000"
              style={{ width: `${(timeLeft / 30) * 100}%` }}
            />
          </div>
          
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 bg-provider-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">{serviceConfig.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-base">NOVO CHAMADO</p>
                <p className="text-sm text-muted-foreground truncate">
                  {serviceConfig.label} • {timeLeft}s
                </p>
              </div>
            </div>
            <Button 
              variant="provider"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAccept();
              }}
              disabled={isAccepting}
              className="flex-shrink-0"
            >
              Aceitar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded full view (default)
  return (
    <div className="fixed inset-0 z-50 flex flex-col pointer-events-none">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        onClick={handleDecline}
      />

      {/* Spacer to push card down (map visible area ~15-20%) */}
      <div className="flex-shrink-0 h-[15%]" />

      {/* Card - 80-85% height, expanded by default */}
      <div 
        className="relative flex-1 bg-card rounded-t-3xl shadow-uber-lg pointer-events-auto provider-theme flex flex-col overflow-hidden"
        style={{ minHeight: '80%' }}
      >
        {/* Drag handle */}
        <div 
          className="py-3 flex justify-center cursor-grab active:cursor-grabbing"
          onClick={handleDragDown}
        >
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Timer bar */}
        <div className="h-1.5 bg-secondary mx-4 rounded-full overflow-hidden">
          <div 
            className="h-full bg-provider-primary transition-all duration-1000 rounded-full"
            style={{ width: `${(timeLeft / 30) * 100}%` }}
          />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Header - Maximum priority */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-provider-primary/10 rounded-2xl flex items-center justify-center">
                <span className="text-4xl">{serviceConfig.icon}</span>
              </div>
              <div>
                <h2 className="font-black text-2xl tracking-tight text-foreground">
                  NOVO CHAMADO
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm bg-provider-primary/15 text-provider-primary px-3 py-1 rounded-full font-semibold">
                    {serviceConfig.label}
                  </span>
                  {vehicleTypeConfig && (
                    <span className="text-sm bg-secondary text-foreground px-3 py-1 rounded-full font-medium">
                      {vehicleTypeConfig.icon} {vehicleTypeConfig.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-muted-foreground">{timeLeft}s</span>
            </div>
          </div>

          {/* Value block - Most prominent element */}
          <div className="mb-6 p-5 bg-provider-primary/10 border-2 border-provider-primary/30 rounded-2xl text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <DollarSign className="w-6 h-6 text-provider-primary" />
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Valor</span>
            </div>
            <p className="text-4xl font-black text-foreground">A combinar</p>
          </div>

          {/* Metrics - Single line */}
          <div className="mb-6 flex items-center justify-between gap-2 p-4 bg-secondary/50 rounded-xl">
            <div className="flex items-center gap-2 flex-1">
              <MapPin className="w-5 h-5 text-provider-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold">{formattedDistance}</p>
                <p className="text-xs text-muted-foreground">Até cliente</p>
              </div>
            </div>
            
            {hasDestination && (
              <>
                <div className="w-px h-10 bg-border" />
                <div className="flex items-center gap-2 flex-1">
                  <Truck className="w-5 h-5 text-provider-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-lg font-bold">{formattedDistanceToDestination}</p>
                    <p className="text-xs text-muted-foreground">Até entrega</p>
                  </div>
                </div>
              </>
            )}
            
            <div className="w-px h-10 bg-border" />
            <div className="flex items-center gap-2 flex-1">
              <Clock className="w-5 h-5 text-provider-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold">{serviceConfig.estimatedTime}</p>
                <p className="text-xs text-muted-foreground">Estimado</p>
              </div>
            </div>
          </div>

          {/* Addresses - Simplified */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-provider-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-3 h-3 bg-white rounded-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                  {hasDestination ? 'Buscar em' : 'Atender em'}
                </p>
                <p className="font-semibold text-base leading-tight line-clamp-2">
                  {incomingRequest.origem.address}
                </p>
              </div>
            </div>

            {hasDestination && incomingRequest.destino && (
              <>
                <div className="flex items-center gap-3 pl-4">
                  <div className="w-0.5 h-6 bg-border" />
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-3 h-3 bg-white rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                      Levar até
                    </p>
                    <p className="font-semibold text-base leading-tight line-clamp-2">
                      {incomingRequest.destino.address}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Service type info for non-transport */}
          {!hasDestination && (
            <div className="mt-6 flex items-center gap-2 p-3 bg-provider-primary/5 rounded-xl">
              <Check className="w-4 h-4 text-provider-primary flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Serviço no local - sem necessidade de reboque
              </p>
            </div>
          )}
        </div>

        {/* Fixed action buttons at footer */}
        <div className="flex-shrink-0 p-5 pt-3 bg-card border-t border-border/50 flex gap-3 safe-area-bottom">
          <Button 
            variant="outline" 
            onClick={handleDecline}
            className="flex-1 h-14 text-base font-semibold"
          >
            <X className="w-5 h-5 mr-2" />
            Recusar
          </Button>
          <Button 
            variant="provider"
            onClick={handleAccept}
            disabled={isAccepting}
            className="flex-[1.5] h-14 text-base font-semibold"
          >
            <Check className="w-5 h-5 mr-2" />
            {isAccepting ? 'Verificando...' : 'Aceitar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
