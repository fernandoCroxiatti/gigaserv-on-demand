import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '../ui/button';
import { Navigation, Clock, DollarSign, X, Check, Route, Ban } from 'lucide-react';
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
    
    // Tocar som de notificação in-app (fallback se OneSignal não tocar)
    // Usa o AudioManager centralizado - ignora silenciosamente se áudio não desbloqueado
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

  if (!incomingRequest) return null;

  const serviceConfig = SERVICE_CONFIG[incomingRequest.tipoServico];
  const hasDestination = incomingRequest.destino !== null;
  const vehicleTypeConfig = incomingRequest.vehicleType 
    ? VEHICLE_TYPES[incomingRequest.vehicleType as VehicleType] 
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
        onClick={handleDecline}
      />

      {/* Card - compact and premium */}
      <div className="relative w-full max-w-lg bg-card rounded-t-2xl shadow-uber-lg animate-slide-up pointer-events-auto provider-theme">
        {/* Timer bar */}
        <div className="h-0.5 bg-secondary rounded-t-2xl overflow-hidden">
          <div 
            className="h-full bg-provider-primary transition-all duration-1000"
            style={{ width: `${(timeLeft / 30) * 100}%` }}
          />
        </div>

        {/* Header - compact */}
        <div className="p-3 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-provider-primary/10 rounded-full flex items-center justify-center">
              <span className="text-xl">{serviceConfig.icon}</span>
            </div>
            <div>
              <h3 className="font-semibold text-sm">Novo chamado!</h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs bg-provider-primary/10 text-provider-primary px-1.5 py-0.5 rounded-full font-medium">
                  {serviceConfig.label}
                </span>
                {vehicleTypeConfig && (
                  <span className="text-[10px] bg-secondary text-foreground px-1.5 py-0.5 rounded-full">
                    {vehicleTypeConfig.icon} {vehicleTypeConfig.label}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">• {timeLeft}s</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleDecline}
            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Route info - compact */}
        <div className="p-3">
          <div className="flex items-start gap-2.5">
            <div className="flex flex-col items-center gap-0.5 pt-0.5">
              <div className="w-2 h-2 bg-provider-primary rounded-full" />
              {hasDestination && (
                <>
                  <div className="w-px h-8 bg-border" />
                  <div className="w-2 h-2 bg-foreground rounded-full" />
                </>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {hasDestination ? 'Buscar veículo em' : 'Atender em'}
                </p>
                <p className="font-medium text-xs truncate">{incomingRequest.origem.address}</p>
              </div>
              {hasDestination && incomingRequest.destino && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Levar até</p>
                  <p className="font-medium text-xs truncate">{incomingRequest.destino.address}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats - compact */}
        <div className={`px-3 pb-3 grid gap-1.5 ${hasDestination ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <div className="bg-secondary/80 rounded-lg p-2 text-center">
            <Navigation className="w-4 h-4 mx-auto mb-0.5 text-provider-primary" />
            <p className="font-semibold text-xs">{formattedDistance}</p>
            <p className="text-[10px] text-muted-foreground">Até cliente</p>
          </div>
          {hasDestination && (
            <div className="bg-secondary/80 rounded-lg p-2 text-center">
              <Route className="w-4 h-4 mx-auto mb-0.5 text-provider-primary" />
              <p className="font-semibold text-xs">{formattedDistanceToDestination}</p>
              <p className="text-[10px] text-muted-foreground">Até entrega</p>
            </div>
          )}
          <div className="bg-secondary/80 rounded-lg p-2 text-center">
            <Clock className="w-4 h-4 mx-auto mb-0.5 text-provider-primary" />
            <p className="font-semibold text-xs">{serviceConfig.estimatedTime}</p>
            <p className="text-[10px] text-muted-foreground">Estimado</p>
          </div>
          <div className="bg-secondary/80 rounded-lg p-2 text-center">
            <DollarSign className="w-4 h-4 mx-auto mb-0.5 text-provider-primary" />
            <p className="font-semibold text-xs">A combinar</p>
            <p className="text-[10px] text-muted-foreground">Valor</p>
          </div>
        </div>

        {/* Service type info - compact */}
        {!hasDestination && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-1.5 p-2 bg-provider-primary/5 rounded-lg">
              <Check className="w-3 h-3 text-provider-primary" />
              <p className="text-xs text-muted-foreground">
                Serviço no local - sem necessidade de reboque
              </p>
            </div>
          </div>
        )}

        {/* Action buttons - wider */}
        <div className="p-3 pt-0 flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleDecline}
            className="flex-1 h-11"
          >
            <X className="w-4 h-4" />
            Recusar
          </Button>
          <Button 
            variant="provider"
            onClick={handleAccept}
            disabled={isAccepting}
            className="flex-1 h-11"
          >
            <Check className="w-4 h-4" />
            {isAccepting ? 'Verificando...' : 'Aceitar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
