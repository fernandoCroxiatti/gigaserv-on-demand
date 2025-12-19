import { useState, useEffect, useCallback, useRef } from 'react';
import { Location } from '@/types/chamado';
import { toast } from 'sonner';

interface GPSState {
  location: Location | null;
  loading: boolean;
  error: string | null;
  accuracy: number | null;
  heading: number | null;
}

interface UseRealtimeGPSOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  onLocationUpdate?: (location: Location) => void;
}

// Minimum distance (meters) to trigger geocoding update
const MIN_DISTANCE_FOR_GEOCODE = 100;
// Minimum time (ms) between geocode calls
const GEOCODE_THROTTLE_MS = 30000;

/**
 * Calculate distance between two points in meters (Haversine formula)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function useRealtimeGPS(options: UseRealtimeGPSOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    onLocationUpdate,
  } = options;

  const [state, setState] = useState<GPSState>({
    location: null,
    loading: true,
    error: null,
    accuracy: null,
    heading: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const onLocationUpdateRef = useRef(onLocationUpdate);
  // Throttling refs for geocoding
  const lastGeocodeRef = useRef<{ lat: number; lng: number; time: number; address: string } | null>(null);

  // Keep callback ref updated
  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  /**
   * OPTIMIZED: Only geocode when position changes significantly OR after throttle period
   * This prevents excessive API calls (was calling on every GPS update!)
   */
  const getAddressFromCoords = useCallback(async (lat: number, lng: number): Promise<string> => {
    // Check if we should skip geocoding (throttle)
    if (lastGeocodeRef.current) {
      const timeSinceLastGeocode = Date.now() - lastGeocodeRef.current.time;
      const distance = calculateDistance(
        lastGeocodeRef.current.lat,
        lastGeocodeRef.current.lng,
        lat,
        lng
      );

      // Skip if not enough time passed AND not enough distance traveled
      if (timeSinceLastGeocode < GEOCODE_THROTTLE_MS && distance < MIN_DISTANCE_FOR_GEOCODE) {
        return lastGeocodeRef.current.address;
      }
    }

    // Check if Google Maps is available
    if (!window.google?.maps) {
      const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      lastGeocodeRef.current = { lat, lng, time: Date.now(), address: fallbackAddress };
      return fallbackAddress;
    }

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      
      const address = response.results[0]?.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
      // Cache the result
      lastGeocodeRef.current = { lat, lng, time: Date.now(), address };
      console.log('[GPS] Geocoded new address:', address.substring(0, 50) + '...');
      
      return address;
    } catch (error) {
      console.error('[GPS] Geocoding error:', error);
      const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      lastGeocodeRef.current = { lat, lng, time: Date.now(), address: fallbackAddress };
      return fallbackAddress;
    }
  }, []);

  const handleSuccess = useCallback(async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, heading } = position.coords;
    
    // Get address with throttling (won't spam API)
    const address = await getAddressFromCoords(latitude, longitude);
    
    const newLocation: Location = {
      lat: latitude,
      lng: longitude,
      address,
    };

    setState({
      location: newLocation,
      loading: false,
      error: null,
      accuracy,
      heading: heading || null,
    });

    // Trigger callback for external updates (DB sync)
    if (onLocationUpdateRef.current) {
      onLocationUpdateRef.current(newLocation);
    }
  }, [getAddressFromCoords]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Erro ao obter localização';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Permissão de localização negada. Ative nas configurações do navegador.';
        toast.error('GPS Necessário', {
          description: 'Ative a localização para usar a navegação.',
        });
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Localização indisponível. Verifique seu GPS.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Tempo esgotado ao obter localização.';
        break;
    }
    
    setState(prev => ({
      ...prev,
      loading: false,
      error: errorMessage,
    }));
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        location: null,
        loading: false,
        error: 'Geolocalização não suportada neste navegador.',
        accuracy: null,
        heading: null,
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    // Start continuous tracking with watchPosition
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );

    console.log('[GPS] Started real-time tracking, watchId:', watchIdRef.current);
  }, [enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      console.log('[GPS] Stopped tracking, cleared watchId:', watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Auto-start tracking on mount
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  return {
    ...state,
    startTracking,
    stopTracking,
    isTracking: watchIdRef.current !== null,
  };
}
