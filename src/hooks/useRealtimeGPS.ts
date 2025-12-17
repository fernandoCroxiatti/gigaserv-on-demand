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

  // Keep callback ref updated
  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  const getAddressFromCoords = useCallback(async (lat: number, lng: number): Promise<string> => {
    if (!window.google?.maps) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      
      if (response.results[0]) {
        return response.results[0].formatted_address;
      }
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.error('Geocoding error:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }, []);

  const handleSuccess = useCallback(async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, heading } = position.coords;
    
    // Only geocode occasionally to avoid API spam
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

    // Trigger callback for external updates
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
