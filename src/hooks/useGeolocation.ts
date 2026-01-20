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
      console.error('[useGeolocation] Geocoding error:', error);
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

    console.error('[useGeolocation] Handling error:', error);
    
    let errorMessage = 'Erro ao obter localização. Verifique se o GPS está ativado.';
    let permissionStatus: PermissionState = state.permissionStatus;
    
    // Check if it's a GeolocationPositionError
    if (error?.code !== undefined) {
      switch (error.code) {
        case 1: // PERMISSION_DENIED
          errorMessage = 'Permissão de localização negada. Ative nas configurações do dispositivo.';
          permissionStatus = 'denied';
          break;
        case 2: // POSITION_UNAVAILABLE
          errorMessage = 'GPS indisponível. Verifique se o GPS está ativado e tente novamente.';
          break;
        case 3: // TIMEOUT
          errorMessage = 'Tempo esgotado. Vá para um local com melhor sinal e tente novamente.';
          break;
      }
    } else if (error?.message?.includes('permission') || error?.message?.includes('Permission')) {
      errorMessage = 'Permissão de localização negada. Ative nas configurações do dispositivo.';
      permissionStatus = 'denied';
    } else if (error?.message?.includes('timeout') || error?.message?.includes('Timeout')) {
      errorMessage = 'Tempo esgotado. Vá para um local com melhor sinal e tente novamente.';
    } else if (error?.message?.includes('unavailable') || error?.message?.includes('Unavailable')) {
      errorMessage = 'GPS indisponível. Verifique se o GPS está ativado.';
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
    console.log('[useGeolocation] Requesting location...');
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    hasRequestedRef.current = true;

    try {
      // Check/request permission using Capacitor or web fallback
      let permResult = await checkGeolocationPermission();
      console.log('[useGeolocation] Permission check:', permResult);

      if (permResult.canRequest) {
        permResult = await requestGeolocationPermission();
        console.log('[useGeolocation] Permission request result:', permResult);
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
      console.log('[useGeolocation] Getting current position...');
      const position = await getCurrentPosition();
      console.log('[useGeolocation] Position result:', position);
      
      if (position && isMountedRef.current) {
        await updatePosition(position);
      } else if (isMountedRef.current) {
        handleError({ code: 2, message: 'GPS indisponível. Verifique se o GPS está ativado.' });
      }

      // Start watching if enabled
      if (watch && !watchIdRef.current) {
        watchIdRef.current = watchPosition(
          (pos) => updatePosition(pos),
          (err) => handleError(err)
        );
      }
    } catch (error) {
      console.error('[useGeolocation] Error:', error);
      if (isMountedRef.current) {
        handleError(error);
      }
    }
  }, [watch, updatePosition, handleError]);

  // Refresh location (requires previous permission)
  const refresh = useCallback(async () => {
    console.log('[useGeolocation] Refresh called, status:', state.permissionStatus);
    
    if (state.permissionStatus === 'granted' || hasRequestedRef.current) {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const position = await getCurrentPosition();
      console.log('[useGeolocation] Refresh position:', position);
      
      if (position && isMountedRef.current) {
        await updatePosition(position);
      } else if (isMountedRef.current) {
        handleError({ code: 2, message: 'GPS indisponível. Verifique se o GPS está ativado.' });
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

      // If already granted and autoRequest, get location silently
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
      if (watchIdRef.current !== null) {
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
