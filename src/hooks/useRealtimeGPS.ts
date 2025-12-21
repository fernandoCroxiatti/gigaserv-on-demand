import { useState, useEffect, useCallback, useRef } from 'react';
import { Location } from '@/types/chamado';
import { toast } from 'sonner';

interface GPSState {
  location: Location | null;
  loading: boolean;
  error: string | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  isApproximate: boolean;
}

interface UseRealtimeGPSOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  onLocationUpdate?: (location: Location) => void;
  /** Enable smooth position interpolation for animation */
  enableSmoothing?: boolean;
}

// Minimum distance (meters) to trigger geocoding update
const MIN_DISTANCE_FOR_GEOCODE = 100;
// Minimum time (ms) between geocode calls
const GEOCODE_THROTTLE_MS = 30000;
// GPS fix timeout (15 seconds)
const GPS_FIX_TIMEOUT_MS = 15000;
// LocalStorage key for last known location
const LAST_KNOWN_LOCATION_KEY = 'giga_sos_last_gps_location';
// Position smoothing factor (0-1, higher = faster transition)
const POSITION_SMOOTH_FACTOR = 0.3;
// Minimum speed (m/s) to consider moving (filters GPS noise)
const MIN_MOVEMENT_SPEED = 1.0; // ~3.6 km/h
// Maximum accuracy to accept (meters)
const MAX_ACCEPTABLE_ACCURACY = 50;

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

/**
 * Calculate bearing between two points in degrees
 */
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Linear interpolation
 */
function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

export function useRealtimeGPS(options: UseRealtimeGPSOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    onLocationUpdate,
    enableSmoothing = true,
  } = options;

  const [state, setState] = useState<GPSState>({
    location: null,
    loading: true,
    error: null,
    accuracy: null,
    heading: null,
    speed: null,
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
  // Device compass heading
  const deviceHeadingRef = useRef<number | null>(null);
  // Previous position for heading calculation and smoothing
  const prevPositionRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  // Smoothed position
  const smoothedPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  // Animation frame for smoothing
  const animationFrameRef = useRef<number | null>(null);
  // Target position for smoothing
  const targetPositionRef = useRef<{ lat: number; lng: number } | null>(null);

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
      
      return address;
    } catch (error) {
      console.error('[GPS] Geocoding error:', error);
      const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      lastGeocodeRef.current = { lat, lng, time: Date.now(), address: fallbackAddress };
      return fallbackAddress;
    }
  }, []);

  /**
   * Position smoothing animation loop for fluid map movement
   */
  useEffect(() => {
    if (!enableSmoothing) return;

    const animate = () => {
      const target = targetPositionRef.current;
      const current = smoothedPositionRef.current;

      if (target && current) {
        const newLat = lerp(current.lat, target.lat, POSITION_SMOOTH_FACTOR);
        const newLng = lerp(current.lng, target.lng, POSITION_SMOOTH_FACTOR);
        
        // Check if close enough to target
        const distance = calculateDistance(newLat, newLng, target.lat, target.lng);
        
        if (distance > 0.5) { // More than 0.5 meter difference
          smoothedPositionRef.current = { lat: newLat, lng: newLng };
        } else {
          smoothedPositionRef.current = { ...target };
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enableSmoothing]);

  const handleSuccess = useCallback(async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, heading: gpsHeading, speed: gpsSpeed } = position.coords;
    
    // Filter out inaccurate readings
    if (accuracy > MAX_ACCEPTABLE_ACCURACY && hasRealFixRef.current) {
      console.log('[GPS] Ignoring inaccurate reading:', accuracy, 'm');
      return;
    }
    
    // Mark that we got a real GPS fix
    hasRealFixRef.current = true;
    
    // Clear timeout since we got a fix
    if (gpsTimeoutRef.current) {
      clearTimeout(gpsTimeoutRef.current);
      gpsTimeoutRef.current = null;
    }

    // Calculate movement-based heading if GPS heading not available
    let calculatedHeading = gpsHeading;
    const now = Date.now();
    
    if (prevPositionRef.current) {
      const distance = calculateDistance(
        prevPositionRef.current.lat,
        prevPositionRef.current.lng,
        latitude,
        longitude
      );
      const timeDiff = (now - prevPositionRef.current.time) / 1000; // seconds
      const calculatedSpeed = timeDiff > 0 ? distance / timeDiff : 0;
      
      // Only calculate heading from movement if actually moving
      if (distance > 3 && calculatedSpeed > MIN_MOVEMENT_SPEED) {
        calculatedHeading = calculateBearing(
          prevPositionRef.current.lat,
          prevPositionRef.current.lng,
          latitude,
          longitude
        );
      }
    }

    // Update previous position
    prevPositionRef.current = { lat: latitude, lng: longitude, time: now };
    
    // Update target for smoothing
    targetPositionRef.current = { lat: latitude, lng: longitude };
    
    // Initialize smoothed position if needed
    if (!smoothedPositionRef.current) {
      smoothedPositionRef.current = { lat: latitude, lng: longitude };
    }
    
    // Get address with throttling
    const address = await getAddressFromCoords(latitude, longitude);
    
    const newLocation: Location = {
      lat: latitude,
      lng: longitude,
      address,
    };

    // Save as last known location for future fallback
    saveLastKnownLocation(newLocation);

    // Use device compass heading as fallback
    const finalHeading = calculatedHeading !== null && !isNaN(calculatedHeading) 
      ? calculatedHeading 
      : deviceHeadingRef.current;

    setState({
      location: newLocation,
      loading: false,
      error: null,
      accuracy,
      heading: finalHeading,
      speed: gpsSpeed ?? null,
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
        speed: null,
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

    // Start continuous tracking with watchPosition - OPTIMIZED for WebView/Capacitor
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy, // Always true for navigation
        timeout,
        maximumAge, // Allow some caching for battery optimization
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
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  /**
   * Request wake lock to keep screen on during navigation (WebView optimization)
   */
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('[GPS] Wake lock acquired');
        }
      } catch (err) {
        console.log('[GPS] Wake lock not available:', err);
      }
    };

    // Request wake lock when tracking starts
    requestWakeLock();

    // Re-acquire wake lock when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLock) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock) {
        wakeLock.release();
        console.log('[GPS] Wake lock released');
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Auto-start tracking on mount + device orientation for compass
  useEffect(() => {
    startTracking();
    
    // Device orientation for compass heading (iOS and Android)
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // webkitCompassHeading for iOS, alpha for Android (needs adjustment)
      const compassHeading = (event as any).webkitCompassHeading ?? 
        (event.alpha !== null ? (360 - event.alpha) : null);
      
      if (compassHeading !== null && !isNaN(compassHeading)) {
        deviceHeadingRef.current = compassHeading;
        // Update state with new heading if we have location
        setState(prev => {
          if (prev.location && prev.heading !== compassHeading) {
            return { ...prev, heading: compassHeading };
          }
          return prev;
        });
      }
    };
    
    // Request permission for iOS 13+
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permission: string) => {
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        })
        .catch(console.error);
    } else {
      // Android and non-iOS 13+
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      stopTracking();
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [startTracking, stopTracking]);

  return {
    ...state,
    startTracking,
    stopTracking,
    isTracking: watchIdRef.current !== null,
    /** Smoothed position for fluid animation (if enableSmoothing is true) */
    smoothedLocation: smoothedPositionRef.current,
  };
}

export type { GPSState };
