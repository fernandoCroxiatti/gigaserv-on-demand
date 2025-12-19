import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { OptimizedNavigationMap } from '../Map/OptimizedNavigationMap';
import { useNavigationRoute } from '@/hooks/useNavigationRoute';
import { useRealtimeGPS } from '@/hooks/useRealtimeGPS';
import { useProviderTracking } from '@/hooks/useProviderTracking';
import { useOtherPartyContact } from '@/hooks/useOtherPartyContact';
import { Button } from '../ui/button';
import { ChatModal } from '../Chat/ChatModal';
import { 
  Phone, 
  MessageCircle, 
  Navigation, 
  CheckCircle, 
  Flag, 
  MapPin, 
  ArrowRight, 
  Clock, 
  Route, 
  AlertCircle, 
  Loader2,
  Car,
  AlertTriangle,
  RefreshCw,
  Wifi
} from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type NavigationPhase = 'going_to_vehicle' | 'going_to_destination';
type ViewMode = 'provider' | 'client';

interface NavigationFullScreenProps {
  mode: ViewMode;
}

export function NavigationFullScreen({ mode }: NavigationFullScreenProps) {
  const { chamado, finishService, profile, availableProviders, cancelChamado, chatMessages } = useApp();
  const [navigationPhase, setNavigationPhase] = useState<NavigationPhase>('going_to_vehicle');
  const [routePolyline, setRoutePolyline] = useState<string>('');
  const [eta, setEta] = useState<string>('Calculando...');
  const [distance, setDistance] = useState<string>('Calculando...');
  const [isConfirming, setIsConfirming] = useState(false);
  const [showArrivalDialog, setShowArrivalDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [lastReadMessageCount, setLastReadMessageCount] = useState(0);
  const routeCalculatedRef = useRef<string>('');

  // Get other party contact info
  const { phone: otherPartyPhone, name: otherPartyName, loading: contactLoading } = useOtherPartyContact(
    mode,
    chamado?.id,
    chamado?.clienteId,
    chamado?.prestadorId
  );

  const { 
    routeData, 
    isCalculating: isCalculatingRoute, 
    calculateRoute,
    forceRecalculateRoute,
    clearRoute 
  } = useNavigationRoute();

  // Provider mode: use realtime GPS
  const { 
    location: providerGPSLocation, 
    error: gpsError, 
    loading: gpsLoading,
    heading: providerHeading,
    isApproximate: isApproximateLocation,
  } = useRealtimeGPS({
    enableHighAccuracy: true,
    timeout: 15000, // Match the 15s timeout
    maximumAge: 0,
    onLocationUpdate: async (location) => {
      // Only update DB if provider mode
      if (mode === 'provider' && profile?.user_id) {
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

  // Client mode: track provider location via DB
  const { location: trackedProviderLocation } = useProviderTracking(
    mode === 'client' ? chamado?.prestadorId : undefined
  );

  // Determine which location to use
  const providerLocation = mode === 'provider' ? providerGPSLocation : trackedProviderLocation;

  // Get provider info for client view
  const provider = mode === 'client' 
    ? availableProviders.find(p => p.id === chamado?.prestadorId) 
    : null;

  if (!chamado) return null;

  const serviceConfig = SERVICE_CONFIG[chamado.tipoServico];
  const hasDestination = chamado.destino !== null;
  const isGoingToVehicle = navigationPhase === 'going_to_vehicle';

  // Current destination based on phase
  const currentDestination = isGoingToVehicle ? chamado.origem : chamado.destino;

  // Load navigation state from database on mount
  useEffect(() => {
    const loadNavigationState = async () => {
      const { data, error } = await supabase
        .from('chamados')
        .select('navigation_phase, route_polyline, route_distance_meters, route_duration_seconds')
        .eq('id', chamado.id)
        .single();

      if (error) {
        console.error('[Navigation] Error loading state:', error);
        return;
      }

      if (data) {
        if (data.navigation_phase) {
          setNavigationPhase(data.navigation_phase as NavigationPhase);
        }
        if (data.route_polyline) {
          setRoutePolyline(data.route_polyline);
          routeCalculatedRef.current = `${chamado.id}-${data.navigation_phase}`;
        }
        if (data.route_distance_meters) {
          setDistance(formatDistance(data.route_distance_meters));
        }
        if (data.route_duration_seconds) {
          setEta(formatDuration(data.route_duration_seconds));
        }
      }
    };

    loadNavigationState();
  }, [chamado.id]);

  // Subscribe to navigation updates (for syncing between client and provider)
  useEffect(() => {
    const channel = supabase
      .channel(`navigation-${chamado.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chamados',
          filter: `id=eq.${chamado.id}`,
        },
        (payload: any) => {
          const { navigation_phase, route_polyline, route_distance_meters, route_duration_seconds } = payload.new;
          
          if (navigation_phase && navigation_phase !== navigationPhase) {
            setNavigationPhase(navigation_phase);
            if (mode === 'client') {
              toast.info(navigation_phase === 'going_to_destination' 
                ? 'Prestador chegou ao veículo!' 
                : 'Navegação iniciada');
            }
          }
          
          if (route_polyline && route_polyline !== routePolyline) {
            setRoutePolyline(route_polyline);
          }
          
          if (route_distance_meters) {
            setDistance(formatDistance(route_distance_meters));
          }
          
          if (route_duration_seconds) {
            setEta(formatDuration(route_duration_seconds));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chamado.id, navigationPhase, routePolyline, mode]);

  // Calculate route ONCE when phase changes (provider only)
  // AUDIT FIX: Added multiple guards to prevent duplicate API calls
  useEffect(() => {
    // Guard 1: Only provider calculates routes
    if (mode !== 'provider') return;
    
    // Guard 2: Need valid locations
    if (!providerLocation || !currentDestination) return;
    
    // Guard 3: Check if already calculated for this phase
    const routeKey = `${chamado.id}-${navigationPhase}`;
    if (routeCalculatedRef.current === routeKey) {
      console.log('[Navigation] Skipping route calculation - already done for:', navigationPhase);
      return;
    }
    
    // Guard 4: Skip if we already have a polyline for this phase (loaded from DB)
    if (routePolyline && routeCalculatedRef.current.includes(chamado.id)) {
      console.log('[Navigation] Skipping route calculation - polyline already loaded');
      routeCalculatedRef.current = routeKey;
      return;
    }

    const doCalculateRoute = async () => {
      console.log('[Navigation] Initiating route calculation for phase:', navigationPhase);
      const result = await calculateRoute(
        providerLocation,
        currentDestination,
        chamado.id,
        navigationPhase
      );

      if (result) {
        setRoutePolyline(result.polyline);
        setDistance(result.distanceText);
        setEta(result.durationText);
        routeCalculatedRef.current = routeKey;
      }
    };

    doCalculateRoute();
  // AUDIT FIX: Minimal dependencies - only trigger when phase changes, not on GPS updates
  }, [mode, navigationPhase, chamado.id, !!providerLocation, !!currentDestination]);

  // Update route data when routeData changes
  useEffect(() => {
    if (routeData) {
      setDistance(routeData.distanceText);
      setEta(routeData.durationText);
      setRoutePolyline(routeData.polyline);
    }
  }, [routeData]);

  // Track unread messages - when chat is closed and new messages arrive
  useEffect(() => {
    if (showChat) {
      // When chat opens, mark all as read
      setHasUnreadMessages(false);
      setLastReadMessageCount(chatMessages.length);
    } else if (chatMessages.length > lastReadMessageCount) {
      // New messages arrived while chat is closed
      setHasUnreadMessages(true);
    }
  }, [chatMessages.length, showChat, lastReadMessageCount]);

  // Handle call button click
  const handleCall = useCallback(() => {
    if (!otherPartyPhone) {
      toast.error('Telefone não disponível', {
        description: 'O número de telefone não foi cadastrado.'
      });
      return;
    }
    
    // Clean the phone number (remove non-digits except +)
    const cleanPhone = otherPartyPhone.replace(/[^\d+]/g, '');
    
    // Open native dialer
    window.location.href = `tel:${cleanPhone}`;
  }, [otherPartyPhone]);

  // Handle message button click
  const handleOpenChat = useCallback(() => {
    setShowChat(true);
    setHasUnreadMessages(false);
    setLastReadMessageCount(chatMessages.length);
  }, [chatMessages.length]);

  const handleConfirmArrival = async () => {
    setShowArrivalDialog(false);
    setIsConfirming(true);

    try {
      // Update database with arrival status
      await supabase
        .from('chamados')
        .update({
          provider_arrived_at_vehicle: true,
          navigation_phase: 'going_to_destination',
        })
        .eq('id', chamado.id);

      // Clear current route for recalculation
      clearRoute();
      routeCalculatedRef.current = '';
      
      setNavigationPhase('going_to_destination');
      setEta('Calculando...');
      setDistance('Calculando...');
      
      toast.success('Chegada confirmada!', {
        description: 'Agora leve o veículo ao destino.',
      });
    } catch (error) {
      console.error('[Navigation] Error confirming arrival:', error);
      toast.error('Erro ao confirmar chegada');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleFinishService = async () => {
    setShowFinishDialog(false);
    setIsConfirming(true);

    try {
      // Mark destination arrival
      await supabase
        .from('chamados')
        .update({
          provider_arrived_at_destination: true,
        })
        .eq('id', chamado.id);

      // Finish the service (triggers payment flow)
      await finishService();
    } catch (error) {
      console.error('[Navigation] Error finishing service:', error);
      toast.error('Erro ao finalizar serviço');
    } finally {
      setIsConfirming(false);
    }
  };

  /**
   * Manual route recalculation (only when provider clicks the button)
   * Performs exactly 1 API call to Directions
   */
  const handleManualRecalculate = useCallback(async () => {
    if (!providerLocation || !currentDestination) {
      toast.error('Localização não disponível');
      return;
    }
    
    toast.info('Recalculando rota...', { duration: 2000 });
    
    const result = await forceRecalculateRoute(
      providerLocation,
      currentDestination,
      chamado.id,
      navigationPhase
    );
    
    if (result) {
      setRoutePolyline(result.polyline);
      setDistance(result.distanceText);
      setEta(result.durationText);
      routeCalculatedRef.current = `${chamado.id}-${navigationPhase}`;
      toast.success('Rota atualizada!');
    } else {
      toast.error('Erro ao recalcular rota');
    }
  }, [providerLocation, currentDestination, chamado.id, navigationPhase, forceRecalculateRoute]);

  // Format helpers
  function formatDistance(meters: number): string {
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  function formatDuration(seconds: number): string {
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  }

  // Provider GPS Error state
  if (mode === 'provider' && gpsError) {
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
  if ((mode === 'provider' && (gpsLoading || !providerLocation)) || !currentDestination) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="font-medium">Iniciando navegação...</p>
          <p className="text-sm text-muted-foreground">Aguarde a localização GPS</p>
        </div>
      </div>
    );
  }

  const themeClass = mode === 'provider' ? 'provider-theme' : '';
  const primaryColor = mode === 'provider' ? 'provider-primary' : 'status-inService';

  return (
    <div className={`relative h-full ${themeClass}`}>
      {/* Full screen navigation map */}
      <OptimizedNavigationMap 
        providerLocation={providerLocation}
        destination={currentDestination}
        routePolyline={routePolyline}
        followProvider={mode === 'provider'}
        providerHeading={providerHeading || 0}
        className="absolute inset-0" 
      />

      {/* Navigation header - floating */}
      <div className="absolute top-24 left-4 right-4 z-10 animate-slide-down">
        <div className="glass-card rounded-2xl p-4 bg-white/95 backdrop-blur-sm shadow-lg">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 bg-${primaryColor}/10 rounded-full flex items-center justify-center`}>
              <Navigation className={`w-6 h-6 text-${primaryColor} animate-pulse`} />
            </div>
            <div className="flex-1">
              <p className={`font-bold text-${primaryColor} text-lg`}>
                {isGoingToVehicle 
                  ? (mode === 'provider' ? 'Indo até o veículo' : 'Prestador a caminho')
                  : (mode === 'provider' ? 'Levando ao destino' : 'Indo ao destino')
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {serviceConfig.label} • R$ {chamado.valor?.toFixed(2)}
              </p>
            </div>
            
            {/* Route calculating indicator */}
            {isCalculatingRoute && (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            )}
            
            {/* Manual recalculate button (provider only) */}
            {mode === 'provider' && !isCalculatingRoute && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleManualRecalculate}
                className="h-10 w-10"
                title="Recalcular rota"
              >
                <RefreshCw className="w-5 h-5 text-muted-foreground" />
              </Button>
            )}
          </div>

          {/* Approximate location warning (provider only) */}
          {mode === 'provider' && isApproximateLocation && (
            <div className="mt-2 flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg">
              <Wifi className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-amber-700">Localização aproximada - aguardando GPS</span>
            </div>
          )}

          {/* ETA and Distance */}
          <div className="mt-3 flex items-center gap-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2 flex-1">
              <Clock className={`w-5 h-5 text-${primaryColor}`} />
              <div>
                <p className="text-xs text-muted-foreground">
                  {mode === 'provider' ? 'Tempo estimado' : 'Chegada em'}
                </p>
                <p className="font-bold text-lg">{eta}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Route className={`w-5 h-5 text-${primaryColor}`} />
              <div>
                <p className="text-xs text-muted-foreground">Distância</p>
                <p className="font-bold text-lg">{distance}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step indicator - floating (only for services with destination) */}
      {hasDestination && (
        <div className="absolute top-56 left-1/2 -translate-x-1/2 z-10 animate-fade-in">
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isGoingToVehicle 
                ? `bg-${primaryColor} text-white` 
                : 'bg-green-500 text-white'
            }`}>
              {isGoingToVehicle ? '1' : <CheckCircle className="w-4 h-4" />}
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              !isGoingToVehicle 
                ? `bg-${primaryColor} text-white` 
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
              {mode === 'client' && provider && (
                <img 
                  src={provider.avatar} 
                  alt={provider.name}
                  className="w-14 h-14 rounded-full border-2 border-status-inService"
                />
              )}
              {mode === 'provider' && (
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  isGoingToVehicle ? 'bg-provider-primary/10' : 'bg-green-500/10'
                }`}>
                  {isGoingToVehicle ? (
                    <MapPin className="w-7 h-7 text-provider-primary" />
                  ) : (
                    <Flag className="w-7 h-7 text-green-500" />
                  )}
                </div>
              )}
              <div className="flex-1">
                <p className="font-bold text-lg">
                  {mode === 'client' && provider 
                    ? provider.name 
                    : (isGoingToVehicle ? 'Chegue até o veículo' : 'Leve ao destino final')
                  }
                </p>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {currentDestination?.address}
                </p>
                {mode === 'client' && provider?.vehiclePlate && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Car className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium bg-secondary px-2 py-0.5 rounded">
                      {provider.vehiclePlate}
                    </span>
                  </div>
                )}
              </div>
              {mode === 'provider' && (
                <div className="text-right">
                  <p className="text-xl font-bold text-provider-primary">
                    R$ {chamado.valor?.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Progress indicator (provider only, services with destination) */}
          {mode === 'provider' && hasDestination && (
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

          {/* Live GPS indicator (client mode) */}
          {mode === 'client' && providerLocation && (
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-xl">
                <div className="relative">
                  <MapPin className="w-5 h-5 text-green-600" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700">GPS ativo em tempo real</p>
                  <p className="text-xs text-green-600 truncate">{providerLocation.address}</p>
                </div>
              </div>
            </div>
          )}

          {/* Contact buttons */}
          <div className="p-4 flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1" 
              size="lg"
              onClick={handleCall}
              disabled={contactLoading}
            >
              <Phone className="w-5 h-5" />
              Ligar
            </Button>
            <Button 
              variant="outline" 
              className={cn(
                "flex-1 relative",
                hasUnreadMessages && "border-primary ring-2 ring-primary/20"
              )}
              size="lg"
              onClick={handleOpenChat}
            >
              <MessageCircle className={cn(
                "w-5 h-5",
                hasUnreadMessages && "text-primary"
              )} />
              Mensagem
              {hasUnreadMessages && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
              )}
            </Button>
          </div>

          {/* Main action buttons (provider only) */}
          {mode === 'provider' && (
            <div className="p-4 pt-0">
              {isGoingToVehicle && hasDestination ? (
                <Button 
                  variant="provider"
                  onClick={() => setShowArrivalDialog(true)}
                  className="w-full"
                  size="lg"
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  Cheguei ao veículo
                </Button>
              ) : (
                <Button 
                  variant="provider"
                  onClick={() => setShowFinishDialog(true)}
                  className="w-full"
                  size="lg"
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Flag className="w-5 h-5" />
                  )}
                  Finalizar corrida
                </Button>
              )}
            </div>
          )}

          {/* Cancel button (client only) */}
          {mode === 'client' && (
            <div className="p-4 pt-0">
              <button 
                onClick={cancelChamado}
                className="w-full text-center text-sm text-destructive py-2"
              >
                Cancelar serviço
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Arrival confirmation dialog */}
      <AlertDialog open={showArrivalDialog} onOpenChange={setShowArrivalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-provider-primary" />
              Confirmar chegada ao veículo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está confirmando que chegou ao local do veículo do cliente.
              Após confirmar, você iniciará a navegação para o destino final.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmArrival}
              className="bg-provider-primary hover:bg-provider-primary/90"
            >
              Confirmar chegada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finish service dialog */}
      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-green-500" />
              Finalizar corrida
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está confirmando que o serviço foi concluído com sucesso.
              O pagamento será processado e o valor creditado na sua conta Stripe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleFinishService}
              className="bg-green-600 hover:bg-green-700"
            >
              Finalizar corrida
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Chat Modal */}
      <ChatModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        otherPartyName={otherPartyName || (mode === 'provider' ? 'Cliente' : 'Prestador')}
        mode={mode}
      />
    </div>
  );
}
