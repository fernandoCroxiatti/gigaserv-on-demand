import { useState, useCallback, useEffect } from 'react';

export type LocationPermissionStatus = 'prompt' | 'granted' | 'denied' | 'unavailable';

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
}

export function useLocationPermission(): UseLocationPermissionReturn {
  const [status, setStatus] = useState<LocationPermissionStatus>('prompt');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  // Check current permission status without requesting
  const checkPermission = useCallback(async (): Promise<LocationPermissionStatus> => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return 'unavailable';
    }

    // Check if Permissions API is available
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        const newStatus = result.state as LocationPermissionStatus;
        setStatus(newStatus);
        return newStatus;
      } catch (e) {
        // Some browsers don't support querying geolocation permission
        console.log('[LocationPermission] Cannot query permission status');
      }
    }

    return status;
  }, [status]);

  // Initial permission check (non-blocking)
  useEffect(() => {
    checkPermission();
  }, []);

  // Request permission after user sees explanation
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada neste dispositivo.');
      setStatus('unavailable');
      return false;
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setStatus('granted');
          setLoading(false);
          resolve(true);
        },
        (err) => {
          setLoading(false);
          
          if (err.code === err.PERMISSION_DENIED) {
            setStatus('denied');
            setError('Permissão de localização negada. Você pode ativar nas configurações do seu dispositivo.');
            resolve(false);
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setError('Localização indisponível. Verifique se o GPS está ativado.');
            resolve(false);
          } else if (err.code === err.TIMEOUT) {
            setError('Tempo esgotado ao obter localização. Tente novamente.');
            resolve(false);
          } else {
            setError('Erro ao obter localização.');
            resolve(false);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
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
  };
}
