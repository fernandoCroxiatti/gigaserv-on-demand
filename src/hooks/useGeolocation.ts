import { useState, useEffect, useCallback, useRef } from 'react';
import { Location } from '@/types/chamado';

interface GeolocationState {
  location: Location | null;
  loading: boolean;
  error: string | null;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unavailable';
}

interface UseGeolocationOptions {
  watch?: boolean;
  autoRequest?: boolean; // Default false - don't request automatically
}

export function useGeolocation(watchOrOptions: boolean | UseGeolocationOptions = false) {
  // Handle both old signature (boolean) and new signature (options object)
  const options: UseGeolocationOptions = typeof watchOrOptions === 'boolean' 
    ? { watch: watchOrOptions, autoRequest: false }
    : { watch: false, autoRequest: false, ...watchOrOptions };

  const { watch, autoRequest } = options;

  const [state, setState] = useState<GeolocationState>({
    location: null,
    loading: false,
    error: null,
    permissionStatus: 'prompt',
  });

  const watchIdRef = useRef<number | undefined>();
  const hasRequestedRef = useRef(false);

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
    
    setState(prev => ({
      ...prev,
      location: {
        lat: latitude,
        lng: longitude,
        address,
      },
      loading: false,
      error: null,
      permissionStatus: 'granted',
    }));
  }, [getAddressFromCoords]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Erro ao obter localização';
    let permissionStatus: GeolocationState['permissionStatus'] = state.permissionStatus;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Permissão de localização negada. Ative nas configurações do dispositivo.';
        permissionStatus = 'denied';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Localização indisponível. Verifique se o GPS está ativado.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Tempo esgotado ao obter localização. Tente novamente.';
        break;
    }
    
    setState(prev => ({
      ...prev,
      loading: false,
      error: errorMessage,
      permissionStatus,
    }));
  }, [state.permissionStatus]);

  // Request location - called explicitly by user action
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Geolocalização não suportada neste dispositivo.',
        permissionStatus: 'unavailable',
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    hasRequestedRef.current = true;

    navigator.geolocation.getCurrentPosition(updatePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });

    // Start watching if enabled
    if (watch && !watchIdRef.current) {
      watchIdRef.current = navigator.geolocation.watchPosition(updatePosition, handleError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      });
    }
  }, [watch, updatePosition, handleError]);

  // Refresh location (requires previous permission)
  const refresh = useCallback(() => {
    if (state.permissionStatus === 'granted' || hasRequestedRef.current) {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(updatePosition, handleError, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      }
    } else {
      requestLocation();
    }
  }, [state.permissionStatus, updatePosition, handleError, requestLocation]);

  // Check permission status on mount (non-blocking)
  useEffect(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        permissionStatus: 'unavailable',
        error: 'Geolocalização não suportada neste dispositivo.',
      }));
      return;
    }

    // Check permission status via Permissions API if available
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setState(prev => ({
          ...prev,
          permissionStatus: result.state as GeolocationState['permissionStatus'],
        }));

        // If already granted, we can request silently
        if (result.state === 'granted' && autoRequest) {
          requestLocation();
        }

        // Listen for permission changes
        result.onchange = () => {
          setState(prev => ({
            ...prev,
            permissionStatus: result.state as GeolocationState['permissionStatus'],
          }));
        };
      }).catch(() => {
        // Permissions API not supported for geolocation
        console.log('[useGeolocation] Cannot query permission status');
      });
    }
  }, [autoRequest, requestLocation]);

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== undefined) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = undefined;
      }
    };
  }, []);

  return { 
    ...state, 
    refresh,
    requestLocation,
    isGranted: state.permissionStatus === 'granted',
    isDenied: state.permissionStatus === 'denied',
    needsPermission: state.permissionStatus === 'prompt',
  };
}
