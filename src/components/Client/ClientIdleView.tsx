import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { RealMapView, MapProvider } from '../Map/RealMapView';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearbyProviders } from '@/hooks/useNearbyProviders';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useAddressHistory } from '@/hooks/useAddressHistory';
import { Button } from '../ui/button';
import { ChevronRight, Check, Loader2, Crosshair, MapPin, Search, Car, Wrench } from 'lucide-react';
import { Location, ServiceType, SERVICE_CONFIG, serviceRequiresDestination } from '@/types/chamado';
import { VehicleType } from '@/types/vehicleTypes';
import { VehicleTypeSelector } from './VehicleTypeSelector';
import { LocationPermissionModal } from '../Permissions/LocationPermissionModal';
import { PermissionDeniedBanner } from '../Permissions/PermissionDeniedBanner';
import { NotificationCTA } from '../Notifications/NotificationCTA';
import { DestinationBottomSheet } from './DestinationBottomSheet';
import { OriginSearchFullScreen } from './OriginSearchFullScreen';

const NEARBY_RADIUS_KM = 15;

// Subtle animation variants - discreet, not step-like
const subtleFade = {
  hidden: { 
    opacity: 0, 
    y: 8,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 0.2, 1] as const,
    }
  },
  exit: { 
    opacity: 0, 
    transition: { duration: 0.15 }
  }
};

const panelVariants = {
  hidden: { y: '100%' },
  visible: { 
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 35,
    }
  }
};

export function ClientIdleView() {
  const { createChamado } = useApp();
  const { 
    location: userLocation, 
    loading: locationLoading, 
    error: locationError, 
    refresh: refreshLocation,
    requestLocation,
    permissionStatus,
    isGranted: locationGranted,
    isDenied: locationDenied,
    needsPermission: locationNeedsPermission
  } = useGeolocation({ watch: false, autoRequest: false });
  
  // Notificações - usando novo hook com fluxo correto
  const {
    permission: notifPermission,
    shouldShowCTA: shouldShowNotifCTA,
    requestPermission: requestNotifPermission,
    dismissCTA: dismissNotifCTA,
  } = useNotificationPermission('client');
  
  // Address history for destination field
  const { addresses: recentAddresses, saveAddress } = useAddressHistory();
  
  const [selectedService, setSelectedService] = useState<ServiceType>('guincho');
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType>('carro_passeio');
  const [origem, setOrigem] = useState<Location | null>(null);
  const [origemText, setOrigemText] = useState<string>('');
  const [usingGpsLocation, setUsingGpsLocation] = useState(false);
  const [destino, setDestino] = useState<Location | null>(null);
  const [destinoText, setDestinoText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [destinationSheetOpen, setDestinationSheetOpen] = useState(false);
  const [originSearchOpen, setOriginSearchOpen] = useState(false);
  
  // Permission modals
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationPermissionLoading, setLocationPermissionLoading] = useState(false);
  const [dismissedLocationBanner, setDismissedLocationBanner] = useState(false);
  
  // Pending action after permission
  const pendingActionRef = useRef<'gps' | 'submit' | null>(null);

  const serviceConfig = SERVICE_CONFIG[selectedService];
  const needsDestination = serviceRequiresDestination(selectedService);

  const searchLocation = useMemo(() => origem || userLocation, [origem, userLocation]);
  
  const { providers: nearbyProviders, loading: providersLoading, reset: resetProviders } = useNearbyProviders({
    userLocation: searchLocation,
    radiusKm: NEARBY_RADIUS_KM,
    enabled: !!searchLocation,
  });

  // RESET on mount - ensure clean state for cross-platform consistency
  useEffect(() => {
    console.log('[ClientIdleView] Mount - resetting providers');
    resetProviders();
    
    return () => {
      console.log('[ClientIdleView] Unmount');
    };
  }, [resetProviders]);

  const mapProviders: MapProvider[] = useMemo(() => {
    return nearbyProviders.map(p => ({
      id: p.id,
      location: p.location,
      name: p.name,
      services: p.services,
      distance: p.distance,
    }));
  }, [nearbyProviders]);

  const serviceProviderCount = useMemo(() => {
    return nearbyProviders.filter(p => p.services.includes(selectedService)).length;
  }, [nearbyProviders, selectedService]);

  // Handle location permission result
  useEffect(() => {
    if (locationGranted && userLocation && pendingActionRef.current === 'gps') {
      setOrigem(userLocation);
      setOrigemText(userLocation.address);
      setUsingGpsLocation(true);
      pendingActionRef.current = null;
    }
  }, [locationGranted, userLocation]);

  const handleOrigemSelect = (location: Location) => {
    setOrigem(location);
    setOrigemText(location.address);
    setUsingGpsLocation(false);
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
    // If permission already granted, just get location
    if (locationGranted) {
      if (userLocation) {
        setOrigem(userLocation);
        setOrigemText(userLocation.address);
        setUsingGpsLocation(true);
      } else {
        refreshLocation();
      }
      return;
    }

    // If permission denied, show banner (already visible)
    if (locationDenied) {
      return;
    }

    // Need to ask for permission - show explanation modal first
    pendingActionRef.current = 'gps';
    setShowLocationModal(true);
  };

  const handleLocationPermissionConfirm = async () => {
    setLocationPermissionLoading(true);
    setShowLocationModal(false);
    
    // Now request the actual system permission
    requestLocation();
    setLocationPermissionLoading(false);
  };

  const handleLocationPermissionDecline = () => {
    setShowLocationModal(false);
    pendingActionRef.current = null;
  };

  const handleDestinoSelect = (location: Location) => {
    setDestino(location);
    setDestinoText(location.address);
    // Save to history
    saveAddress(location);
  };

  const handleDestinoTextChange = (text: string) => {
    setDestinoText(text);
    setDestino(null);
  };

  const handleSolicitar = async () => {
    // Double-click protection
    if (isSubmitting) return;
    if (!origem) return;
    if (needsDestination && !destino) return;
    
    setIsSubmitting(true);
    try {
      await createChamado(selectedService, origem, needsDestination ? destino : null, selectedVehicleType);
    } finally {
      // Small delay to prevent rapid re-clicks
      setTimeout(() => setIsSubmitting(false), 2000);
    }
  };

  const canSubmit = origem && (!needsDestination || destino) && selectedVehicleType && !isSubmitting;

  // Progressive visibility states
  const showServiceType = !!origem;
  const showDestination = showServiceType && needsDestination;
  const showLocalInfo = showServiceType && !needsDestination;
  const showVehicleType = showServiceType && selectedService && (!needsDestination || destino);
  const showCTA = showVehicleType && selectedVehicleType;

  // Smart CTA text based on service type
  const getCtaText = () => {
    if (isSubmitting) return 'Solicitando...';
    if (selectedService === 'guincho') return 'Solicitar guincho';
    return 'Solicitar assistência no local';
  };

  return (
    <>
      <div className="relative h-full">
      {/* Map - free mode, no auto-centering on user interaction */}
      <RealMapView 
        center={searchLocation}
        origem={origem}
        destino={needsDestination ? destino : null}
        showRoute={needsDestination && !!origem && !!destino}
        providers={mapProviders}
        showUserLocation={!origem && locationGranted}
        animateProviders={true}
        className="absolute inset-0" 
        zoom={origem ? 14 : 13}
        mode="free"
        showRecenterButton={true}
      />
      
      {/* Provider status - Compact floating card */}
      <div className="absolute top-3 left-3 right-3 z-10 space-y-2">
        {/* Notification CTA - Solicita permissão em gesto explícito */}
        {shouldShowNotifCTA && (
          <NotificationCTA
            userType="client"
            permission={notifPermission}
            onRequestPermission={requestNotifPermission}
            onDismiss={dismissNotifCTA}
          />
        )}
        
        {/* Location denied banner */}
        {locationDenied && !dismissedLocationBanner && (
          <PermissionDeniedBanner 
            type="location"
            onDismiss={() => setDismissedLocationBanner(true)}
          />
        )}
        
        <div className="bg-card/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-md border border-border/30 flex items-center gap-3 animate-fade-in">
          <div className="relative flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              nearbyProviders.length > 0 ? 'bg-primary/10' : 'bg-muted'
            }`}>
              <Car className={`w-5 h-5 ${nearbyProviders.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            {nearbyProviders.length > 0 && (
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] text-primary-foreground font-semibold">
                {nearbyProviders.length}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {providersLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Buscando prestadores...</p>
              </div>
            ) : nearbyProviders.length > 0 ? (
              <>
                <p className="text-sm font-medium">
                  {nearbyProviders.length} prestador{nearbyProviders.length > 1 ? 'es' : ''} próximo{nearbyProviders.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {serviceProviderCount > 0 
                    ? `${serviceProviderCount} oferece${serviceProviderCount > 1 ? 'm' : ''} ${serviceConfig.label.toLowerCase()}`
                    : `Raio de ${NEARBY_RADIUS_KM}km`}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  {!origem && !userLocation ? 'Informe a localização do veículo' : 'Procurando prestadores...'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {!origem && !userLocation ? 'Use o GPS ou digite o endereço' : 'Normalmente leva poucos minutos'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom panel - Progressive UX */}
      <motion.div 
        className="absolute bottom-0 left-0 right-0 z-10"
        initial="hidden"
        animate="visible"
        variants={panelVariants}
      >
        <div className="bg-card rounded-t-3xl shadow-2xl border-t border-border/20">
          {/* Handle indicator */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
          </div>
          
          <div className="px-5 pb-5 space-y-4 max-h-[60vh] overflow-y-auto">
          
            {/* 1. ORIGEM - Always visible */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Localização do veículo
              </p>

              {/* GPS Button */}
              <button
                onClick={handleUseMyLocation}
                disabled={locationLoading || locationDenied}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${
                  usingGpsLocation 
                    ? 'bg-primary/10 ring-2 ring-primary/40' 
                    : locationDenied
                      ? 'bg-muted/50 opacity-60 cursor-not-allowed'
                      : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  usingGpsLocation ? 'bg-primary' : 'bg-muted'
                }`}>
                  {locationLoading ? (
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                  ) : (
                    <Crosshair className={`w-4 h-4 ${usingGpsLocation ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium text-sm ${usingGpsLocation ? 'text-primary' : 'text-foreground'}`}>
                    {locationDenied ? 'Localização desativada' : 'Usar minha localização'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {usingGpsLocation ? 'GPS ativo' : locationDenied ? 'Ative nas configurações' : 'Detectar via GPS'}
                  </p>
                </div>
                {usingGpsLocation && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </button>

              {/* Address input - opens full screen search */}
              <button
                onClick={() => setOriginSearchOpen(true)}
                className="w-full flex items-center gap-3 p-3 bg-secondary rounded-xl text-left hover:bg-secondary/80 transition-colors"
              >
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className={`flex-1 text-sm font-medium ${origemText ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {origemText || 'Ou digite o endereço'}
                </span>
              </button>
              
              {locationError && !locationDenied && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {locationError}
                </p>
              )}
            </div>

            {/* 2. TIPO DE SERVIÇO - Progressive: show after origem */}
            <AnimatePresence>
              {showServiceType && (
                <motion.div 
                  key="service-type"
                  variants={subtleFade}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-3"
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Tipo de assistência
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(SERVICE_CONFIG) as ServiceType[]).map((serviceType, index) => {
                      const config = SERVICE_CONFIG[serviceType];
                      const isSelected = selectedService === serviceType;
                      const typeProviderCount = nearbyProviders.filter(p => 
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
                          className={`flex items-center gap-2.5 p-3 rounded-xl transition-all ${
                            isSelected 
                              ? 'bg-primary/10 ring-1 ring-primary/30' 
                              : 'bg-secondary/50 hover:bg-secondary'
                          }`}
                        >
                          <span className="text-lg">{config.icon}</span>
                          <div className="flex-1 min-w-0 text-left">
                            <p className={`font-medium text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                              {config.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {typeProviderCount > 0 
                                ? `${typeProviderCount} disponíve${typeProviderCount > 1 ? 'is' : 'l'}` 
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* 3. DESTINO - Progressive: show only for guincho */}
            <AnimatePresence>
              {showDestination && (
                <motion.div 
                  key="destination"
                  variants={subtleFade}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-3"
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Destino do veículo
                  </p>
                  
                  {/* Trigger button that opens Bottom Sheet */}
                  <button
                    onClick={() => setDestinationSheetOpen(true)}
                    className="w-full flex items-center gap-3 p-3.5 bg-secondary rounded-xl ring-1 ring-border/50 hover:bg-secondary/80 transition-colors text-left"
                  >
                    <MapPin className={`w-5 h-5 flex-shrink-0 ${destino ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`flex-1 text-sm font-medium truncate ${
                      destino ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {destinoText || 'Oficina, casa ou outro destino'}
                    </span>
                    {destino && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Local service info - when destination not needed */}
            <AnimatePresence>
              {showLocalInfo && (
                <motion.div 
                  key="local-info"
                  variants={subtleFade}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                >
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Atendimento no local do veículo
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 4. TIPO DE VEÍCULO - Progressive */}
            <AnimatePresence>
              {showVehicleType && (
                <motion.div 
                  key="vehicle-type"
                  variants={subtleFade}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-3"
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Tipo de veículo
                  </p>
                  <VehicleTypeSelector 
                    value={selectedVehicleType} 
                    onChange={setSelectedVehicleType} 
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 5. BOTÃO CTA - Progressive */}
            <AnimatePresence>
              {showCTA && (
                <motion.div 
                  key="cta-button"
                  variants={subtleFade}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="pt-1"
                >
                  <Button 
                    onClick={handleSolicitar}
                    className="w-full h-12 text-base font-semibold rounded-xl"
                    size="lg"
                    disabled={!canSubmit}
                  >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Solicitando...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">{serviceConfig.icon}</span>
                          {getCtaText()}
                          <ChevronRight className="w-5 h-5 ml-1" />
                        </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Location Permission Modal */}
      <LocationPermissionModal 
        open={showLocationModal}
        onConfirm={handleLocationPermissionConfirm}
        onDecline={handleLocationPermissionDecline}
        userType="client"
        loading={locationPermissionLoading}
      />

      {/* Destination Bottom Sheet - Uber/99 style */}
      <DestinationBottomSheet
        open={destinationSheetOpen}
        onClose={() => setDestinationSheetOpen(false)}
        onSelect={handleDestinoSelect}
        recentAddresses={recentAddresses}
        initialValue={destinoText}
      />

      {/* Origin Full Screen Search */}
      <OriginSearchFullScreen
        open={originSearchOpen}
        onClose={() => setOriginSearchOpen(false)}
        onSelect={handleOrigemSelect}
        initialValue={origemText}
      />

    </div>
    </>
  );
}
