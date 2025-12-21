import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { OptimizedNavigationMap } from '../Map/OptimizedNavigationMap';
import { TurnByTurnDisplay } from './TurnByTurnDisplay';
import { ClientStatusDisplay } from './ClientStatusDisplay';
import { useNavigationRoute } from '@/hooks/useNavigationRoute';
import { useNavigationInstructions } from '@/hooks/useNavigationInstructions';
import { useRealtimeGPS } from '@/hooks/useRealtimeGPS';
import { useProviderTracking } from '@/hooks/useProviderTracking';
import { useOtherPartyContact } from '@/hooks/useOtherPartyContact';
import { useRouteDeviation } from '@/hooks/useRouteDeviation';
import { Button } from '../ui/button';
import { ChatModal } from '../Chat/ChatModal';
import { DirectPaymentBanner } from '../Provider/DirectPaymentBanner';
import { DirectPaymentConfirmationDialog } from '../Provider/DirectPaymentConfirmationDialog';
import { 
  Phone, 
  MessageCircle, 
  Navigation, 
  CheckCircle, 
  Flag, 
  MapPin, 
  AlertCircle, 
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { calculateFee, createFeeAuditLog, canFinalizeWithFee } from '@/lib/feeCalculator';
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

/**
 * Navigation phases following Uber/99 style:
 * - to_client: Provider is going to the client's location (vehicle)
 * - at_client: Provider arrived at client location, ready to start service
 * - to_destination: Provider is going to the final destination (guincho only)
 * - finished: Service completed
 */
type NavigationPhase = 'to_client' | 'at_client' | 'to_destination' | 'finished';
type ViewMode = 'provider' | 'client';

interface NavigationFullScreenProps {
  mode: ViewMode;
}

// GPS update interval in milliseconds (5 seconds for smooth updates with low API usage)
const GPS_UPDATE_INTERVAL = 5000;

// Map old phase names to new for backwards compatibility
function normalizePhase(phase: string | null): NavigationPhase {
  if (!phase) return 'to_client';
  if (phase === 'going_to_vehicle') return 'to_client';
  if (phase === 'going_to_destination') return 'to_destination';
  return phase as NavigationPhase;
}

export function NavigationFullScreen({ mode }: NavigationFullScreenProps) {
  const { chamado, finishService, profile, availableProviders, cancelChamado, chatMessages } = useApp();
  const [navigationPhase, setNavigationPhase] = useState<NavigationPhase>('to_client');
  const [routePolyline, setRoutePolyline] = useState<string>('');
  const [eta, setEta] = useState<string>('');
  const [distance, setDistance] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [showArrivalDialog, setShowArrivalDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [showDirectPaymentDialog, setShowDirectPaymentDialog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [lastReadMessageCount, setLastReadMessageCount] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const routeCalculatedRef = useRef<string>('');
  const lastGpsUpdateRef = useRef<number>(0);

  // Check if this is a direct payment to provider (from database field)
  const isDirectPaymentToProvider = (chamado as any)?.direct_payment_to_provider === true;

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

  // Route deviation detection for auto-recalculation
  const { checkDeviation, clearRouteCache } = useRouteDeviation({
    maxDeviationMeters: 50,
    minTimeOffRoute: 3000,
    onRecalculateNeeded: useCallback(() => {
      if (mode === 'provider' && providerGPSLocation && currentDestination) {
        toast.info('Recalculando rota...');
        forceRecalculateRoute(providerGPSLocation, currentDestination, chamado?.id || '', navigationPhase);
      }
    }, [mode, forceRecalculateRoute, navigationPhase]),
  });

  // Provider mode: use realtime GPS with throttled updates
  const { 
    location: providerGPSLocation, 
    error: gpsError, 
    loading: gpsLoading,
    heading: providerHeading,
  } = useRealtimeGPS({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: GPS_UPDATE_INTERVAL,
    enableSmoothing: true,
    onLocationUpdate: async (location) => {
      // Throttle database updates to reduce load
      const now = Date.now();
      if (now - lastGpsUpdateRef.current < GPS_UPDATE_INTERVAL) return;
      lastGpsUpdateRef.current = now;

      // Check route deviation
      if (routePolyline) {
        checkDeviation(location, routePolyline);
      }

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
  const isGoingToClient = navigationPhase === 'to_client';

  // Current destination based on phase
  const currentDestination = isGoingToClient ? chamado.origem : chamado.destino;

  // Use navigation instructions hook for turn-by-turn and status
  const navigationState = useNavigationInstructions({
    providerLocation,
    destination: currentDestination,
    phase: navigationPhase,
    isProvider: mode === 'provider',
  });

  // Load navigation state from database on mount (ONCE)
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
          // Normalize old phase names to new
          setNavigationPhase(normalizePhase(data.navigation_phase));
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
          
          if (navigation_phase) {
            const normalizedPhase = normalizePhase(navigation_phase);
            if (normalizedPhase !== navigationPhase) {
              setNavigationPhase(normalizedPhase);
              if (mode === 'client') {
                toast.info(normalizedPhase === 'to_destination' 
                  ? 'Prestador chegou ao veículo!' 
                  : 'Navegação iniciada');
              }
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
  useEffect(() => {
    if (mode !== 'provider') return;
    if (!providerLocation || !currentDestination) return;
    
    const routeKey = `${chamado.id}-${navigationPhase}`;
    if (routeCalculatedRef.current === routeKey) return;
    
    if (routePolyline && routeCalculatedRef.current.includes(chamado.id)) {
      routeCalculatedRef.current = routeKey;
      return;
    }

    const doCalculateRoute = async () => {
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
  }, [mode, navigationPhase, chamado.id, !!providerLocation, !!currentDestination]);

  // Update route data when routeData changes
  useEffect(() => {
    if (routeData) {
      setDistance(routeData.distanceText);
      setEta(routeData.durationText);
      setRoutePolyline(routeData.polyline);
    }
  }, [routeData]);

  // Track unread messages
  useEffect(() => {
    if (showChat) {
      setHasUnreadMessages(false);
      setLastReadMessageCount(chatMessages.length);
    } else if (chatMessages.length > lastReadMessageCount) {
      setHasUnreadMessages(true);
    }
  }, [chatMessages.length, showChat, lastReadMessageCount]);

  // Handle call button click
  const handleCall = useCallback(() => {
    if (!otherPartyPhone) {
      toast.error('Telefone não disponível');
      return;
    }
    const cleanPhone = otherPartyPhone.replace(/[^\d+]/g, '');
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
      // Update database with new phase (using old format for backwards compatibility)
      await supabase
        .from('chamados')
        .update({
          provider_arrived_at_vehicle: true,
          navigation_phase: 'to_destination',
        })
        .eq('id', chamado.id);

      clearRoute();
      clearRouteCache();
      routeCalculatedRef.current = '';
      
      setNavigationPhase('to_destination');
      setEta('');
      setDistance('');
      
      toast.success('Chegada confirmada!');
    } catch (error) {
      console.error('[Navigation] Error confirming arrival:', error);
      toast.error('Erro ao confirmar chegada');
    } finally {
      setIsConfirming(false);
    }
  };

  // Handle finish button click - check if direct payment confirmation is needed
  const handleFinishClick = () => {
    if (isDirectPaymentToProvider) {
      // Show direct payment confirmation dialog first
      setShowDirectPaymentDialog(true);
    } else {
      // Standard finish flow
      setShowFinishDialog(true);
    }
  };

  // When provider confirms they received direct payment
  const handleConfirmDirectPayment = async () => {
    setShowDirectPaymentDialog(false);
    setIsConfirming(true);

    try {
      // Get commission percentage for audit log
      const { data: commissionSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_commission_percentage')
        .single();
      
      const commissionPercentage = commissionSetting?.value ? Number(commissionSetting.value) : 0;
      
      // Calculate fee with invariant checks
      const feeCalc = calculateFee(chamado.valor, commissionPercentage);
      
      if (!canFinalizeWithFee(feeCalc)) {
        toast.error('Erro no cálculo da taxa. Contate o suporte.');
        setIsConfirming(false);
        return;
      }
      
      // Create immutable audit log
      const auditLog = createFeeAuditLog(feeCalc);
      console.log('[DirectPayment] Audit log:', auditLog);

      // Record payment receipt confirmation with audit data
      await supabase
        .from('chamados')
        .update({
          direct_payment_receipt_confirmed: true,
          direct_payment_confirmed_at: auditLog.data_hora_confirmacao_pagamento,
          provider_arrived_at_destination: true,
          // Store fee calculation in chamado for audit
          commission_percentage: feeCalc.feePercentage,
          commission_amount: feeCalc.feeAmount,
          provider_amount: feeCalc.providerNetAmount,
        })
        .eq('id', chamado.id);

      await finishService();
      toast.success('Pagamento confirmado! Serviço finalizado.');
    } catch (error) {
      console.error('[Navigation] Error confirming direct payment:', error);
      toast.error('Erro ao confirmar pagamento');
    } finally {
      setIsConfirming(false);
    }
  };

  // When provider says they haven't received payment yet
  const handleNotReceivedPayment = () => {
    setShowDirectPaymentDialog(false);
    toast.info('Colete o pagamento antes de finalizar.');
  };

  const handleFinishService = async () => {
    setShowFinishDialog(false);
    setIsConfirming(true);

    try {
      await supabase
        .from('chamados')
        .update({
          provider_arrived_at_destination: true,
        })
        .eq('id', chamado.id);

      await finishService();
    } catch (error) {
      console.error('[Navigation] Error finishing service:', error);
      toast.error('Erro ao finalizar serviço');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleManualRecalculate = useCallback(async () => {
    if (!providerLocation || !currentDestination) {
      toast.error('Localização não disponível');
      return;
    }
    
    toast.info('Recalculando rota...');
    
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

  // Toggle controls visibility
  const toggleControls = useCallback(() => {
    setShowControls(prev => !prev);
  }, []);

  // GPS Error state
  if (mode === 'provider' && gpsError) {
    return (
      <div className="h-full flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">GPS Necessário</h2>
          <p className="text-muted-foreground mb-4">{gpsError}</p>
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
        </div>
      </div>
    );
  }

  const themeClass = mode === 'provider' ? 'provider-theme' : '';

  return (
    <div className={`relative h-full ${themeClass}`} onClick={toggleControls}>
      {/* Direct payment banner - sticky at top for provider */}
      {mode === 'provider' && isDirectPaymentToProvider && chamado.valor && (
        <div className="absolute top-0 left-0 right-0 z-20">
          <DirectPaymentBanner amount={chamado.valor} />
        </div>
      )}

      {/* Full screen map - takes 100% */}
      <OptimizedNavigationMap 
        providerLocation={providerLocation}
        destination={currentDestination}
        routePolyline={routePolyline}
        followProvider={mode === 'provider'}
        providerHeading={providerHeading || 0}
        className="absolute inset-0" 
      />

      {/* Top info display - different for provider vs client */}
      {/* Adjust top position when direct payment banner is shown */}
      <div className={cn(
        "absolute left-3 right-3 z-10 transition-all duration-300",
        mode === 'provider' && isDirectPaymentToProvider ? "top-32" : "top-20",
        showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}>
        {mode === 'provider' ? (
          /* Turn-by-turn navigation for provider - Google Maps style */
          <TurnByTurnDisplay
            currentInstruction={navigationState.currentInstruction}
            nextInstruction={navigationState.nextInstruction}
            eta={eta || navigationState.eta}
            distance={distance || navigationState.distance}
          />
        ) : (
          /* Client status display - Uber style */
          <ClientStatusDisplay
            status={navigationState.clientStatus}
            eta={eta || navigationState.eta}
            distance={distance || navigationState.distance}
            progress={navigationState.progress}
            phase={navigationPhase}
            serviceType={chamado.tipoServico}
            providerName={provider?.name}
          />
        )}
        
        {/* Recalculate button for provider */}
        {mode === 'provider' && (
          <div className="flex justify-end mt-2">
            {isCalculatingRoute ? (
              <div className="bg-card/90 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Calculando...</span>
              </div>
            ) : (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleManualRecalculate();
                }}
                className="h-8 rounded-full shadow-card bg-card/90 backdrop-blur-md"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Recalcular
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Contact buttons - floating left - compact */}
      <div className={cn(
        "absolute left-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1.5 transition-all duration-300",
        showControls ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
      )}>
        <Button 
          variant="secondary" 
          size="icon"
          className="w-10 h-10 rounded-full shadow-card bg-card/95 backdrop-blur-md"
          onClick={(e) => {
            e.stopPropagation();
            handleCall();
          }}
          disabled={contactLoading}
        >
          <Phone className="w-4 h-4" />
        </Button>
        <Button 
          variant="secondary" 
          size="icon"
          className={cn(
            "w-10 h-10 rounded-full shadow-card bg-card/95 backdrop-blur-md relative",
            hasUnreadMessages && "ring-2 ring-primary"
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenChat();
          }}
        >
          <MessageCircle className="w-4 h-4" />
          {hasUnreadMessages && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
          )}
        </Button>
      </div>

      {/* Bottom action button - always visible - compact */}
      <div className="absolute bottom-4 left-3 right-3 z-10">
        {mode === 'provider' ? (
          // For services WITH destination (guincho), show "Cheguei ao veículo" then "Finalizar"
          // For services WITHOUT destination (borracharia, chaveiro, mecanica), show only "Cheguei ao local" then "Finalizar"
          isGoingToClient ? (
            <Button 
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                // If has destination (guincho), confirm arrival to vehicle
                // Otherwise, use finish click handler (handles direct payment)
                if (hasDestination) {
                  setShowArrivalDialog(true);
                } else {
                  handleFinishClick();
                }
              }}
              className="w-full h-12 rounded-xl text-sm font-semibold shadow-lg bg-provider-primary hover:bg-provider-primary/90"
              disabled={isConfirming}
            >
              {isConfirming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasDestination ? (
                <CheckCircle className="w-4 h-4 mr-1.5" />
              ) : (
                <Flag className="w-4 h-4 mr-1.5" />
              )}
              {hasDestination ? 'Cheguei ao veículo' : 'Cheguei ao local - Finalizar'}
            </Button>
          ) : (
            <Button 
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                handleFinishClick();
              }}
              className="w-full h-12 rounded-xl text-sm font-semibold shadow-lg bg-green-600 hover:bg-green-700"
              disabled={isConfirming}
            >
              {isConfirming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Flag className="w-4 h-4 mr-1.5" />
              )}
              Finalizar corrida
            </Button>
          )
        ) : (
          <div className={cn(
            "transition-all duration-300",
            showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          )}>
            <div className="bg-card/95 backdrop-blur-md rounded-xl p-3 shadow-card">
              <div className="flex items-center gap-2.5 mb-2">
                {provider && (
                  <img 
                    src={provider.avatar} 
                    alt={provider.name}
                    className="w-10 h-10 rounded-full border-2 border-primary/20"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{provider?.name || 'Prestador'}</p>
                  <p className="text-[10px] text-muted-foreground">{serviceConfig.label}</p>
                </div>
                <p className="font-bold text-base">R$ {chamado.valor?.toFixed(2)}</p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  cancelChamado();
                }}
                className="w-full text-center text-xs text-destructive py-1"
              >
                Cancelar serviço
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AlertDialog open={showArrivalDialog} onOpenChange={setShowArrivalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-provider-primary" />
              Confirmar chegada ao veículo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está confirmando que chegou ao local do veículo do cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmArrival}
              className="bg-provider-primary hover:bg-provider-primary/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-green-500" />
              Finalizar corrida
            </AlertDialogTitle>
            <AlertDialogDescription>
              Confirme que o serviço foi concluído com sucesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleFinishService}
              className="bg-green-600 hover:bg-green-700"
            >
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Direct Payment Confirmation Dialog */}
      <DirectPaymentConfirmationDialog
        open={showDirectPaymentDialog}
        onOpenChange={setShowDirectPaymentDialog}
        amount={chamado.valor || 0}
        chamadoId={chamado.id}
        onConfirmReceived={handleConfirmDirectPayment}
        onNotReceived={handleNotReceivedPayment}
        isLoading={isConfirming}
      />

      <ChatModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        otherPartyName={otherPartyName || (mode === 'provider' ? 'Cliente' : 'Prestador')}
        mode={mode}
      />
    </div>
  );
}
