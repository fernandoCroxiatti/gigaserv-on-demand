import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { OptimizedNavigationMap } from '../Map/OptimizedNavigationMap';
import { TurnByTurnDisplay } from './TurnByTurnDisplay';
import { ClientStatusDisplay } from './ClientStatusDisplay';
import { useNavigationRoute } from '@/hooks/useNavigationRoute';
import { useNavigationInstructions } from '@/hooks/useNavigationInstructions';
import { useRemainingDistance } from '@/hooks/useRemainingDistance';
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
import { Chamado, SERVICE_CONFIG } from '@/types/chamado';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { safeLocalStorage } from '@/lib/safeStorage';
import { calculateFee, createFeeAuditLog, canFinalizeWithFee } from '@/lib/feeCalculator';
import { parseSettingNumber } from '@/lib/appSettings';
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

// Local storage key for phase persistence fallback (prevents regression on unexpected reload)
const PHASE_STORAGE_KEY_PREFIX = 'nav_phase_';

interface NavigationFullScreenInnerProps extends NavigationFullScreenProps {
  chamado: Chamado;
  finishService: () => Promise<void>;
  profile: any;
  availableProviders: any[];
  cancelChamado: () => Promise<void> | void;
  chatMessages: any[];
}

export function NavigationFullScreen({ mode }: NavigationFullScreenProps) {
  const { chamado, finishService, profile, availableProviders, cancelChamado, chatMessages } = useApp();

  if (!chamado) return null;

  return (
    <NavigationFullScreenInner
      mode={mode}
      chamado={chamado}
      finishService={finishService}
      profile={profile}
      availableProviders={availableProviders}
      cancelChamado={cancelChamado}
      chatMessages={chatMessages}
    />
  );
}

function NavigationFullScreenInner({
  mode,
  chamado,
  finishService,
  profile,
  availableProviders,
  cancelChamado,
  chatMessages,
}: NavigationFullScreenInnerProps) {
  const [navigationPhase, setNavigationPhase] = useState<NavigationPhase>('to_client');
  const [routePolyline, setRoutePolyline] = useState<string>('');
  const [eta, setEta] = useState<string>('');
  const [distance, setDistance] = useState<string>('');
  const [initialDistanceMeters, setInitialDistanceMeters] = useState<number>(0);
  const [initialDurationSeconds, setInitialDurationSeconds] = useState<number>(0);
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

  // Check if this is a direct payment to provider (from backend flag)
  const isDirectPaymentToProvider = chamado?.directPaymentToProvider === true;

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

  // Track GPS availability for timeout detection
  const lastGpsSignalRef = useRef<number>(Date.now());
  const gpsTimeoutCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Calculated values for current navigation phase
  // These MUST be defined before hooks that depend on them
  const hasDestination = chamado?.destino !== null;
  const isGoingToClient = navigationPhase === 'to_client';
  const currentDestination = isGoingToClient ? chamado?.origem : chamado?.destino;
  
  // Refs for stable callback access (avoids stale closure issues)
  const currentDestinationRef = useRef(currentDestination);
  currentDestinationRef.current = currentDestination;
  
  const navigationPhaseRef = useRef(navigationPhase);
  navigationPhaseRef.current = navigationPhase;
  
  const chamadoIdRef = useRef(chamado?.id);
  chamadoIdRef.current = chamado?.id;

  // Provider mode: use realtime GPS with throttled updates
  // GPS updates marker position LOCALLY only - no API calls
  // MUST be declared BEFORE useRouteDeviation that references providerGPSLocation
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
      // Update last GPS signal time for timeout detection
      lastGpsSignalRef.current = Date.now();
      
      // Throttle database updates to reduce load (5 seconds)
      const now = Date.now();
      if (now - lastGpsUpdateRef.current < GPS_UPDATE_INTERVAL) return;
      lastGpsUpdateRef.current = now;

      // Check route deviation LOCALLY (no API call here)
      // Only triggers recalculation if >100m off route for >5s
      // AND at least 2 minutes since last recalculation
      if (routePolyline) {
        checkDeviation(location, routePolyline);
      }

      // Update provider position in database (for client tracking)
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
  
  // Ref for providerGPSLocation for stable callback access
  const providerGPSLocationRef = useRef(providerGPSLocation);
  providerGPSLocationRef.current = providerGPSLocation;
  
  // OPTIMIZED: Route deviation detection with strict controls
  // - 100m deviation threshold
  // - 2 minute minimum between recalculations
  // - 5 second confirmation before triggering
  const { checkDeviation, clearRouteCache, resetRecalculateTimer } = useRouteDeviation({
    maxDeviationMeters: 100, // Increased from 50m to reduce API calls
    minTimeOffRoute: 5000, // 5 seconds to confirm deviation
    minRecalculateInterval: 120000, // 2 MINUTES minimum between recalculations
    onRecalculateNeeded: useCallback(() => {
      const gpsLoc = providerGPSLocationRef.current;
      const dest = currentDestinationRef.current;
      const phase = navigationPhaseRef.current;
      const id = chamadoIdRef.current;
      
      if (mode === 'provider' && gpsLoc && dest) {
        // Silent recalculation - no toast for auto recalc
        console.log('[Navigation] Auto-recalculating due to route deviation (controlled)');
        forceRecalculateRoute(gpsLoc, dest, id || '', phase);
      }
    }, [mode, forceRecalculateRoute]),
  });

  // NOTE: GPS timeout useEffect moved after currentDestination declaration

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

  // Valor correto da corrida (preferir valor confirmado; fallback para valor acordado)
  const serviceValue =
    typeof chamado?.valor === 'number' && chamado.valor > 0
      ? chamado.valor
      : typeof chamado?.valorProposto === 'number' && chamado.valorProposto > 0
        ? chamado.valorProposto
        : 0;

  const serviceConfig = chamado ? SERVICE_CONFIG[chamado.tipoServico] : null;

  // GPS timeout detection - recalculate if GPS unavailable for 30+ seconds
  useEffect(() => {
    if (mode !== 'provider') return;
    
    gpsTimeoutCheckRef.current = setInterval(() => {
      const timeSinceLastSignal = Date.now() - lastGpsSignalRef.current;
      
      // If GPS unavailable for more than 30 seconds
      if (timeSinceLastSignal > 30000 && providerGPSLocation && currentDestination) {
        console.log('[Navigation] GPS unavailable for 30s, may need recalculation when signal returns');
        // Clear route cache so next GPS signal can trigger fresh calculation if needed
        clearRouteCache();
      }
    }, 10000); // Check every 10 seconds
    
    return () => {
      if (gpsTimeoutCheckRef.current) {
        clearInterval(gpsTimeoutCheckRef.current);
      }
    };
  }, [mode, providerGPSLocation, currentDestination, clearRouteCache]);

  // Use navigation instructions hook for turn-by-turn and status
  const navigationState = useNavigationInstructions({
    providerLocation,
    destination: currentDestination || undefined,
    phase: navigationPhase,
    isProvider: mode === 'provider',
  });

  // Calculate remaining distance dynamically based on current position (NO extra API calls)
  const remainingDistance = useRemainingDistance(
    providerLocation,
    routePolyline,
    initialDistanceMeters,
    initialDurationSeconds,
    navigationPhase
  );

  // Track last phase to detect changes (avoid stale closure issues)
  const lastReceivedPhaseRef = useRef<string>(navigationPhase);

  // Note: Early return moved to after ALL hooks (React rules)
  
  // Sync ref and persist phase to local storage when it changes (fallback for reload recovery)
  useEffect(() => {
    lastReceivedPhaseRef.current = navigationPhase;
    
    // Persist phase to local storage for reload recovery
    if (chamado?.id) {
      const storageKey = `${PHASE_STORAGE_KEY_PREFIX}${chamado.id}`;
      safeLocalStorage.setItem(storageKey, navigationPhase);
    }
  }, [navigationPhase, chamado?.id]);

  // Load navigation state from database on mount (ONCE)
  // FALLBACK: Check local storage first for phase recovery after unexpected reload
  useEffect(() => {
    if (!chamado?.id) return;
    
    const loadNavigationState = async () => {
      // Check local storage for cached phase (fallback for reload recovery)
      const storageKey = `${PHASE_STORAGE_KEY_PREFIX}${chamado.id}`;
      const cachedPhase = safeLocalStorage.getItem(storageKey);
      
      const { data, error } = await supabase
        .from('chamados')
        .select('navigation_phase, route_polyline, route_distance_meters, route_duration_seconds')
        .eq('id', chamado.id)
        .single();

      if (error) {
        console.error('[Navigation] Error loading state:', error);
        // If DB fails but we have cached phase, use it as fallback
        if (cachedPhase) {
          const normalizedPhase = normalizePhase(cachedPhase);
          console.log('[Navigation] Using cached phase as fallback:', normalizedPhase);
          setNavigationPhase(normalizedPhase);
          lastReceivedPhaseRef.current = normalizedPhase;
        }
        return;
      }

      if (data) {
        // Determine the phase: prefer DB, but use local cache if DB is behind
        // This handles the race condition where DB hasn't synced yet
        const dbPhase = normalizePhase(data.navigation_phase);
        const localPhase = cachedPhase ? normalizePhase(cachedPhase) : null;
        
        // If local storage has 'to_destination' but DB has 'to_client', trust local
        // This is the critical recovery scenario - DB may be stale after reload
        const phaseOrder: NavigationPhase[] = ['to_client', 'at_client', 'to_destination', 'finished'];
        const dbIndex = phaseOrder.indexOf(dbPhase);
        const localIndex = localPhase ? phaseOrder.indexOf(localPhase) : -1;
        
        const finalPhase = localIndex > dbIndex ? localPhase! : dbPhase;
        
        if (localIndex > dbIndex) {
          console.log('[Navigation] Local phase ahead of DB, using local:', localPhase, 'vs DB:', dbPhase);
        }
        
        setNavigationPhase(finalPhase);
        lastReceivedPhaseRef.current = finalPhase;
        
        if (data.route_polyline) {
          setRoutePolyline(data.route_polyline);
          routeCalculatedRef.current = `${chamado.id}-${data.navigation_phase}`;
        }
        if (data.route_distance_meters) {
          setDistance(formatDistance(data.route_distance_meters));
          setInitialDistanceMeters(data.route_distance_meters);
        }
        if (data.route_duration_seconds) {
          setEta(formatDuration(data.route_duration_seconds));
          setInitialDurationSeconds(data.route_duration_seconds);
        }
      }
    };

    loadNavigationState();
  }, [chamado?.id]);
  
  // Subscribe to navigation updates (for syncing between client and provider)
  // CRITICAL: Client must update route data when provider changes phase (especially guincho 2nd phase)
  useEffect(() => {
    if (!chamado?.id) return;
    
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
          
          console.log('[Navigation] Realtime update received:', {
            navigation_phase,
            hasPolyline: !!route_polyline,
            distance: route_distance_meters,
            duration: route_duration_seconds,
          });
          
          if (navigation_phase) {
            const normalizedPhase = normalizePhase(navigation_phase);
            const phaseChanged = normalizedPhase !== lastReceivedPhaseRef.current;
            
            if (phaseChanged) {
              console.log('[Navigation] Phase changed via realtime:', lastReceivedPhaseRef.current, '->', normalizedPhase);
              lastReceivedPhaseRef.current = normalizedPhase;
              setNavigationPhase(normalizedPhase);
              
              // CRITICAL: When phase changes, clear old route data to show fresh route
              if (mode === 'client') {
                // Clear old route until new one arrives
                setRoutePolyline('');
                setEta('');
                setDistance('');
                
                toast.info(normalizedPhase === 'to_destination' 
                  ? 'Prestador chegou ao veículo! Iniciando transporte...' 
                  : 'Navegação iniciada');
              }
            }
          }
          
          // ALWAYS update route data when available (even if phase didn't change)
          // This handles the case where provider sends phase first, then route data second
          if (route_polyline && route_polyline.length > 0) {
            console.log('[Navigation] Route polyline received via realtime, length:', route_polyline.length);
            setRoutePolyline(route_polyline);
          }
          
          if (typeof route_distance_meters === 'number' && route_distance_meters > 0) {
            console.log('[Navigation] Distance received via realtime:', route_distance_meters);
            setDistance(formatDistance(route_distance_meters));
            setInitialDistanceMeters(route_distance_meters);
          }
          
          if (typeof route_duration_seconds === 'number' && route_duration_seconds > 0) {
            console.log('[Navigation] Duration received via realtime:', route_duration_seconds);
            setEta(formatDuration(route_duration_seconds));
            setInitialDurationSeconds(route_duration_seconds);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chamado?.id, mode]); // Removed navigationPhase to avoid recreating channel on phase change

  // Calculate route ONCE when phase changes (provider only)
  // CRITICAL: For guincho, must recalculate when changing from to_client to to_destination
  useEffect(() => {
    if (mode !== 'provider') return;
    if (!chamado?.id) return;
    if (!providerLocation || !currentDestination) return;
    
    const routeKey = `${chamado.id}-${navigationPhase}`;
    
    // Already calculated for this exact phase - skip
    if (routeCalculatedRef.current === routeKey) {
      console.log('[Navigation] Route already calculated for:', routeKey);
      return;
    }
    
    // IMPORTANT: Do NOT skip if phase changed - we need new route for new destination
    // Only skip if we have a polyline AND it's for the SAME phase (not different phase)
    const currentPhaseFromRef = routeCalculatedRef.current.split('-').pop();
    if (routePolyline && currentPhaseFromRef === navigationPhase) {
      console.log('[Navigation] Polyline exists for same phase, marking as calculated');
      routeCalculatedRef.current = routeKey;
      return;
    }

    const doCalculateRoute = async () => {
      console.log('[Navigation] Calculating route for phase:', navigationPhase, {
        hasDestination: !!currentDestination,
        destinationAddress: currentDestination?.address,
        isGoingoToClient: navigationPhase === 'to_client',
      });
      
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
        console.log('[Navigation] Route calculated successfully for phase:', navigationPhase);
      }
    };

    doCalculateRoute();
  }, [mode, navigationPhase, chamado?.id, !!providerLocation, !!currentDestination]);

  // Update route data when routeData changes
  useEffect(() => {
    if (routeData) {
      setDistance(routeData.distanceText);
      setEta(routeData.durationText);
      setRoutePolyline(routeData.polyline);
      // Store initial values for remaining distance calculation
      if (routeData.distanceMeters && routeData.distanceMeters > 0) {
        setInitialDistanceMeters(routeData.distanceMeters);
      }
      if (routeData.durationSeconds && routeData.durationSeconds > 0) {
        setInitialDurationSeconds(routeData.durationSeconds);
      }
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
    try {
      window.location.href = `tel:${cleanPhone}`;
    } catch {
      // ignore
    }
  }, [otherPartyPhone]);

  // Handle message button click
  const handleOpenChat = useCallback(() => {
    setShowChat(true);
    setHasUnreadMessages(false);
    setLastReadMessageCount(chatMessages.length);
  }, [chatMessages.length]);

  const handleConfirmArrival = async () => {
    if (!chamado) return;
    
    setShowArrivalDialog(false);
    setIsConfirming(true);

    try {
      // CRITICAL: For guincho services, recalculate route from current provider location to final destination
      const newDestination = chamado.destino;
      
      if (!newDestination) {
        toast.error('Destino não configurado');
        setIsConfirming(false);
        return;
      }

      // Clear all route state BEFORE updating phase
      clearRoute();
      clearRouteCache();
      routeCalculatedRef.current = '';
      setRoutePolyline('');
      setEta('');
      setDistance('');
      
      // Update local phase FIRST to trigger proper calculation
      setNavigationPhase('to_destination');
      
      // Update database with new phase
      await supabase
        .from('chamados')
        .update({
          provider_arrived_at_vehicle: true,
          navigation_phase: 'to_destination',
          // Clear old route data so client gets fresh route
          route_polyline: null,
          route_distance_meters: null,
          route_duration_seconds: null,
        })
        .eq('id', chamado.id);

      // Force immediate route recalculation with current position (prefer providerLocation as fallback)
      const currentPos = providerLocation || providerGPSLocation;
      if (currentPos) {
        console.log('[Navigation] Phase 2: Calculating route from current position to destination');
        const result = await forceRecalculateRoute(
          currentPos,
          newDestination,
          chamado.id,
          'to_destination'
        );
        
        if (result) {
          setRoutePolyline(result.polyline);
          setDistance(result.distanceText);
          setEta(result.durationText);
          routeCalculatedRef.current = `${chamado.id}-to_destination`;
          console.log('[Navigation] Phase 2 route calculated:', {
            distance: result.distanceText,
            eta: result.durationText,
          });
        }
      }
      
      toast.success('Chegada confirmada! Navegando para o destino final.');
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
    if (!chamado) return;
    
    setShowDirectPaymentDialog(false);
    setIsConfirming(true);

    try {
      // Get commission percentage for audit log
      const { data: commissionSetting, error: commissionError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_commission_percentage')
        .single();

      if (commissionError) throw commissionError;

      const commissionPercentage = parseSettingNumber(commissionSetting?.value);
      if (commissionPercentage === null || commissionPercentage < 0 || commissionPercentage > 100) {
        toast.error('Taxa do app não configurada. Verifique a configuração.');
        setIsConfirming(false);
        return;
      }

      // Calculate fee with invariant checks
      const feeCalc = calculateFee(serviceValue, commissionPercentage);
      
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

      // Clean up local storage phase cache on service finish
      const storageKey = `${PHASE_STORAGE_KEY_PREFIX}${chamado.id}`;
      safeLocalStorage.removeItem(storageKey);

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
    if (!chamado) return;
    
    setShowFinishDialog(false);
    setIsConfirming(true);

    try {
      await supabase
        .from('chamados')
        .update({
          provider_arrived_at_destination: true,
        })
        .eq('id', chamado.id);

      // Clean up local storage phase cache on service finish
      const storageKey = `${PHASE_STORAGE_KEY_PREFIX}${chamado.id}`;
      safeLocalStorage.removeItem(storageKey);

      await finishService();
    } catch (error) {
      console.error('[Navigation] Error finishing service:', error);
      toast.error('Erro ao finalizar serviço');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleManualRecalculate = useCallback(async () => {
    if (!chamado) return;
    if (!providerLocation || !currentDestination) {
      toast.error('Localização não disponível');
      return;
    }
    
    // Brief toast only for manual recalculation
    toast.info('Recalculando...');
    
    // Reset the recalculation timer to respect debounce
    resetRecalculateTimer();
    clearRouteCache();
    
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
  }, [providerLocation, currentDestination, chamado?.id, navigationPhase, forceRecalculateRoute, resetRecalculateTimer, clearRouteCache]);

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
      <div className={cn(
        "absolute left-3 right-3 z-10 transition-all duration-300 top-20",
        showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}>
        {mode === 'provider' ? (
          /* Turn-by-turn navigation for provider - Google Maps style */
          <TurnByTurnDisplay
            currentInstruction={navigationState.currentInstruction}
            nextInstruction={navigationState.nextInstruction}
            eta={remainingDistance.remainingTimeText || eta || navigationState.eta}
            distance={remainingDistance.remainingDistanceText || distance || navigationState.distance}
          />
        ) : (
          /* Client status display - Uber style */
          <ClientStatusDisplay
            status={navigationState.clientStatus}
            eta={remainingDistance.remainingTimeText || eta || navigationState.eta}
            distance={remainingDistance.remainingDistanceText || distance || navigationState.distance}
            progress={remainingDistance.progress || navigationState.progress}
            phase={navigationPhase}
            serviceType={chamado?.tipoServico || 'guincho'}
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
              ) : isDirectPaymentToProvider ? (
                <CheckCircle className="w-4 h-4 mr-1.5" />
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

      {/* Standard Finish Dialog (non-direct payment) */}
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
        amount={serviceValue}
        chamadoId={chamado.id}
        providerId={chamado.prestadorId}
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
