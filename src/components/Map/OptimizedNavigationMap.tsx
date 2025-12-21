import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
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
  providerHeading?: number | null;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// Check if it's night time (between 18:00 and 06:00)
function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

// Night mode styles for Google Maps
const nightModeStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#263c3f' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#746855' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2835' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3d19c' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515c6d' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#17263c' }],
  },
];

// Day mode styles (minimal, clean)
const dayModeStyles: google.maps.MapTypeStyle[] = [
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
];

// Get map options based on time of day and mode
function getMapOptions(followMode: boolean = false): google.maps.MapOptions {
  return {
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    // In follow mode, limit gestures to allow map to follow user
    gestureHandling: followMode ? 'none' : 'greedy',
    styles: isNightTime() ? nightModeStyles : dayModeStyles,
    // Enable tilt for navigation view
    tilt: followMode ? 45 : 0,
  };
}

/**
 * Calculate bearing between two points in degrees
 */
function calculateBearing(from: Location, to: Location): number {
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const dLng = (to.lng - from.lng) * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Smoothly interpolate between two angles (handles 0/360 wraparound)
 */
function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  
  // Handle wraparound
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  return (from + diff * t + 360) % 360;
}

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

// Animation constants
const ROTATION_LERP_FACTOR = 0.15; // Smooth factor (0-1, lower = smoother)
const ANIMATION_FRAME_RATE = 60; // fps

export function OptimizedNavigationMap({
  providerLocation,
  destination,
  routePolyline,
  className = '',
  followProvider = true,
  providerHeading = null,
}: OptimizedNavigationMapProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const userInteractionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  
  // Smooth rotation state
  const [smoothRotation, setSmoothRotation] = useState(0);
  const lastLocationRef = useRef<Location | null>(null);
  const targetRotationRef = useRef(0);
  const currentRotationRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

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

  // Calculate target rotation based on GPS heading or movement direction
  useEffect(() => {
    if (!providerLocation) return;
    
    let newTargetRotation = targetRotationRef.current;
    
    // Priority 1: Use GPS heading if available and valid
    if (providerHeading !== null && providerHeading !== undefined && !isNaN(providerHeading)) {
      newTargetRotation = providerHeading;
    }
    // Priority 2: Calculate from movement if we have previous position
    else if (lastLocationRef.current) {
      const distance = Math.sqrt(
        Math.pow(providerLocation.lat - lastLocationRef.current.lat, 2) +
        Math.pow(providerLocation.lng - lastLocationRef.current.lng, 2)
      );
      
      // Only update if moved significantly (avoid jitter when stationary)
      if (distance > 0.00005) { // ~5 meters
        newTargetRotation = calculateBearing(lastLocationRef.current, providerLocation);
      }
    }
    
    targetRotationRef.current = newTargetRotation;
    lastLocationRef.current = providerLocation;
  }, [providerLocation, providerHeading]);

  // Smooth animation loop for rotation
  useEffect(() => {
    const animate = () => {
      const current = currentRotationRef.current;
      const target = targetRotationRef.current;
      
      // Smoothly interpolate towards target
      const newRotation = lerpAngle(current, target, ROTATION_LERP_FACTOR);
      currentRotationRef.current = newRotation;
      
      // Only update state if rotation changed significantly (avoid unnecessary re-renders)
      if (Math.abs(newRotation - smoothRotation) > 0.5) {
        setSmoothRotation(newRotation);
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [smoothRotation]);

  // Follow provider on map with smooth animation and heading rotation (Uber/Google Maps style)
  useEffect(() => {
    if (map && providerLocation && followProvider && !isUserInteracting) {
      // Smooth pan to provider location
      map.panTo({ lat: providerLocation.lat, lng: providerLocation.lng });
      
      // Rotate map to match heading (navigation mode)
      const currentHeading = smoothRotation;
      if (currentHeading !== undefined && !isNaN(currentHeading)) {
        // Invert heading so map rotates to show road ahead
        map.setHeading(currentHeading);
      }
      
      // Set navigation-style zoom
      const currentZoom = map.getZoom();
      if (currentZoom && currentZoom < 17) {
        map.setZoom(17);
      }
    }
  }, [map, providerLocation, followProvider, smoothRotation, isUserInteracting]);

  // Auto-fit bounds when route is available
  useEffect(() => {
    if (map && decodedPath.length > 0 && providerLocation) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: providerLocation.lat, lng: providerLocation.lng });
      bounds.extend({ lat: destination.lat, lng: destination.lng });
      map.fitBounds(bounds, { top: 150, bottom: 300, left: 50, right: 50 });
    }
  }, [map, decodedPath.length > 0]);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    mapInstance.setZoom(followProvider ? 17 : 16);
    
    // Add drag listeners to detect user interaction
    if (followProvider) {
      mapInstance.addListener('dragstart', () => {
        setIsUserInteracting(true);
        if (userInteractionTimeoutRef.current) {
          clearTimeout(userInteractionTimeoutRef.current);
        }
      });
      
      mapInstance.addListener('dragend', () => {
        // Re-enable follow after 5 seconds of no interaction
        userInteractionTimeoutRef.current = setTimeout(() => {
          setIsUserInteracting(false);
        }, 5000);
      });
    }
  }, [followProvider]);

  const onUnmount = useCallback(() => {
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }
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
        options={getMapOptions(followProvider)}
      >
        {/* Provider marker (navigation arrow with smooth rotation) */}
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
              rotation: smoothRotation,
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
