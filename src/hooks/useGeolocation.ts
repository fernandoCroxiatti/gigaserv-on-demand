import { useState, useEffect, useCallback } from 'react';
import { Location } from '@/types/chamado';

interface GeolocationState {
  location: Location | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation(watch: boolean = false) {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    loading: true,
    error: null,
  });

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

  const updatePosition = useCallback(async (position: GeolocationPosition) => {
    const { latitude, longitude } = position.coords;
    const address = await getAddressFromCoords(latitude, longitude);
    
    setState({
      location: {
        lat: latitude,
        lng: longitude,
        address,
      },
      loading: false,
      error: null,
    });
  }, [getAddressFromCoords]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Erro ao obter localização';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Permissão de localização negada. Ative nas configurações do navegador.';
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

  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Geolocalização não suportada neste navegador.',
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(updatePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  }, [updatePosition, handleError]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({
        location: null,
        loading: false,
        error: 'Geolocalização não suportada neste navegador.',
      });
      return;
    }

    // Initial position
    navigator.geolocation.getCurrentPosition(updatePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });

    // Watch position if enabled
    let watchId: number | undefined;
    if (watch) {
      watchId = navigator.geolocation.watchPosition(updatePosition, handleError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      });
    }

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watch, updatePosition, handleError]);

  return { ...state, refresh };
}
