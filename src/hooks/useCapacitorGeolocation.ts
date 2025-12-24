import { useState, useEffect, useCallback, useRef } from 'react';
import { Location } from '@/types/chamado';
import {
  isNativeApp,
  isGeolocationAvailable,
  checkGeolocationPermission,
  requestGeolocationPermission,
  getCurrentPosition,
  watchPosition,
  clearWatch,
  PermissionState,
} from '@/lib/capacitorPermissions';

interface GeolocationState {
  location: Location | null;
  loading: boolean;
  error: string | null;
  permissionStatus: PermissionState;
}

interface UseCapacitorGeolocationOptions {
  watch?: boolean;
  autoRequest?: boolean;
}

export function useCapacitorGeolocation(options: UseCapacitorGeolocationOptions = {}) {
  const { watch = false, autoRequest = false } = options;

  const [state, setState] = useState<GeolocationState>({
    location: null,
    loading: false,
    error: null,
    permissionStatus: 'prompt',
  });

  const watchIdRef = useRef<string | number | null>(null);
  const hasRequestedRef = useRef(false);
  const isMountedRef = useRef(true);

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
      console.error('[useCapacitorGeolocation] Geocoding error:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }, []);

  const updatePosition = useCallback(async (position: { lat: number; lng: number }) => {
    if (!isMountedRef.current) return;

    const address = await getAddressFromCoords(position.lat, position.lng);
    
    if (!isMountedRef.current) return;

    setState(prev => ({
      ...prev,
      location: {
        lat: position.lat,
        lng: position.lng,
        address,
      },
      loading: false,
      error: null,
      permissionStatus: 'granted',
    }));
  }, [getAddressFromCoords]);

  const handleError = useCallback((error: any) => {
    if (!isMountedRef.current) return;

    let errorMessage = 'Erro ao obter localização';
    let permissionStatus: PermissionState = state.permissionStatus;
    
    // Check if it's a permission error
    if (error?.code === 1 || error?.message?.includes('permission')) {
      errorMessage = 'Permissão de localização negada. Ative nas configurações do dispositivo.';
      permissionStatus = 'denied';
    } else if (error?.code === 2 || error?.message?.includes('unavailable')) {
      errorMessage = 'Localização indisponível. Verifique se o GPS está ativado.';
    } else if (error?.code === 3 || error?.message?.includes('timeout')) {
      errorMessage = 'Tempo esgotado ao obter localização. Tente novamente.';
    }
    
    setState(prev => ({
      ...prev,
      loading: false,
      error: errorMessage,
      permissionStatus,
    }));
  }, [state.permissionStatus]);

  // Request location - called explicitly by user action
  const requestLocation = useCallback(async () => {
    console.log('[useCapacitorGeolocation] Requesting location...');
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    hasRequestedRef.current = true;

    try {
      // First check/request permission
      let permResult = await checkGeolocationPermission();
      console.log('[useCapacitorGeolocation] Permission check:', permResult);

      if (permResult.canRequest) {
        permResult = await requestGeolocationPermission();
        console.log('[useCapacitorGeolocation] Permission request result:', permResult);
      }

      if (permResult.state === 'denied') {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Permissão de localização negada. Ative nas configurações do dispositivo.',
          permissionStatus: 'denied',
        }));
        return;
      }

      if (permResult.state !== 'granted') {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Não foi possível obter permissão de localização.',
          permissionStatus: permResult.state,
        }));
        return;
      }

      // Get current position
      const position = await getCurrentPosition();
      
      if (position) {
        await updatePosition(position);
      } else {
        handleError({ message: 'Não foi possível obter a localização.' });
      }

      // Start watching if enabled
      if (watch && !watchIdRef.current) {
        watchIdRef.current = watchPosition(
          (pos) => updatePosition(pos),
          (err) => handleError(err)
        );
      }
    } catch (error) {
      console.error('[useCapacitorGeolocation] Error:', error);
      handleError(error);
    }
  }, [watch, updatePosition, handleError]);

  // Refresh location (requires previous permission)
  const refresh = useCallback(async () => {
    if (state.permissionStatus === 'granted' || hasRequestedRef.current) {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const position = await getCurrentPosition();
      if (position) {
        await updatePosition(position);
      } else {
        handleError({ message: 'Não foi possível obter a localização.' });
      }
    } else {
      await requestLocation();
    }
  }, [state.permissionStatus, updatePosition, handleError, requestLocation]);

  // Check permission status on mount (non-blocking)
  useEffect(() => {
    isMountedRef.current = true;

    const checkPermission = async () => {
      const result = await checkGeolocationPermission();
      
      if (!isMountedRef.current) return;

      setState(prev => ({
        ...prev,
        permissionStatus: result.state,
      }));

      // If already granted and autoRequest, get location
      if (result.state === 'granted' && autoRequest) {
        requestLocation();
      }
    };

    checkPermission();

    return () => {
      isMountedRef.current = false;
    };
  }, [autoRequest, requestLocation]);

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return { 
    ...state, 
    refresh,
    requestLocation,
    isGranted: state.permissionStatus === 'granted',
    isDenied: state.permissionStatus === 'denied',
    needsPermission: state.permissionStatus === 'prompt' || state.permissionStatus === 'prompt-with-rationale',
    isNative: isNativeApp() && isGeolocationAvailable(),
  };
}
