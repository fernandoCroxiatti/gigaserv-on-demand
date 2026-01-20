import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, Marker, DirectionsRenderer, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Location, ServiceType } from '@/types/chamado';
import { Loader2, AlertCircle, Navigation2 } from 'lucide-react';
import { ProviderMarkers } from './ProviderMarkers';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

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
  /** Animate camera to center with smooth flyTo transition */
  animateToCenter?: boolean;
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
  animateToCenter = false,
}: RealMapViewProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  
  // Track user interaction state for map centering - NO TIMERS
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const hasUserInteractedRef = useRef(false);
  
  // Track if initial center was set
  const initialCenterSetRef = useRef(false);
  
  // Track last animated center to detect significant position changes for flyTo
  const lastAnimatedCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  
  // Store the center used for initial map render - prevents re-centering on prop changes
  // In 'free' mode, this is set ONCE and never updated, ensuring complete camera isolation
  const [stableCenter, setStableCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Calculate dynamic zoom based on search radius
  const effectiveZoom = useMemo(() => {
    if (zoom !== undefined) return zoom;
    if (showSearchRadius) return getZoomForRadius(searchRadius);
    return 15;
  }, [zoom, showSearchRadius, searchRadius]);

  /**
   * Smooth flyTo animation - calculates distance and animates camera
   */
  const flyToLocation = useCallback((targetLat: number, targetLng: number) => {
    if (!map) return;
    
    const currentCenter = map.getCenter();
    if (!currentCenter) {
      map.panTo({ lat: targetLat, lng: targetLng });
      return;
    }
    
    const startLat = currentCenter.lat();
    const startLng = currentCenter.lng();
    
    // Calculate distance to determine animation duration
    const distance = Math.sqrt(
      Math.pow(targetLat - startLat, 2) + Math.pow(targetLng - startLng, 2)
    );
    
    // Skip animation if distance is too small (< 50m ~ 0.0005 degrees)
    if (distance < 0.0005) {
      map.panTo({ lat: targetLat, lng: targetLng });
      return;
    }
    
    // Duration: 400-1200ms based on distance
    const duration = Math.min(1200, Math.max(400, distance * 50000));
    const startTime = performance.now();
    
    // Easing function for smooth deceleration
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      
      const lat = startLat + (targetLat - startLat) * eased;
      const lng = startLng + (targetLng - startLng) * eased;
      
      map.setCenter({ lat, lng });
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete
        lastAnimatedCenterRef.current = { lat: targetLat, lng: targetLng };
        setStableCenter({ lat: targetLat, lng: targetLng });
      }
    };
    
    requestAnimationFrame(animate);
  }, [map]);

  /**
   * GPS Location Updates - MARKER ONLY
   * 
   * This effect updates the user's MARKER position continuously.
   * It does NOT move the map camera - that's controlled by mode and auto-follow logic.
   * 
   * Separation principle:
   * - userLocation state = marker position (always updated by GPS)
   * - map.panTo = camera movement (only in follow/navigation mode, or explicit recenter)
   */
  useEffect(() => {
    if (!showUserLocation || !navigator.geolocation) return;
    
    // Watch position for continuous marker updates
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        // Update marker position state - camera movement handled separately
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Sua localização',
        });
      },
      (error) => console.error('Geolocation error:', error),
      { enableHighAccuracy: true, maximumAge: 0 }
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, [showUserLocation]);

  // Calculate route - unchanged
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

  // Handle user interaction - sets map to free mode
  // NO TIMERS - user must explicitly click recenter to restore follow
  const handleInteractionStart = useCallback(() => {
    setIsUserInteracting(true);
    hasUserInteractedRef.current = true;
    onUserInteraction?.();
  }, [onUserInteraction]);

  const handleInteractionEnd = useCallback(() => {
    // NO auto-return timer - user must explicitly recenter
    // This prevents any automatic recentering that could interfere with destination selection
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

  // Handle recenter button click - explicit user action to restore follow
  const handleRecenter = useCallback(() => {
    setIsUserInteracting(false);
    hasUserInteractedRef.current = false;
    
    // Pan to current center (prioritize origem, then userLocation)
    const targetCenter = center || userLocation;
    if (map && targetCenter) {
      map.panTo({ lat: targetCenter.lat, lng: targetCenter.lng });
      setStableCenter({ lat: targetCenter.lat, lng: targetCenter.lng });
    }
  }, [map, center, userLocation]);

  /**
   * Camera Auto-Follow Logic - MODE-BASED
   * 
   * CRITICAL: This is the ONLY place that moves the map camera based on location.
   * 
   * Rules:
   * - 'free' mode: Set initial center ONCE, then NEVER auto-center again.
   *                User must click recenter button to restore follow.
   * - 'follow' mode: Always auto-center on location updates.
   * - 'navigation' mode: Auto-center unless user is interacting.
   *                      (Navigation uses OptimizedNavigationMap with its own logic)
   * 
   * NOTE: MapDestinationPicker is COMPLETELY ISOLATED - it creates its own map
   * instance and is unaffected by this effect or any mode changes.
   */
  useEffect(() => {
    if (!map) return;
    
    const targetCenter = center || userLocation;
    if (!targetCenter) return;
    
    // FREE MODE: Handle initial center and flyTo animation
    if (mode === 'free') {
      if (!initialCenterSetRef.current) {
        // First center - may be fallback, just pan quickly
        map.panTo({ lat: targetCenter.lat, lng: targetCenter.lng });
        setStableCenter({ lat: targetCenter.lat, lng: targetCenter.lng });
        lastAnimatedCenterRef.current = { lat: targetCenter.lat, lng: targetCenter.lng };
        initialCenterSetRef.current = true;
      } else if (animateToCenter) {
        // Check if position changed significantly (> 100m ~ 0.001 degrees)
        const lastCenter = lastAnimatedCenterRef.current;
        if (lastCenter) {
          const distance = Math.sqrt(
            Math.pow(targetCenter.lat - lastCenter.lat, 2) + 
            Math.pow(targetCenter.lng - lastCenter.lng, 2)
          );
          // Only flyTo if moved more than ~100m
          if (distance > 0.001) {
            console.log('[RealMapView] FlyTo animation triggered, distance:', distance);
            flyToLocation(targetCenter.lat, targetCenter.lng);
          }
        }
      }
      // In free mode, GPS updates marker but camera only moves via flyTo
      return;
    }
    
    // FOLLOW MODE: Always auto-center
    if (mode === 'follow' && !isUserInteracting) {
      if (animateToCenter && lastAnimatedCenterRef.current) {
        flyToLocation(targetCenter.lat, targetCenter.lng);
      } else {
        map.panTo({ lat: targetCenter.lat, lng: targetCenter.lng });
        setStableCenter({ lat: targetCenter.lat, lng: targetCenter.lng });
        lastAnimatedCenterRef.current = { lat: targetCenter.lat, lng: targetCenter.lng };
      }
      return;
    }
    
    // NAVIGATION MODE: Auto-center unless user is interacting
    // Note: Active navigation typically uses OptimizedNavigationMap, not this component
    if (mode === 'navigation' && !isUserInteracting) {
      map.panTo({ lat: targetCenter.lat, lng: targetCenter.lng });
      setStableCenter({ lat: targetCenter.lat, lng: targetCenter.lng });
      lastAnimatedCenterRef.current = { lat: targetCenter.lat, lng: targetCenter.lng };
    }
  }, [map, center, userLocation, mode, isUserInteracting, animateToCenter, flyToLocation]);

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

  // Use stableCenter for 'free' mode to prevent re-centering on prop changes
  // For other modes, use the calculated mapCenter
  const mapCenter = mode === 'free' && stableCenter
    ? stableCenter
    : center 
      ? { lat: center.lat, lng: center.lng }
      : userLocation 
        ? { lat: userLocation.lat, lng: userLocation.lng }
        : defaultCenter;

  // Determine if we should show recenter button
  // In 'free' mode, show button after any user interaction (drag/zoom)
  const shouldShowRecenter = showRecenterButton && mode === 'free' && hasUserInteractedRef.current;

  return (
    <div className={cn("relative", className)}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={effectiveZoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={mapOptions}
      >
        {/* Search radius circle - synced with slider value */}
        {showSearchRadius && mapCenter && (
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

        {/* User location marker - always shows current GPS position */}
        {showUserLocation && userLocation && (
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

        {/* Origin marker */}
        {origem && !directions && (
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

        {/* Destination marker */}
        {destino && !directions && (
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

        {/* Provider markers with animation */}
        <ProviderMarkers providers={providerMarkers} animate={animateProviders} />

        {/* Route */}
        {directions && (
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
      </GoogleMap>
      
      {/* Recenter button - shows when user has interacted with map */}
      {shouldShowRecenter && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRecenter}
          className="absolute bottom-4 right-4 z-10 bg-card shadow-md gap-2"
        >
          <Navigation2 className="w-4 h-4" />
          Centralizar
        </Button>
      )}
    </div>
  );
}
