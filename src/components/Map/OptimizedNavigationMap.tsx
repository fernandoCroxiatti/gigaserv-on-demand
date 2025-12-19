import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Location } from '@/types/chamado';
import { Loader2, AlertCircle } from 'lucide-react';

interface OptimizedNavigationMapProps {
  providerLocation: Location | null;
  destination: Location;
  routePolyline?: string;
  className?: string;
  followProvider?: boolean;
  providerHeading?: number;
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
  gestureHandling: 'greedy',
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

/**
 * Decode Google Maps encoded polyline string to array of coordinates
 */
function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const poly: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return poly;
}

export function OptimizedNavigationMap({
  providerLocation,
  destination,
  routePolyline,
  className = '',
  followProvider = true,
  providerHeading = 0,
}: OptimizedNavigationMapProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Decode polyline only when it changes
  const decodedPath = useMemo(() => {
    if (!routePolyline) return [];
    try {
      return decodePolyline(routePolyline);
    } catch (err) {
      console.error('[Map] Error decoding polyline:', err);
      return [];
    }
  }, [routePolyline]);

  // Follow provider on map with smooth animation
  useEffect(() => {
    if (map && providerLocation && followProvider) {
      map.panTo({ lat: providerLocation.lat, lng: providerLocation.lng });
    }
  }, [map, providerLocation, followProvider]);

  // Auto-fit bounds when route is available
  useEffect(() => {
    if (map && decodedPath.length > 0 && providerLocation) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: providerLocation.lat, lng: providerLocation.lng });
      bounds.extend({ lat: destination.lat, lng: destination.lng });
      map.fitBounds(bounds, { top: 150, bottom: 300, left: 50, right: 50 });
    }
  }, [map, decodedPath.length > 0]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    map.setZoom(16);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center bg-secondary ${className}`}>
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="font-medium text-destructive">Erro ao carregar Google Maps</p>
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
        {/* Provider marker (navigation arrow) */}
        {providerLocation && (
          <Marker
            position={{ lat: providerLocation.lat, lng: providerLocation.lng }}
            icon={{
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 8,
              fillColor: '#2563EB',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
              rotation: providerHeading,
              anchor: new google.maps.Point(0, 2.5),
            }}
            zIndex={100}
          />
        )}

        {/* Route polyline (blue line like Google Maps) */}
        {decodedPath.length > 0 && (
          <Polyline
            path={decodedPath}
            options={{
              strokeColor: '#4285F4',
              strokeWeight: 6,
              strokeOpacity: 1,
              geodesic: true,
            }}
          />
        )}

        {/* Destination marker (red pin) */}
        <Marker
          position={{ lat: destination.lat, lng: destination.lng }}
          icon={{
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
            fillColor: '#EF4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 2,
            anchor: new google.maps.Point(12, 24),
          }}
          zIndex={90}
        />
      </GoogleMap>
    </div>
  );
}
