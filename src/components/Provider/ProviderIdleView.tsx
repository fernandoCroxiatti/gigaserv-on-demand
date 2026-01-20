import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { Button } from '../ui/button';
import { Power, Radar, Star, MapPin, Settings2, Check, AlertCircle, ChevronDown, Ban } from 'lucide-react';
import { Slider } from '../ui/slider';
import { useTWAGeolocation } from '@/hooks/useTWAGeolocation';
import { SERVICE_CONFIG, ServiceType, Location } from '@/types/chamado';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { NotificationCTA } from '../Notifications/NotificationCTA';
import { LocationPermissionModal } from '../Permissions/LocationPermissionModal';
import { PermissionDeniedBanner } from '../Permissions/PermissionDeniedBanner';
import { useAntiFraud } from '@/hooks/useAntiFraud';
import { FinancialAlertBanner } from './FinancialAlertBanner';
import { useAuth } from '@/hooks/useAuth';
import { useProviderOnlineSync } from '@/hooks/useProviderOnlineSync';
import { useProviderAutoOffline } from '@/hooks/useProviderAutoOffline';

const ALL_SERVICES: ServiceType[] = ['guincho', 'borracharia', 'mecanica', 'chaveiro'];

/**
 * PROVIDER IDLE VIEW - TWA OPTIMIZED
 * 
 * Uses Web Geolocation API exclusively for TWA compatibility.
 * Never blocks UI - app opens instantly, GPS refines in background.
 * Once "ready", never goes back to "locating" automatically.
 */

export function ProviderIdleView() {
  const { user, toggleProviderOnline, setProviderRadarRange, setProviderServices, updateProviderLocation, providerData } = useApp();
  const { user: authUser } = useAuth();
  
  // TWA-optimized geolocation: fast first fix, background refinement
  const { 
    location, 
    status: gpsStatus,
    error: geoError, 
    accuracy: gpsAccuracy,
    isReady: gpsReady,
    isLocating: gpsLocating,
    hasLocation,
    isPermissionDenied: locationDenied,
    startLocating,
    refresh: refreshLocation,
  } = useTWAGeolocation({ autoStart: true });
  
  const [showServiceConfig, setShowServiceConfig] = useState(false);
  const [stripeVerified, setStripeVerified] = useState(false);
  const [checkingStripe, setCheckingStripe] = useState(true);
  const [waitingForGps, setWaitingForGps] = useState(false);
  const navigate = useNavigate();
  
  const { checkDebtLimit, checkProviderCanAccept } = useAntiFraud();
  const [financialInfo, setFinancialInfo] = useState<{
    isBlocked: boolean;
    reason: string | null;
    pendingBalance: number;
    maxLimit: number;
  } | null>(null);
  
  // Notificações - usando novo hook com fluxo correto
  const {
    permission: notifPermission,
    shouldShowCTA: shouldShowNotifCTA,
    requestPermission: requestNotifPermission,
    dismissCTA: dismissNotifCTA,
  } = useNotificationPermission('provider');
  
  // Permission modals
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationPermissionLoading, setLocationPermissionLoading] = useState(false);
  const [dismissedLocationBanner, setDismissedLocationBanner] = useState(false);
  
  const pendingToggleOnlineRef = useRef(false);
  const gpsValidationAttemptRef = useRef(0);
  
  const isOnline = user?.providerData?.online || false;
  const radarRange = user?.providerData?.radarRange || 15;
  const currentServices = (providerData?.services_offered as ServiceType[]) || ['guincho'];
  const isRegistrationComplete = providerData?.registration_complete === true;
  
  // CRITICAL: Validate that location is FRESH (not from database cache)
  // With TWA hook, hasLocation means we have a real GPS fix
  const hasFreshGpsLocation = hasLocation;
  const latestLocationRef = useRef<Location | null>(null);

  // Fallback center (visual only): last known DB position so the map can render instantly.
  // IMPORTANT: This MUST NOT be used to go online or receive chamados.
  const fallbackCenter: Location | undefined = !hasFreshGpsLocation && providerData?.current_lat && providerData?.current_lng
    ? {
        lat: Number(providerData.current_lat),
        lng: Number(providerData.current_lng),
        address: providerData.current_address || 'Última localização',
      }
    : undefined;

  useEffect(() => {
    latestLocationRef.current = location;
  }, [location]);

  // Stop any "waiting" UI once we have a real fix (background GPS succeeded)
  useEffect(() => {
    if (gpsReady) setWaitingForGps(false);
  }, [gpsReady]);

  // Provider online sync - sends heartbeats with location while online
  // IMPORTANT: Does NOT force online state - respects manual toggle
  const handleReconnected = useCallback(() => {
    console.log('[ProviderIdle] Reconnected successfully');
    // Silent - don't spam user with toasts on every reconnection
  }, []);

  useProviderOnlineSync({
    userId: authUser?.id || null,
    isOnline,
    hasLocation: hasFreshGpsLocation,
    onReconnected: handleReconnected
  });

  // Hook para forçar offline quando o app perde foco ou é fechado
  // Não altera o fluxo atual de "ficar online", apenas força offline ao sair
  useProviderAutoOffline({
    userId: authUser?.id || null,
    isOnline
  });

  // TWA hook auto-starts, no manual trigger needed

  useEffect(() => {
    const checkStripeStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-connect-status');
        if (!error && data) {
          const isVerified = data.stripe_status === 'verified' && 
                            data.charges_enabled === true && 
                            data.payouts_enabled === true;
          setStripeVerified(isVerified);
        }
      } catch (err) {
        console.error('Error checking Stripe status:', err);
      } finally {
        setCheckingStripe(false);
      }
    };
    checkStripeStatus();
  }, []);

  // Check financial status
  useEffect(() => {
    const checkFinancialStatus = async () => {
      if (!authUser?.id) return;
      
      const debtInfo = await checkDebtLimit(authUser.id);
      const canAcceptInfo = await checkProviderCanAccept(authUser.id);
      
      setFinancialInfo({
        isBlocked: !canAcceptInfo.canAccept,
        reason: canAcceptInfo.blockReason || null,
        pendingBalance: debtInfo.currentDebt,
        maxLimit: debtInfo.maxLimit,
      });
    };
    checkFinancialStatus();
  }, [authUser?.id, checkDebtLimit, checkProviderCanAccept]);

  // Handle pending toggle online after location ready
  useEffect(() => {
    if (gpsReady && pendingToggleOnlineRef.current) {
      pendingToggleOnlineRef.current = false;
      proceedWithToggleOnline();
    }
  }, [gpsReady]);

  const toggleService = (service: ServiceType) => {
    const newServices = currentServices.includes(service)
      ? currentServices.filter(s => s !== service)
      : [...currentServices, service];
    
    if (newServices.length > 0) {
      setProviderServices(newServices);
    }
  };

  const proceedWithToggleOnline = async () => {
    // RULE: never go online without a confirmed real GPS fix.
    if (!hasFreshGpsLocation) {
      setWaitingForGps(true);
      void refreshLocation();
      return;
    }

    const loc = latestLocationRef.current;
    if (!loc) {
      setWaitingForGps(true);
      void refreshLocation();
      return;
    }

    // Anti-cache: if same as last saved AND last update is old, force a new fix (background) and keep offline.
    const lastLat = providerData?.current_lat ?? null;
    const lastLng = providerData?.current_lng ?? null;
    const lastUpdatedAt = providerData?.updated_at ? Date.parse(providerData.updated_at) : null;
    const isOld = lastUpdatedAt ? (Date.now() - lastUpdatedAt) > 10 * 60 * 1000 : true;
    const sameAsDb = lastLat !== null && lastLng !== null &&
      Math.abs(loc.lat - lastLat) < 0.00001 &&
      Math.abs(loc.lng - lastLng) < 0.00001;

    if (sameAsDb && isOld) {
      setWaitingForGps(true);
      void refreshLocation();
      return;
    }

    setWaitingForGps(false);

    // Update location in DB with FRESH GPS coordinates before going online
    console.log('[ProviderIdle] Updating location with FRESH GPS before going online:', loc);
    await updateProviderLocation({
      lat: loc.lat,
      lng: loc.lng,
      address: loc.address,
    });

    await toggleProviderOnline();

    console.log('[ProviderIdle] Toggle online complete with fresh location');
  };

  const handleToggleOnline = async () => {
    // If going offline, just toggle
    if (isOnline) {
      await toggleProviderOnline();
      return;
    }

    // Going online - check requirements first
    if (!isRegistrationComplete) {
      toast.error('Finalize seu cadastro para começar a atender.', {
        action: { label: 'Ir para cadastro', onClick: () => navigate('/profile') },
      });
      return;
    }

    if (!stripeVerified) {
      toast.error('Ative os recebimentos para começar a atender.', {
        action: { label: 'Configurar', onClick: () => navigate('/profile?tab=bank') },
      });
      return;
    }
    
    // Check if can accept financially
    if (authUser?.id) {
      const canAcceptInfo = await checkProviderCanAccept(authUser.id);
      if (!canAcceptInfo.canAccept) {
        toast.error('Você possui pendências que impedem de ficar online.', {
          action: { label: 'Ver taxas', onClick: () => navigate('/profile?tab=fees') },
          duration: 5000,
        });
        return;
      }
    }

    // Check location permission
    if (locationDenied) {
      toast.error('Permissão de localização necessária para ficar online.', {
        description: 'Ative nas configurações do dispositivo.',
      });
      return;
    }

    // If GPS not ready yet, show modal to wait
    if (!gpsReady && gpsStatus !== 'error') {
      // Show location explanation modal first
      pendingToggleOnlineRef.current = true;
      setShowLocationModal(true);
      return;
    }

    // All checks passed, proceed
    await proceedWithToggleOnline();
  };

  const handleLocationPermissionConfirm = async () => {
    setLocationPermissionLoading(true);
    setShowLocationModal(false);
    
    // Request the actual system permission via TWA hook
    startLocating();
    setLocationPermissionLoading(false);
  };

  const handleLocationPermissionDecline = () => {
    setShowLocationModal(false);
    pendingToggleOnlineRef.current = false;
  };

  useEffect(() => {
    if (isOnline && location) {
      updateProviderLocation({ lat: location.lat, lng: location.lng, address: location.address });
    }
  }, [isOnline, location, updateProviderLocation]);

  return (
    <div className="relative h-full provider-theme">
      {/* Map opens instantly with fallback center (last DB position) until real GPS arrives */}
      {/* animateToCenter enables smooth flyTo when GPS location arrives */}
      <RealMapView 
        className="absolute inset-0" 
        center={location || fallbackCenter} 
        showSearchRadius={isOnline} 
        searchRadius={radarRange}
        animateToCenter={gpsReady}
      />

      {/* Notification CTA - Solicita permissão em gesto explícito */}
      {shouldShowNotifCTA && (
        <div className="absolute top-3 left-3 right-3 z-20">
          <NotificationCTA
            userType="provider"
            permission={notifPermission}
            onRequestPermission={requestNotifPermission}
            onDismiss={dismissNotifCTA}
          />
        </div>
      )}

      {/* Location error/denied banner */}
      {locationDenied && !dismissedLocationBanner && (
        <div className={`absolute ${shouldShowNotifCTA ? 'top-20' : 'top-3'} left-3 right-3 z-10`}>
          <PermissionDeniedBanner 
            type="location"
            onDismiss={() => setDismissedLocationBanner(true)}
          />
        </div>
      )}

      <div className={`absolute ${shouldShowNotifCTA ? (locationDenied && !dismissedLocationBanner ? 'top-36' : 'top-20') : (locationDenied && !dismissedLocationBanner ? 'top-20' : 'top-3')} left-3 right-3 z-10 animate-slide-down`}>
        <div className={`bg-card rounded-xl px-4 py-3 shadow-sm ${isOnline ? 'ring-1 ring-provider-primary/20' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <img src={user?.avatar} alt={user?.name} className="w-11 h-11 rounded-full object-cover" />
              {isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-provider-primary rounded-full flex items-center justify-center ring-2 ring-card">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{user?.name}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="w-3 h-3 text-status-searching fill-current" />
                <span>{user?.providerData?.rating?.toFixed(1)}</span>
                <span className="text-border">•</span>
                <span>{user?.providerData?.totalServices} serviços</span>
              </div>
            </div>
            <span className={`status-badge ${isOnline ? 'bg-provider-primary/10 text-provider-primary' : 'bg-muted text-muted-foreground'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-2xl shadow-xl p-4 space-y-3">
          
          {/* NON-BLOCKING GPS status indicator (small, subtle) */}
          {gpsLocating && !isOnline && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-xs text-muted-foreground animate-fade-in">
              <MapPin className="w-3.5 h-3.5 animate-pulse" />
              <span>Atualizando localização...</span>
            </div>
          )}
          
          {/* Show accuracy when refining */}
          {gpsStatus === 'refining' && gpsAccuracy && !isOnline && (
            <div className="flex items-center gap-2 px-3 py-2 bg-provider-primary/10 rounded-lg text-xs text-provider-primary animate-fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>Localização: ±{Math.round(gpsAccuracy)}m</span>
            </div>
          )}

          {/* 1. STATUS - Highest priority: Online/Offline toggle */}
          <div className={`flex items-center justify-between gap-3 p-3 rounded-xl ${
            isOnline ? 'bg-provider-primary/10 ring-1 ring-provider-primary/30' : 'bg-secondary/50'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isOnline ? 'bg-provider-primary' : 'bg-muted'
              }`}>
                <Power className={`w-5 h-5 ${isOnline ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-semibold text-sm">{isOnline ? 'Você está online' : 'Você está offline'}</p>
                <p className="text-xs text-muted-foreground">
                  {isOnline 
                    ? 'Recebendo chamados' 
                    : waitingForGps 
                      ? 'Aguardando GPS para ficar online...'
                      : 'Ative para receber chamados'}
                </p>
              </div>
            </div>
            <Button 
              variant={isOnline ? 'outline' : 'provider'} 
              onClick={handleToggleOnline} 
              className={`h-10 px-5 font-semibold ${isOnline ? 'border-provider-primary text-provider-primary hover:bg-provider-primary/10' : ''}`}
              disabled={checkingStripe || waitingForGps}
            >
              {waitingForGps ? 'Localizando...' : isOnline ? 'Ficar offline' : 'Ficar online'}
            </Button>
          </div>

          {/* 2. SEARCH RADIUS - Only when online */}
          {isOnline && (
            <div className="space-y-2 px-1 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radar className="w-4 h-4 text-provider-primary" />
                  <span className="text-sm text-muted-foreground">Raio de busca</span>
                </div>
                <span className="text-base font-bold text-provider-primary">{radarRange} km</span>
              </div>
              <Slider 
                value={[radarRange]} 
                onValueChange={(value) => setProviderRadarRange(value[0])} 
                max={100} 
                min={5} 
                step={5} 
                className="provider-theme" 
              />
            </div>
          )}

          {/* 3. SERVICES OFFERED - Only when online */}
          {isOnline && (
            <div className="space-y-2 px-1 animate-fade-in">
              <button 
                onClick={() => setShowServiceConfig(!showServiceConfig)} 
                className="w-full flex items-center justify-between py-1"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-provider-primary" />
                  <span className="text-sm font-medium">Serviços oferecidos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {currentServices.length} selecionado{currentServices.length > 1 ? 's' : ''}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showServiceConfig ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {showServiceConfig && (
                <div className="grid grid-cols-2 gap-2 animate-fade-in">
                  {ALL_SERVICES.map((service) => {
                    const config = SERVICE_CONFIG[service];
                    const isSelected = currentServices.includes(service);
                    return (
                      <button 
                        key={service} 
                        onClick={() => toggleService(service)} 
                        className={`flex items-center gap-2 p-2.5 rounded-xl transition-all ${
                          isSelected 
                            ? 'bg-provider-primary/10 ring-1 ring-provider-primary/30' 
                            : 'bg-secondary/50 hover:bg-secondary'
                        }`}
                      >
                        <span className="text-lg">{config.icon}</span>
                        <span className={`text-xs font-medium flex-1 text-left ${isSelected ? 'text-provider-primary' : ''}`}>
                          {config.label}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-provider-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. FINANCIAL NOTICE - Lower priority, informative tone */}
          {financialInfo && (financialInfo.pendingBalance > 0 || financialInfo.isBlocked) && (
            <FinancialAlertBanner
              pendingBalance={financialInfo.pendingBalance}
              maxLimit={financialInfo.maxLimit}
              isBlocked={financialInfo.isBlocked}
              reason={financialInfo.reason}
            />
          )}

          {/* Registration/Stripe setup notice - only when offline */}
          {!isOnline && (!isRegistrationComplete || !stripeVerified) && !checkingStripe && (
            <div className="flex items-start gap-3 p-3 bg-status-searching/10 rounded-xl">
              <AlertCircle className="w-4 h-4 text-status-searching flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-status-searching">
                  {!isRegistrationComplete ? 'Finalize seu cadastro' : 'Ative os recebimentos'}
                </p>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-xs text-provider-primary" 
                  onClick={() => navigate(!isRegistrationComplete ? '/profile' : '/profile?tab=bank')}
                >
                  {!isRegistrationComplete ? 'Completar cadastro' : 'Configurar recebimentos'}
                </Button>
              </div>
            </div>
          )}

          {/* Tip for offline users ready to go online */}
          {!isOnline && isRegistrationComplete && stripeVerified && !financialInfo?.isBlocked && (
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">💡 Fique online para receber chamados na sua região</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Location Permission Modal */}
      <LocationPermissionModal 
        open={showLocationModal}
        onConfirm={handleLocationPermissionConfirm}
        onDecline={handleLocationPermissionDecline}
        userType="provider"
        loading={locationPermissionLoading}
      />
    </div>
  );
}
