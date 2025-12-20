import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { GoogleMap, Marker, DirectionsRenderer, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Location, ServiceType } from '@/types/chamado';
import { Loader2, AlertCircle } from 'lucide-react';
import { ProviderMarkers } from './ProviderMarkers';

export interface MapProvider {
  id: string;
  location: Location;
  name: string;
  services?: ServiceType[];
  distance?: number;
}

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
// Uses logarithmic scale for smooth transitions across the 5-100km range
function getZoomForRadius(radiusKm: number): number {
  // Zoom levels calibrated to frame the full circle diameter on screen
  // At equator: zoom 15 ≈ 1.5km view, each zoom level doubles the view area
  if (radiusKm <= 5) return 12;      // ~5km radius fits well at zoom 12
  if (radiusKm <= 10) return 11;     // ~10km radius
  if (radiusKm <= 15) return 10.5;   // ~15km radius
  if (radiusKm <= 20) return 10;     // ~20km radius
  if (radiusKm <= 30) return 9.5;    // ~30km radius
  if (radiusKm <= 40) return 9;      // ~40km radius
  if (radiusKm <= 50) return 8.5;    // ~50km radius
  if (radiusKm <= 70) return 8;      // ~70km radius
  if (radiusKm <= 100) return 7.5;   // ~100km radius
  return 7;                          // >100km
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
}: RealMapViewProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [userLocation, setUserLocation] = useState<Location | null>(null);

  // Calculate dynamic zoom based on search radius
  const effectiveZoom = useMemo(() => {
    if (zoom !== undefined) return zoom;
    if (showSearchRadius) return getZoomForRadius(searchRadius);
    return 15;
  }, [zoom, showSearchRadius, searchRadius]);

  // Get user location
  useEffect(() => {
    if (showUserLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: 'Sua localização',
          });
        },
        (error) => console.error('Geolocation error:', error)
      );
    }
  }, [showUserLocation]);

  // Calculate route
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

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

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

  return (
    <div className={className}>
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
            radius={searchRadius * 1000} // Convert km to meters (accurate conversion)
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

        {/* User location marker */}
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
    </div>
  );
}
