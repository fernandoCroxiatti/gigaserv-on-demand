import React, { useCallback, useState, useEffect, useRef } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Location } from '@/types/chamado';
import { Loader2, AlertCircle, Navigation2 } from 'lucide-react';

interface NavigationMapViewProps {
  providerLocation: Location | null;
  destination: Location;
  onRouteUpdate?: (duration: string, distance: string) => void;
  onError?: (error: string) => void;
  className?: string;
  followProvider?: boolean;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
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

export function NavigationMapView({
  providerLocation,
  destination,
  onRouteUpdate,
  onError,
  className = '',
  followProvider = true,
}: NavigationMapViewProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const lastRouteRequestRef = useRef<string>('');
  const routeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate route when provider location changes
  useEffect(() => {
    if (!isLoaded || !providerLocation || !destination) {
      return;
    }

    // Create a key to avoid redundant requests
    const requestKey = `${providerLocation.lat.toFixed(4)},${providerLocation.lng.toFixed(4)}`;
    
    // Skip if location hasn't changed significantly (within ~100m)
    if (requestKey === lastRouteRequestRef.current) {
      return;
    }

    const calculateRoute = async () => {
      try {
        const directionsService = new google.maps.DirectionsService();
        
        const result = await directionsService.route({
          origin: { lat: providerLocation.lat, lng: providerLocation.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: true,
        });

        setDirections(result);
        setRouteError(null);
        lastRouteRequestRef.current = requestKey;

        // Extract duration and distance
        const leg = result.routes[0]?.legs[0];
        if (leg && onRouteUpdate) {
          onRouteUpdate(
            leg.duration?.text || 'Calculando...',
            leg.distance?.text || 'Calculando...'
          );
        }

        console.log('[Navigation] Route calculated:', leg?.duration?.text, leg?.distance?.text);
      } catch (error) {
        console.error('[Navigation] Route error:', error);
        const errorMsg = 'Erro ao calcular rota';
        setRouteError(errorMsg);
        if (onError) onError(errorMsg);
      }
    };

    calculateRoute();
  }, [isLoaded, providerLocation, destination, onRouteUpdate, onError]);

  // Follow provider on map
  useEffect(() => {
    if (map && providerLocation && followProvider) {
      map.panTo({ lat: providerLocation.lat, lng: providerLocation.lng });
    }
  }, [map, providerLocation, followProvider]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    map.setZoom(16);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
    if (routeUpdateIntervalRef.current) {
      clearInterval(routeUpdateIntervalRef.current);
    }
  }, []);

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

  const mapCenter = providerLocation 
    ? { lat: providerLocation.lat, lng: providerLocation.lng }
    : { lat: destination.lat, lng: destination.lng };

  return (
    <div className={className}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={16}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {/* Provider marker (moving) */}
        {providerLocation && (
          <Marker
            position={{ lat: providerLocation.lat, lng: providerLocation.lng }}
            icon={{
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 8,
              fillColor: '#2563EB',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              rotation: 0,
            }}
            zIndex={100}
          />
        )}

        {/* Destination marker */}
        {!directions && (
          <Marker
            position={{ lat: destination.lat, lng: destination.lng }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: '#EF4444',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            }}
          />
        )}

        {/* Route */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: false,
              polylineOptions: {
                strokeColor: '#2563EB',
                strokeWeight: 6,
                strokeOpacity: 0.9,
              },
              markerOptions: {
                zIndex: 50,
              }
            }}
          />
        )}
      </GoogleMap>

      {/* Route error overlay */}
      {routeError && (
        <div className="absolute top-4 left-4 right-4 bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{routeError}</span>
        </div>
      )}
    </div>
  );
}
