import { useState, useEffect, useCallback, useRef } from 'react';
import { Location } from '@/types/chamado';
import { toast } from 'sonner';

interface GPSState {
  location: Location | null;
  loading: boolean;
  error: string | null;
  accuracy: number | null;
  heading: number | null;
  isApproximate: boolean; // Indicates if using fallback location
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
// GPS fix timeout (15 seconds as requested)
const GPS_FIX_TIMEOUT_MS = 15000;
// LocalStorage key for last known location
const LAST_KNOWN_LOCATION_KEY = 'giga_sos_last_gps_location';

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
    isApproximate: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const onLocationUpdateRef = useRef(onLocationUpdate);
  // Throttling refs for geocoding
  const lastGeocodeRef = useRef<{ lat: number; lng: number; time: number; address: string } | null>(null);
  // Timeout ref for GPS fix
  const gpsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track if we got a real fix
  const hasRealFixRef = useRef<boolean>(false);

  /**
   * Save location to localStorage as fallback
   */
  const saveLastKnownLocation = useCallback((location: Location) => {
    try {
      localStorage.setItem(LAST_KNOWN_LOCATION_KEY, JSON.stringify({
        ...location,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn('[GPS] Failed to save last known location');
    }
  }, []);

  /**
   * Get last known location from localStorage
   */
  const getLastKnownLocation = useCallback((): Location | null => {
    try {
      const stored = localStorage.getItem(LAST_KNOWN_LOCATION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only use if less than 24 hours old
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return { lat: parsed.lat, lng: parsed.lng, address: parsed.address };
        }
      }
    } catch (e) {
      console.warn('[GPS] Failed to get last known location');
    }
    return null;
  }, []);

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
    
    // Mark that we got a real GPS fix
    hasRealFixRef.current = true;
    
    // Clear timeout since we got a fix
    if (gpsTimeoutRef.current) {
      clearTimeout(gpsTimeoutRef.current);
      gpsTimeoutRef.current = null;
    }
    
    // Get address with throttling (won't spam API)
    const address = await getAddressFromCoords(latitude, longitude);
    
    const newLocation: Location = {
      lat: latitude,
      lng: longitude,
      address,
    };

    // Save as last known location for future fallback
    saveLastKnownLocation(newLocation);

    setState({
      location: newLocation,
      loading: false,
      error: null,
      accuracy,
      heading: heading || null,
      isApproximate: false,
    });

    // Trigger callback for external updates (DB sync)
    if (onLocationUpdateRef.current) {
      onLocationUpdateRef.current(newLocation);
    }
  }, [getAddressFromCoords, saveLastKnownLocation]);

  /**
   * Use last known location as fallback after GPS timeout
   */
  const useApproximateLocation = useCallback(() => {
    const lastKnown = getLastKnownLocation();
    if (lastKnown) {
      console.log('[GPS] Using approximate location (GPS timeout, using last known)');
      setState(prev => ({
        ...prev,
        location: lastKnown,
        loading: false,
        error: null,
        isApproximate: true,
      }));
      
      // Still trigger callback but with approximate location
      if (onLocationUpdateRef.current) {
        onLocationUpdateRef.current(lastKnown);
      }
      return true;
    }
    return false;
  }, [getLastKnownLocation]);

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
        // Try fallback to last known location
        if (useApproximateLocation()) {
          return; // Don't set error if we have fallback
        }
        break;
      case error.TIMEOUT:
        // Try fallback to last known location
        if (useApproximateLocation()) {
          console.log('[GPS] Timeout - using approximate location');
          return; // Don't set error if we have fallback
        }
        errorMessage = 'Tempo esgotado ao obter localização.';
        break;
    }
    
    setState(prev => ({
      ...prev,
      loading: false,
      error: errorMessage,
      isApproximate: false,
    }));
  }, [useApproximateLocation]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        location: null,
        loading: false,
        error: 'Geolocalização não suportada neste navegador.',
        accuracy: null,
        heading: null,
        isApproximate: false,
      });
      return;
    }

    hasRealFixRef.current = false;
    setState(prev => ({ ...prev, loading: true, error: null, isApproximate: false }));

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    
    // Clear existing timeout
    if (gpsTimeoutRef.current) {
      clearTimeout(gpsTimeoutRef.current);
    }

    // Set 15-second timeout for GPS fix
    gpsTimeoutRef.current = setTimeout(() => {
      if (!hasRealFixRef.current) {
        console.log('[GPS] 15s timeout reached, attempting fallback...');
        useApproximateLocation();
      }
    }, GPS_FIX_TIMEOUT_MS);

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
  }, [enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError, useApproximateLocation]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      console.log('[GPS] Stopped tracking, cleared watchId:', watchIdRef.current);
      watchIdRef.current = null;
    }
    if (gpsTimeoutRef.current) {
      clearTimeout(gpsTimeoutRef.current);
      gpsTimeoutRef.current = null;
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

export type { GPSState };
