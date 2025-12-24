import { useState, useCallback, useEffect } from 'react';
import {
  isNativeApp,
  isGeolocationAvailable,
  checkGeolocationPermission,
  requestGeolocationPermission,
  PermissionState,
} from '@/lib/capacitorPermissions';

export type LocationPermissionStatus = PermissionState;

interface UseLocationPermissionReturn {
  status: LocationPermissionStatus;
  loading: boolean;
  error: string | null;
  checkPermission: () => Promise<LocationPermissionStatus>;
  requestPermission: () => Promise<boolean>;
  showExplanationModal: boolean;
  setShowExplanationModal: (show: boolean) => void;
  handleConfirmPermission: () => Promise<boolean>;
  handleDeclinePermission: () => void;
  isNative: boolean;
}

export function useLocationPermission(): UseLocationPermissionReturn {
  const [status, setStatus] = useState<LocationPermissionStatus>('prompt');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  const isNative = isNativeApp() && isGeolocationAvailable();

  // Check current permission status without requesting
  const checkPermission = useCallback(async (): Promise<LocationPermissionStatus> => {
    try {
      const result = await checkGeolocationPermission();
      setStatus(result.state);
      return result.state;
    } catch (e) {
      console.log('[LocationPermission] Cannot query permission status');
      return status;
    }
  }, [status]);

  // Initial permission check (non-blocking)
  useEffect(() => {
    checkPermission();
  }, []);

  // Request permission after user sees explanation
  const requestPermission = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const result = await requestGeolocationPermission();
      
      setLoading(false);
      setStatus(result.state);
      
      if (result.state === 'granted') {
        return true;
      }
      
      if (result.state === 'denied') {
        setError('Permissão de localização negada. Você pode ativar nas configurações do seu dispositivo.');
        return false;
      }
      
      setError('Não foi possível obter permissão de localização.');
      return false;
    } catch (err) {
      setLoading(false);
      setError('Erro ao solicitar permissão de localização.');
      console.error('[LocationPermission] Error:', err);
      return false;
    }
  }, []);

  // Called when user confirms in explanation modal
  const handleConfirmPermission = useCallback(async (): Promise<boolean> => {
    setShowExplanationModal(false);
    return await requestPermission();
  }, [requestPermission]);

  // Called when user declines in explanation modal
  const handleDeclinePermission = useCallback(() => {
    setShowExplanationModal(false);
    // Don't mark as denied - user just dismissed the explanation
    // They can try again later
  }, []);

  return {
    status,
    loading,
    error,
    checkPermission,
    requestPermission,
    showExplanationModal,
    setShowExplanationModal,
    handleConfirmPermission,
    handleDeclinePermission,
    isNative,
  };
}
