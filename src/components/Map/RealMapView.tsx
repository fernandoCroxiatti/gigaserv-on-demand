import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, Marker, DirectionsRenderer, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Location, ServiceType } from '@/types/chamado';
import { Loader2, AlertCircle, Navigation2, MapPin } from 'lucide-react';
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

  // Track if user has manually dragged the map
  const hasUserDraggedRef = useRef(false);
  
  /**
   * GPS Location - SINGLE getCurrentPosition on mount ONLY
   * 
   * - Uses getCurrentPosition ONCE on initial load
   * - NO watchPosition - map never moves automatically after load
   * - User must click "Minha Localização" button to recenter
   * - After user drags, map NEVER auto-centers
   */
  useEffect(() => {
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

  // Handle user interaction - sets map to free mode permanently
  // Once user drags, map NEVER auto-centers again
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
      },
      (error) => console.error('Geolocation error:', error),
      { 
        enableHighAccuracy: false, 
        maximumAge: 30000, 
        timeout: 10000 
      }
    );
  }, [map]);

  // Legacy recenter handler - now uses handleMyLocation
  const handleRecenter = useCallback(() => {
    handleMyLocation();
  }, [handleMyLocation]);

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
   */
  useEffect(() => {
    if (!map) return;
    
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
  }, [map, center, userLocation]);

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

  // Show "Minha Localização" button only if geolocation is supported and user has interacted
  const shouldShowMyLocation = showRecenterButton && navigator.geolocation && hasUserDraggedRef.current;

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
      
      {/* "Minha Localização" floating button - bottom right, visible after user drags */}
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
    </div>
  );
}
