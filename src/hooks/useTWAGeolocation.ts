import { useState, useEffect, useCallback, useRef } from 'react';
import { Location } from '@/types/chamado';

/**
 * TWA-OPTIMIZED GEOLOCATION HOOK
 * 
 * Designed for Trusted Web Activity (PWA in Chrome) environment.
 * Uses exclusively Web Geolocation API for maximum compatibility.
 * 
 * Key behaviors:
 * 1. Fast first fix with low accuracy (enableHighAccuracy: false)
 * 2. Parallel refinement with high accuracy watch
 * 3. Never blocks UI - app is always usable
 * 4. Once "ready", never goes back to "locating" automatically
 */

export type TWAGpsStatus = 'idle' | 'locating' | 'ready' | 'refining' | 'error';

interface TWAGeolocationState {
  location: Location | null;
  status: TWAGpsStatus;
  error: string | null;
  accuracy: number | null;
  isPermissionDenied: boolean;
}

interface UseTWAGeolocationOptions {
  /** Start locating immediately on mount */
  autoStart?: boolean;
  /** Timeout for first getCurrentPosition (ms) */
  timeout?: number;
  /** Max age for cached position (ms) */
  maxAge?: number;
}

const DEFAULT_TIMEOUT = 8000; // 8 seconds for first fix
const DEFAULT_MAX_AGE = 60000; // Accept 1 minute old cache for first fix
const REFINE_MAX_AGE = 0; // No cache for refinement

export function useTWAGeolocation(options: UseTWAGeolocationOptions = {}) {
  const {
    autoStart = true,
    timeout = DEFAULT_TIMEOUT,
    maxAge = DEFAULT_MAX_AGE,
  } = options;

  const [state, setState] = useState<TWAGeolocationState>({
    location: null,
    status: 'idle',
    error: null,
    accuracy: null,
    isPermissionDenied: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const hasReachedReadyRef = useRef(false);
  const geocodeThrottleRef = useRef<number>(0);

  // Geocode coordinates to address (throttled)
  const getAddressFromCoords = useCallback(async (lat: number, lng: number): Promise<string> => {
    // Throttle geocoding to max 1 request per 2 seconds
    const now = Date.now();
    if (now - geocodeThrottleRef.current < 2000) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
    geocodeThrottleRef.current = now;

    if (!window.google?.maps) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      if (response.results[0]) {
        return response.results[0].formatted_address;
      }
    } catch (error) {
      console.warn('[TWAGeo] Geocoding error:', error);
    }
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }, []);

  // Update location state
  const updateLocation = useCallback(async (position: GeolocationPosition, isRefinement = false) => {
    if (!isMountedRef.current) return;

    const { latitude: lat, longitude: lng, accuracy } = position.coords;
    const address = await getAddressFromCoords(lat, lng);

    if (!isMountedRef.current) return;

    // Once ready, stay ready (only change to refining/ready, never back to locating)
    const newStatus: TWAGpsStatus = hasReachedReadyRef.current
      ? (isRefinement ? 'refining' : 'ready')
      : 'ready';

    if (!hasReachedReadyRef.current) {
      hasReachedReadyRef.current = true;
      console.log('[TWAGeo] First valid position received, status -> ready');
    }

    setState(prev => ({
      ...prev,
      location: { lat, lng, address },
      status: newStatus,
      accuracy: accuracy ?? null,
      error: null,
      isPermissionDenied: false,
    }));
  }, [getAddressFromCoords]);

  // Handle geolocation errors (non-blocking)
  const handleError = useCallback((error: GeolocationPositionError) => {
    if (!isMountedRef.current) return;

    console.warn('[TWAGeo] Error:', error.code, error.message);

    let errorMessage = 'Erro ao obter localização';
    let isPermissionDenied = false;

    switch (error.code) {
      case 1: // PERMISSION_DENIED
        errorMessage = 'Permissão de localização negada';
        isPermissionDenied = true;
        break;
      case 2: // POSITION_UNAVAILABLE
        errorMessage = 'GPS indisponível';
        break;
      case 3: // TIMEOUT
        errorMessage = 'Tempo esgotado';
        break;
    }

    // If already ready, don't change status to error - just log
    if (hasReachedReadyRef.current) {
      console.log('[TWAGeo] Error during refinement, keeping ready status');
      return;
    }

    setState(prev => ({
      ...prev,
      status: 'error',
      error: errorMessage,
      isPermissionDenied,
    }));
  }, []);

  // Start background watch for continuous refinement
  const startRefinementWatch = useCallback(() => {
    if (watchIdRef.current !== null) return; // Already watching
    if (!navigator.geolocation) return;

    console.log('[TWAGeo] Starting refinement watch');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        console.log('[TWAGeo] Refinement update, accuracy:', position.coords.accuracy);
        updateLocation(position, true);
      },
      (error) => {
        // Non-blocking: just log, don't change status
        console.warn('[TWAGeo] Watch error (ignored):', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: REFINE_MAX_AGE,
      }
    );
  }, [updateLocation]);

  // Stop watching
  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      console.log('[TWAGeo] Watch stopped');
    }
  }, []);

  // Main start function - gets first position quickly, then refines
  const startLocating = useCallback(async () => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'Geolocalização não suportada',
      }));
      return;
    }

    // If already ready, just start refinement (don't go back to locating)
    if (hasReachedReadyRef.current) {
      startRefinementWatch();
      return;
    }

    setState(prev => ({ ...prev, status: 'locating', error: null }));
    console.log('[TWAGeo] Starting location acquisition');

    // Step 1: Fast getCurrentPosition (low accuracy, accepts cache)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, // Faster first fix
          timeout,
          maximumAge: maxAge, // Accept slightly old position for speed
        });
      });

      await updateLocation(position, false);
      console.log('[TWAGeo] Fast first fix successful');
    } catch (error) {
      console.warn('[TWAGeo] Fast fix failed, trying high accuracy...');

      // Step 2: Retry with high accuracy if fast fix failed
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: timeout + 4000, // Give extra time for high accuracy
            maximumAge: 0,
          });
        });

        await updateLocation(position, false);
        console.log('[TWAGeo] High accuracy fix successful');
      } catch (retryError) {
        handleError(retryError as GeolocationPositionError);
      }
    }

    // Step 3: Start refinement watch in parallel regardless of success
    startRefinementWatch();
  }, [timeout, maxAge, updateLocation, handleError, startRefinementWatch]);

  // Manual refresh (only refines, never goes back to locating if already ready)
  const refresh = useCallback(async () => {
    if (!navigator.geolocation) return;

    console.log('[TWAGeo] Manual refresh requested');

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      await updateLocation(position, hasReachedReadyRef.current);
    } catch (error) {
      console.warn('[TWAGeo] Refresh failed:', error);
      // Don't update state - keep last known position
    }
  }, [updateLocation]);

  // Auto-start on mount
  useEffect(() => {
    isMountedRef.current = true;

    if (autoStart) {
      startLocating();
    }

    return () => {
      isMountedRef.current = false;
      stopWatch();
    };
  }, [autoStart, startLocating, stopWatch]);

  return {
    ...state,
    startLocating,
    refresh,
    stopWatch,
    isReady: state.status === 'ready' || state.status === 'refining',
    isLocating: state.status === 'locating',
    hasLocation: state.location !== null,
  };
}
