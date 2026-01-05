import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Location } from '@/types/chamado';
import { Loader2, AlertCircle, Navigation2 } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface OptimizedNavigationMapProps {
  providerLocation: Location | null;
  destination: Location;
  routePolyline?: string;
  className?: string;
  followProvider?: boolean;
  providerHeading?: number | null;
  /** Show re-center button when user interacts */
  showRecenterButton?: boolean;
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

// Night mode styles for Google Maps (Uber-like dark theme)
const nightModeStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4b6878' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64779e' }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4b6878' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#334e87' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#023e58' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#283d6a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#304a7d' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#98a5be' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1d2c4d' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2c6675' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#255763' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#b0d5ce' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#023e58' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry.fill',
    stylers: [{ color: '#283d6a' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#3a4762' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0e1626' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4e6d70' }],
  },
];

// Day mode styles (clean, minimal)
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
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
];

// Animation constants
const ROTATION_LERP_FACTOR = 0.12;
const POSITION_LERP_FACTOR = 0.15;

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
 * Linear interpolation
 */
function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
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

export function OptimizedNavigationMap({
  providerLocation,
  destination,
  routePolyline,
  className = '',
  followProvider = true,
  providerHeading = null,
  showRecenterButton = true,
}: OptimizedNavigationMapProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const userInteractionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  
  // Smooth rotation and position state
  const [smoothRotation, setSmoothRotation] = useState(0);
  const [smoothPosition, setSmoothPosition] = useState<{ lat: number; lng: number } | null>(null);
  
  // Refs for animation
  const lastLocationRef = useRef<Location | null>(null);
  const targetRotationRef = useRef(0);
  const currentRotationRef = useRef(0);
  const targetPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const currentPositionRef = useRef<{ lat: number; lng: number } | null>(null);
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

  // Get map options based on mode - FIXED: north always up, no rotation, no tilt
  const mapOptions = useMemo((): google.maps.MapOptions => ({
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    // Allow gestures but track interaction
    gestureHandling: 'greedy',
    styles: isNightTime() ? nightModeStyles : dayModeStyles,
    // FIXED: No tilt - flat map view for stability
    tilt: 0,
    // FIXED: North always up - no map rotation
    heading: 0,
    // Disable rotation gesture
    rotateControl: false,
  }), []);

  // Update targets when provider location/heading changes
  useEffect(() => {
    if (!providerLocation) return;
    
    // Set target position
    targetPositionRef.current = { lat: providerLocation.lat, lng: providerLocation.lng };
    
    // Initialize current position if needed
    if (!currentPositionRef.current) {
      currentPositionRef.current = { lat: providerLocation.lat, lng: providerLocation.lng };
      setSmoothPosition({ lat: providerLocation.lat, lng: providerLocation.lng });
    }
    
    // Calculate target rotation
    let newTargetRotation = targetRotationRef.current;
    
    // Priority 1: Use GPS heading if available
    if (providerHeading !== null && providerHeading !== undefined && !isNaN(providerHeading)) {
      newTargetRotation = providerHeading;
    }
    // Priority 2: Calculate from movement
    else if (lastLocationRef.current) {
      const distance = Math.sqrt(
        Math.pow(providerLocation.lat - lastLocationRef.current.lat, 2) +
        Math.pow(providerLocation.lng - lastLocationRef.current.lng, 2)
      );
      
      // Only update if moved significantly
      if (distance > 0.00003) { // ~3 meters
        newTargetRotation = calculateBearing(lastLocationRef.current, providerLocation);
      }
    }
    
    targetRotationRef.current = newTargetRotation;
    lastLocationRef.current = providerLocation;
  }, [providerLocation, providerHeading]);

  // Unified animation loop for all smooth transitions
  useEffect(() => {
    const animate = () => {
      let needsUpdate = false;
      
      // Smooth marker rotation
      const currentRot = currentRotationRef.current;
      const targetRot = targetRotationRef.current;
      const newRotation = lerpAngle(currentRot, targetRot, ROTATION_LERP_FACTOR);
      currentRotationRef.current = newRotation;
      
      if (Math.abs(newRotation - smoothRotation) > 0.3) {
        setSmoothRotation(newRotation);
        needsUpdate = true;
      }
      
      // Smooth position interpolation
      const currentPos = currentPositionRef.current;
      const targetPos = targetPositionRef.current;
      
      if (currentPos && targetPos) {
        const newLat = lerp(currentPos.lat, targetPos.lat, POSITION_LERP_FACTOR);
        const newLng = lerp(currentPos.lng, targetPos.lng, POSITION_LERP_FACTOR);
        
        const latDiff = Math.abs(newLat - currentPos.lat);
        const lngDiff = Math.abs(newLng - currentPos.lng);
        
        if (latDiff > 0.000001 || lngDiff > 0.000001) {
          currentPositionRef.current = { lat: newLat, lng: newLng };
          setSmoothPosition({ lat: newLat, lng: newLng });
          needsUpdate = true;
        }
      }
      
      // FIXED: No map rotation - marker rotates, map stays north-up
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [smoothRotation]);

  // Update map camera smoothly - FIXED: no rotation, just pan
  useEffect(() => {
    if (!map || !smoothPosition || isUserInteracting) return;
    
    if (followProvider) {
      // Smooth pan to position
      map.panTo(smoothPosition);
      
      // FIXED: Ensure heading stays at 0 (north up)
      const currentHeading = map.getHeading();
      if (currentHeading !== 0) {
        map.setHeading(0);
      }
      
      // FIXED: Ensure tilt stays at 0 (flat view)
      const currentTilt = map.getTilt();
      if (currentTilt !== 0) {
        map.setTilt(0);
      }
      
      // Set appropriate zoom for navigation (fixed level)
      const currentZoom = map.getZoom();
      if (currentZoom && currentZoom < 17) {
        map.setZoom(17);
      }
    }
  }, [map, smoothPosition, followProvider, isUserInteracting]);

  // Handle re-center button click
  const handleRecenter = useCallback(() => {
    setIsUserInteracting(false);
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
      userInteractionTimeoutRef.current = null;
    }
  }, []);

  /**
   * Map Load Handler with Interaction Tracking
   * 
   * NAVIGATION-SPECIFIC BEHAVIOR:
   * This component is used ONLY during active rides (in_service status).
   * It intentionally has an 8-second auto-return timer after user interaction.
   * This is the CORRECT behavior for navigation - matching Uber/Waze UX.
   * 
   * Why 8 seconds?
   * - Allows user to briefly explore the map
   * - Returns to following provider automatically for navigation continuity
   * - Essential for hands-free navigation during driving
   * 
   * This is DIFFERENT from RealMapView which has NO timer and requires explicit recenter.
   * Each component serves a different UX purpose:
   * - OptimizedNavigationMap: Active navigation with auto-return (driver focus)
   * - RealMapView: Free exploration with manual recenter (browsing focus)
   * - MapDestinationPicker: Isolated selection with no external interference
   */
  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    mapInstance.setZoom(followProvider ? 17 : 16);
    
    // Track user interaction with auto-return timer (navigation mode only)
    const startInteraction = () => {
      setIsUserInteracting(true);
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current);
      }
    };
    
    const endInteraction = () => {
      // Re-enable follow after 8 seconds of no interaction (navigation UX)
      userInteractionTimeoutRef.current = setTimeout(() => {
        setIsUserInteracting(false);
      }, 8000);
    };
    
    mapInstance.addListener('dragstart', startInteraction);
    mapInstance.addListener('dragend', endInteraction);
    mapInstance.addListener('zoom_changed', startInteraction);
    
  }, [followProvider]);

  const onUnmount = useCallback(() => {
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }
    setMap(null);
  }, []);

  if (loadError) {
    return (
      <div className={cn("flex items-center justify-center bg-secondary", className)}>
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="font-medium text-destructive">Erro ao carregar Google Maps</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={cn("flex items-center justify-center bg-secondary", className)}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  const mapCenter = smoothPosition || (providerLocation 
    ? { lat: providerLocation.lat, lng: providerLocation.lng }
    : { lat: destination.lat, lng: destination.lng });

  return (
    <div className={cn("relative", className)}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={17}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {/* Provider marker with smooth rotation */}
        {smoothPosition && (
          <Marker
            position={smoothPosition}
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

        {/* Destination marker */}
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

      {/* Re-center button - shows when user has interacted */}
      {showRecenterButton && isUserInteracting && followProvider && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRecenter}
          className="absolute bottom-24 right-3 rounded-full shadow-lg bg-card/95 backdrop-blur-md"
        >
          <Navigation2 className="w-4 h-4 mr-1.5" />
          Centralizar
        </Button>
      )}
    </div>
  );
}
