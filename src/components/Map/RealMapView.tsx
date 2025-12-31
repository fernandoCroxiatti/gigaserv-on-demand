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
 * Map interaction modes:
 * - 'free': User can move freely, GPS updates position marker but NOT map center
 * - 'follow': Map follows user location automatically
 * - 'navigation': During active ride, auto-follow with recenter option on interaction
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

  // Calculate dynamic zoom based on search radius
  const effectiveZoom = useMemo(() => {
    if (zoom !== undefined) return zoom;
    if (showSearchRadius) return getZoomForRadius(searchRadius);
    return 15;
  }, [zoom, showSearchRadius, searchRadius]);

  // Get user location - continuous update for marker, NOT for map center
  useEffect(() => {
    if (!showUserLocation || !navigator.geolocation) return;
    
    // Watch position for continuous updates
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Sua localização',
        });
      },
      (error) => console.error('Geolocation error:', error),
      { enableHighAccuracy: true, maximumAge: 5000 }
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
    
    // Pan to center
    if (map && center) {
      map.panTo({ lat: center.lat, lng: center.lng });
    } else if (map && userLocation) {
      map.panTo({ lat: userLocation.lat, lng: userLocation.lng });
    }
  }, [map, center, userLocation]);

  // Auto-follow logic based on mode
  useEffect(() => {
    if (!map) return;
    
    const targetCenter = center || userLocation;
    if (!targetCenter) return;
    
    // Only auto-center if:
    // - Mode is 'follow' or 'navigation'
    // - AND user is not currently interacting
    // - AND (in navigation mode: hasn't interacted, or mode is follow)
    const shouldAutoCenter = 
      (mode === 'follow' || (mode === 'navigation' && !isUserInteracting)) &&
      !isUserInteracting;
    
    if (shouldAutoCenter) {
      map.panTo({ lat: targetCenter.lat, lng: targetCenter.lng });
    }
    
    // Set initial center once in free mode
    if (mode === 'free' && !initialCenterSetRef.current && targetCenter) {
      map.panTo({ lat: targetCenter.lat, lng: targetCenter.lng });
      initialCenterSetRef.current = true;
    }
  }, [map, center, userLocation, mode, isUserInteracting]);

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

  const mapCenter = center 
    ? { lat: center.lat, lng: center.lng }
    : userLocation 
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : defaultCenter;

  // Determine if we should show recenter button
  const shouldShowRecenter = showRecenterButton && hasUserInteractedRef.current && isUserInteracting && mode !== 'follow';

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
