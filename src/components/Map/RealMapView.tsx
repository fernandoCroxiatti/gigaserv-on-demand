import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, Marker, DirectionsRenderer, Circle, Polyline } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Location, ServiceType } from '@/types/chamado';
import { Loader2, AlertCircle, Navigation2, MapPin, Car } from 'lucide-react';
import { ProviderMarkers } from './ProviderMarkers';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { useRideTracking } from '@/hooks/useRideTracking';
import { RideInfoPanel } from './RideInfoPanel';

export interface MapProvider {
  id: string;
  location: Location;
  name: string;
  services?: ServiceType[];
  distance?: number;
}

/**
 * Map interaction modes - CRITICAL separation of GPS position vs camera control:
 * 
 * GPS Position Updates (ALWAYS):
 * - GPS continuously updates user/provider MARKER position
 * - Marker position reflects real-time location regardless of mode
 * 
 * Camera Movement (MODE-DEPENDENT):
 * - 'free': Camera controlled EXCLUSIVELY by user gestures. GPS updates marker only.
 *           NO auto-centering, NO timers, NO GPS-driven camera movement.
 *           User must explicitly click "Recenter" button to re-enable follow.
 *           Used by: destination picker, idle browsing
 * 
 * - 'follow': Camera automatically follows user location.
 *             GPS updates trigger both marker AND camera movement.
 *             Used by: initial map view, after explicit recenter
 * 
 * - 'navigation': Active ride navigation with auto-follow.
 *                 Uses separate OptimizedNavigationMap component with its own logic.
 *                 Has 8s auto-return timer after user interaction (intentional for navigation UX).
 *                 Used by: ProviderInServiceView, ClientInServiceView
 * 
 * ACTIVE RIDE MODE:
 * When a ride is active (detected by useRideTracking hook), the map automatically:
 * - Provider: Uses watchPosition() for real-time GPS tracking
 * - Client: Fetches provider location every 5 seconds from database
 * - Shows RideInfoPanel with time, distance, addresses, price
 * - Auto-follows the relevant position (provider location for both modes)
 * - Uses zoom level 16 for navigation
 * 
 * DESTINATION PICKER ISOLATION:
 * MapDestinationPicker creates a completely INDEPENDENT map instance via portal.
 * It ignores ALL external state, modes, and GPS-driven camera updates.
 * The picker's map is controlled SOLELY by user gestures.
 */
type MapMode = 'free' | 'follow' | 'navigation';

interface RealMapViewProps {
  center?: Location | null;
  origem?: Location | null;
  destino?: Location | null;
  providers?: MapProvider[];
  showRoute?: boolean;
  showUserLocation?: boolean;
  showSearchRadius?: boolean;
  searchRadius?: number; // in km
  onMapClick?: (location: Location) => void;
  className?: string;
  zoom?: number;
  animateProviders?: boolean;
  /** Map interaction mode - defaults to 'free' */
  mode?: MapMode;
  /** Callback when user interacts with map (drag/zoom) */
  onUserInteraction?: () => void;
  /** Show recenter button when in free mode */
  showRecenterButton?: boolean;
  /** Disable ride tracking overlay (e.g., for destination picker) */
  disableRideTracking?: boolean;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  gestureHandling: 'greedy', // Allow all gestures
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'transit',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

const defaultCenter = { lat: -23.5505, lng: -46.6333 }; // São Paulo

// Calculate zoom level based on radius (in km) to properly frame the circle
function getZoomForRadius(radiusKm: number): number {
  if (radiusKm <= 5) return 12;
  if (radiusKm <= 10) return 11;
  if (radiusKm <= 15) return 10.5;
  if (radiusKm <= 20) return 10;
  if (radiusKm <= 30) return 9.5;
  if (radiusKm <= 40) return 9;
  if (radiusKm <= 50) return 8.5;
  if (radiusKm <= 70) return 8;
  if (radiusKm <= 100) return 7.5;
  return 7;
}

// Car icon SVG for provider marker during active ride
const CAR_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1DB954" width="32" height="32">
  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
</svg>
`;

// Person icon for client marker
const PERSON_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#EF4444" width="28" height="28">
  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
</svg>
`;

export function RealMapView({
  center,
  origem,
  destino,
  providers = [],
  showRoute = false,
  showUserLocation = true,
  showSearchRadius = false,
  searchRadius = 5,
  onMapClick,
  className = '',
  zoom,
  animateProviders = true,
  mode = 'free',
  onUserInteraction,
  showRecenterButton = true,
  disableRideTracking = false,
}: RealMapViewProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [rideDirections, setRideDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  
  // Track user interaction state for map centering - NO TIMERS
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const hasUserInteractedRef = useRef(false);
  
  // Track if initial center was set
  const initialCenterSetRef = useRef(false);

  // Ride tracking hook for automatic detection and tracking
  const rideTracking = useRideTracking({
    statusPollingInterval: 10000,
    locationUpdateInterval: 5000,
  });

  // Previous provider location for smooth marker animation
  const prevProviderLocationRef = useRef<Location | null>(null);

  // Determine if we should show ride tracking overlay
  const showRideOverlay = !disableRideTracking && rideTracking.isActiveRide;

  // Calculate dynamic zoom based on search radius or ride mode
  const effectiveZoom = useMemo(() => {
    // Use zoom 16 during active ride
    if (showRideOverlay) return 16;
    if (zoom !== undefined) return zoom;
    if (showSearchRadius) return getZoomForRadius(searchRadius);
    return 15;
  }, [zoom, showSearchRadius, searchRadius, showRideOverlay]);

  // Track if user has manually dragged the map
  const hasUserDraggedRef = useRef(false);
  
  /**
   * GPS Location - SINGLE getCurrentPosition on mount ONLY
   * 
   * - Uses getCurrentPosition ONCE on initial load
   * - NO watchPosition - map never moves automatically after load
   * - User must click "Minha Localização" button to recenter
   * - After user drags, map NEVER auto-centers
   * 
   * EXCEPTION: During active ride, tracking is handled by useRideTracking hook
   */
  useEffect(() => {
    // Skip if ride tracking is active (it handles GPS)
    if (showRideOverlay) return;
    
    if (!showUserLocation || !navigator.geolocation) return;
    
    // Get position ONCE on mount - with battery-saving options
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Sua localização',
        });
      },
      (error) => console.error('Geolocation error:', error),
      { 
        enableHighAccuracy: false, 
        maximumAge: 30000, // Use cached position up to 30 seconds old
        timeout: 10000 
      }
    );
    
    // NO watchPosition - no automatic updates
  }, [showUserLocation, showRideOverlay]);

  // Calculate route for regular mode
  useEffect(() => {
    if (!showRoute || !origem || !destino || !isLoaded) {
      setDirections(null);
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: origem.lat, lng: origem.lng },
        destination: { lat: destino.lat, lng: destino.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        } else {
          console.error('Directions request failed:', status);
        }
      }
    );
  }, [showRoute, origem, destino, isLoaded]);

  // Calculate route during active ride (provider -> client or current -> destination)
  useEffect(() => {
    if (!showRideOverlay || !isLoaded) {
      setRideDirections(null);
      return;
    }

    const providerLoc = rideTracking.providerLocation;
    const clientLoc = rideTracking.clientLocation;
    const destLoc = rideTracking.destinationLocation;

    // Determine route endpoints based on mode and ride state
    let routeOrigin: Location | null = null;
    let routeDestination: Location | null = null;

    if (rideTracking.mode === 'provider' && providerLoc) {
      // Provider: show route to client (or destination if already at client)
      routeOrigin = providerLoc;
      routeDestination = destLoc || clientLoc;
    } else if (rideTracking.mode === 'client' && providerLoc) {
      // Client: show route from provider to client location
      routeOrigin = providerLoc;
      routeDestination = destLoc || clientLoc;
    }

    if (!routeOrigin || !routeDestination) {
      setRideDirections(null);
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: routeOrigin.lat, lng: routeOrigin.lng },
        destination: { lat: routeDestination.lat, lng: routeDestination.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setRideDirections(result);
        } else {
          console.error('Ride directions request failed:', status);
          setRideDirections(null);
        }
      }
    );
  }, [
    showRideOverlay,
    isLoaded,
    rideTracking.providerLocation?.lat,
    rideTracking.providerLocation?.lng,
    rideTracking.clientLocation?.lat,
    rideTracking.clientLocation?.lng,
    rideTracking.destinationLocation?.lat,
    rideTracking.destinationLocation?.lng,
    rideTracking.mode,
  ]);

  // Auto-follow provider location during active ride
  useEffect(() => {
    if (!showRideOverlay || !map || !rideTracking.providerLocation) return;
    
    // During active ride, don't respect user drag - always follow provider
    // unless user explicitly drags during THIS ride session
    if (!hasUserDraggedRef.current) {
      map.panTo({ 
        lat: rideTracking.providerLocation.lat, 
        lng: rideTracking.providerLocation.lng 
      });
    }
    
    // Update previous location for animation
    prevProviderLocationRef.current = rideTracking.providerLocation;
  }, [showRideOverlay, map, rideTracking.providerLocation]);

  // Handle user interaction - sets map to free mode permanently
  // Once user drags, map NEVER auto-centers again (except during active ride refresh)
  const handleInteractionStart = useCallback(() => {
    setIsUserInteracting(true);
    hasUserInteractedRef.current = true;
    hasUserDraggedRef.current = true; // Permanent flag - never auto-center after drag
    onUserInteraction?.();
  }, [onUserInteraction]);

  const handleInteractionEnd = useCallback(() => {
    // NO auto-return - user dragged, so map stays where they left it
  }, []);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    
    // Track user interaction
    mapInstance.addListener('dragstart', handleInteractionStart);
    mapInstance.addListener('dragend', handleInteractionEnd);
    mapInstance.addListener('zoom_changed', () => {
      handleInteractionStart();
      handleInteractionEnd();
    });
  }, [handleInteractionStart, handleInteractionEnd]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Handle "Minha Localização" button click
  // Uses getCurrentPosition to get fresh location and center map
  const handleMyLocation = useCallback(() => {
    if (!navigator.geolocation || !map) return;
    
    // Get fresh position with battery-saving options
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Sua localização',
        };
        setUserLocation(newLocation);
        map.panTo({ lat: newLocation.lat, lng: newLocation.lng });
        
        // Reset interaction state so button hides
        setIsUserInteracting(false);
        hasUserInteractedRef.current = false;
        hasUserDraggedRef.current = false; // Reset for ride tracking follow
      },
      (error) => console.error('Geolocation error:', error),
      { 
        enableHighAccuracy: false, 
        maximumAge: 30000, 
        timeout: 10000 
      }
    );
  }, [map]);

  // Handle recenter during active ride
  const handleRideRecenter = useCallback(() => {
    if (!map) return;
    
    if (rideTracking.providerLocation) {
      map.panTo({
        lat: rideTracking.providerLocation.lat,
        lng: rideTracking.providerLocation.lng,
      });
      hasUserDraggedRef.current = false; // Reset to re-enable auto-follow
    }
  }, [map, rideTracking.providerLocation]);

  /**
   * Camera Auto-Follow Logic - SIMPLIFIED for TWA
   * 
   * CRITICAL: After user drags, map NEVER auto-centers again.
   * User must explicitly click "Minha Localização" button.
   * 
   * Rules:
   * - Set initial center ONCE on mount
   * - If user has dragged (hasUserDraggedRef), NEVER auto-center
   * - No watchPosition, no continuous updates
   * 
   * EXCEPTION: During active ride, handled by separate effect above
   */
  useEffect(() => {
    if (!map || showRideOverlay) return;
    
    const targetCenter = center || userLocation;
    if (!targetCenter) return;
    
    // If user has EVER dragged the map, never auto-center
    if (hasUserDraggedRef.current) {
      return;
    }
    
    // Only set initial center once
    if (!initialCenterSetRef.current) {
      map.panTo({ lat: targetCenter.lat, lng: targetCenter.lng });
      initialCenterSetRef.current = true;
    }
    // NO auto-centering after initial load
  }, [map, center, userLocation, showRideOverlay]);

  const handleMapClick = useCallback(
    async (e: google.maps.MapMouseEvent) => {
      if (!onMapClick || !e.latLng) return;

      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      // Reverse geocode
      const geocoder = new google.maps.Geocoder();
      try {
        const response = await geocoder.geocode({ location: { lat, lng } });
        const address = response.results[0]?.formatted_address || `${lat}, ${lng}`;
        onMapClick({ lat, lng, address });
      } catch (error) {
        onMapClick({ lat, lng, address: `${lat}, ${lng}` });
      }
    },
    [onMapClick]
  );

  // Convert providers to marker format
  const providerMarkers = useMemo(() => {
    return providers.map(p => ({
      id: p.id,
      location: { lat: p.location.lat, lng: p.location.lng },
      name: p.name,
      services: p.services || ['guincho'] as ServiceType[],
      distance: p.distance,
    }));
  }, [providers]);

  // Create car icon for provider marker during active ride
  const carIcon = useMemo(() => {
    if (!isLoaded) return undefined;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(CAR_ICON_SVG)}`,
      scaledSize: new google.maps.Size(40, 40),
      anchor: new google.maps.Point(20, 20),
    };
  }, [isLoaded]);

  // Create person icon for client marker
  const personIcon = useMemo(() => {
    if (!isLoaded) return undefined;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(PERSON_ICON_SVG)}`,
      scaledSize: new google.maps.Size(32, 32),
      anchor: new google.maps.Point(16, 16),
    };
  }, [isLoaded]);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center bg-secondary ${className}`}>
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="font-medium text-destructive">Erro ao carregar Google Maps</p>
          <p className="text-sm text-muted-foreground mt-1">
            Verifique sua conexão e a API Key
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center bg-secondary ${className}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  // Determine map center based on mode
  let mapCenter: { lat: number; lng: number };
  if (showRideOverlay && rideTracking.providerLocation) {
    mapCenter = { lat: rideTracking.providerLocation.lat, lng: rideTracking.providerLocation.lng };
  } else if (center) {
    mapCenter = { lat: center.lat, lng: center.lng };
  } else if (userLocation) {
    mapCenter = { lat: userLocation.lat, lng: userLocation.lng };
  } else {
    mapCenter = defaultCenter;
  }

  // Show "Minha Localização" button only if:
  // - No active ride OR ride overlay is disabled
  // - Geolocation is supported
  // - User has interacted with map
  const shouldShowMyLocation = !showRideOverlay && showRecenterButton && navigator.geolocation && hasUserDraggedRef.current;

  return (
    <div className={cn("relative", className)}>
      {/* Ride Info Panel - only during active ride */}
      {showRideOverlay && (
        <RideInfoPanel
          elapsedTime={rideTracking.elapsedTime}
          distanceTraveled={rideTracking.distanceTraveled}
          originAddress={rideTracking.originAddress}
          destinationAddress={rideTracking.destinationAddress}
          estimatedPrice={rideTracking.estimatedPrice}
          providerName={rideTracking.providerName}
          clientName={rideTracking.clientName}
          mode={rideTracking.mode}
          rideStatus={rideTracking.rideStatus}
          lastUpdate={rideTracking.lastUpdate}
          onRefresh={rideTracking.refreshLocation}
        />
      )}

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={effectiveZoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={mapOptions}
      >
        {/* Search radius circle - synced with slider value (only when no active ride) */}
        {!showRideOverlay && showSearchRadius && mapCenter && (
          <Circle
            center={mapCenter}
            radius={searchRadius * 1000}
            options={{
              fillColor: '#2563EB',
              fillOpacity: 0.08,
              strokeColor: '#2563EB',
              strokeOpacity: 0.5,
              strokeWeight: 2,
              clickable: false,
            }}
          />
        )}

        {/* User location marker - only when no active ride */}
        {!showRideOverlay && showUserLocation && userLocation && (
          <Marker
            position={{ lat: userLocation.lat, lng: userLocation.lng }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#1DB954',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            }}
          />
        )}

        {/* Origin marker - only when no active ride */}
        {!showRideOverlay && origem && !directions && (
          <Marker
            position={{ lat: origem.lat, lng: origem.lng }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#1DB954',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            }}
          />
        )}

        {/* Destination marker - only when no active ride */}
        {!showRideOverlay && destino && !directions && (
          <Marker
            position={{ lat: destino.lat, lng: destino.lng }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#000000',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            }}
          />
        )}

        {/* Provider markers with animation - only when no active ride */}
        {!showRideOverlay && (
          <ProviderMarkers providers={providerMarkers} animate={animateProviders} />
        )}

        {/* Regular route - only when no active ride */}
        {!showRideOverlay && directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: false,
              polylineOptions: {
                strokeColor: '#1DB954',
                strokeWeight: 5,
                strokeOpacity: 0.8,
              },
            }}
          />
        )}

        {/* ACTIVE RIDE MARKERS AND ROUTE */}
        {showRideOverlay && (
          <>
            {/* Provider marker (car icon) */}
            {rideTracking.providerLocation && carIcon && (
              <Marker
                position={{ 
                  lat: rideTracking.providerLocation.lat, 
                  lng: rideTracking.providerLocation.lng 
                }}
                icon={carIcon}
                zIndex={100}
              />
            )}

            {/* Client/Origin marker (person icon) */}
            {rideTracking.clientLocation && personIcon && (
              <Marker
                position={{ 
                  lat: rideTracking.clientLocation.lat, 
                  lng: rideTracking.clientLocation.lng 
                }}
                icon={personIcon}
                zIndex={90}
              />
            )}

            {/* Destination marker */}
            {rideTracking.destinationLocation && (
              <Marker
                position={{ 
                  lat: rideTracking.destinationLocation.lat, 
                  lng: rideTracking.destinationLocation.lng 
                }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: '#EF4444',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 3,
                }}
                zIndex={80}
              />
            )}

            {/* Route during active ride */}
            {rideDirections && (
              <DirectionsRenderer
                directions={rideDirections}
                options={{
                  suppressMarkers: true, // We have our own markers
                  polylineOptions: {
                    strokeColor: '#1DB954',
                    strokeWeight: 6,
                    strokeOpacity: 0.9,
                  },
                }}
              />
            )}
          </>
        )}
      </GoogleMap>
      
      {/* "Minha Localização" floating button - bottom right, visible after user drags (no active ride) */}
      {shouldShowMyLocation && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleMyLocation}
          className="absolute bottom-4 right-4 z-10 bg-card shadow-lg gap-2 px-3 py-2"
        >
          <MapPin className="w-4 h-4 text-primary" />
          Minha Localização
        </Button>
      )}

      {/* Recenter button during active ride - only when user has dragged */}
      {showRideOverlay && hasUserDraggedRef.current && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRideRecenter}
          className="absolute bottom-4 right-4 z-10 bg-card shadow-lg gap-2 px-3 py-2"
        >
          <Navigation2 className="w-4 h-4 text-primary" />
          Centralizar
        </Button>
      )}
    </div>
  );
}
