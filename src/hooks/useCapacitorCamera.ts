import { useState, useCallback } from 'react';
import { CameraSource, CameraResultType } from '@capacitor/camera';
import {
  isNativeApp,
  isCameraAvailable,
  checkCameraPermission,
  requestCameraPermission,
  takePhoto,
  pickImage,
  PermissionState,
} from '@/lib/capacitorPermissions';

export interface UseCapacitorCameraReturn {
  // State
  isLoading: boolean;
  error: string | null;
  permissionStatus: PermissionState;
  
  // Methods
  checkPermission: () => Promise<PermissionState>;
  requestPermission: () => Promise<boolean>;
  capturePhoto: (options?: CaptureOptions) => Promise<string | null>;
  selectFromGallery: () => Promise<string | null>;
  
  // Flags
  isNative: boolean;
  isGranted: boolean;
  isDenied: boolean;
  needsPermission: boolean;
}

export interface CaptureOptions {
  quality?: number;
  allowEditing?: boolean;
  width?: number;
  height?: number;
}

export function useCapacitorCamera(): UseCapacitorCameraReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('prompt');

  const isNative = isNativeApp() && isCameraAvailable();

  const checkPermission = useCallback(async (): Promise<PermissionState> => {
    if (!isNative) {
      // Web doesn't have camera permission check
      return 'prompt';
    }

    try {
      const result = await checkCameraPermission();
      setPermissionStatus(result.state);
      return result.state;
    } catch (err) {
      console.error('[useCapacitorCamera] Error checking permission:', err);
      return 'unavailable';
    }
  }, [isNative]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      // Web - permission is requested when camera is used
      return true;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await requestCameraPermission();
      setPermissionStatus(result.state);
      setIsLoading(false);

      if (result.state === 'denied') {
        setError('Permissão de câmera negada. Ative nas configurações do dispositivo.');
        return false;
      }

      return result.state === 'granted';
    } catch (err) {
      setIsLoading(false);
      setError('Erro ao solicitar permissão de câmera.');
      console.error('[useCapacitorCamera] Error requesting permission:', err);
      return false;
    }
  }, [isNative]);

  const capturePhoto = useCallback(async (options: CaptureOptions = {}): Promise<string | null> => {
    if (!isNative) {
      // On web, return null to trigger file input fallback
      console.log('[useCapacitorCamera] Not running on native, use file input instead');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);

      const photo = await takePhoto({
        quality: options.quality ?? 90,
        allowEditing: options.allowEditing ?? false,
        width: options.width,
        height: options.height,
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
      });

      setIsLoading(false);

      if (!photo) {
        return null;
      }

      // Return the photo URI
      return photo.webPath || photo.path || null;
    } catch (err: any) {
      setIsLoading(false);
      
      if (err?.message?.includes('User cancelled')) {
        // User cancelled - not an error
        return null;
      }

      if (err?.message?.includes('permission')) {
        setError('Permissão de câmera negada. Ative nas configurações do dispositivo.');
        setPermissionStatus('denied');
      } else {
        setError('Erro ao capturar foto.');
      }
      
      console.error('[useCapacitorCamera] Error capturing photo:', err);
      return null;
    }
  }, [isNative]);

  const selectFromGallery = useCallback(async (): Promise<string | null> => {
    if (!isNative) {
      // On web, return null to trigger file input fallback
      console.log('[useCapacitorCamera] Not running on native, use file input instead');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);

      const photo = await pickImage();

      setIsLoading(false);

      if (!photo) {
        return null;
      }

      return photo.webPath || photo.path || null;
    } catch (err: any) {
      setIsLoading(false);
      
      if (err?.message?.includes('User cancelled')) {
        return null;
      }

      if (err?.message?.includes('permission')) {
        setError('Permissão de galeria negada. Ative nas configurações do dispositivo.');
        setPermissionStatus('denied');
      } else {
        setError('Erro ao selecionar imagem.');
      }
      
      console.error('[useCapacitorCamera] Error selecting image:', err);
      return null;
    }
  }, [isNative]);

  return {
    isLoading,
    error,
    permissionStatus,
    checkPermission,
    requestPermission,
    capturePhoto,
    selectFromGallery,
    isNative,
    isGranted: permissionStatus === 'granted',
    isDenied: permissionStatus === 'denied',
    needsPermission: permissionStatus === 'prompt' || permissionStatus === 'prompt-with-rationale',
  };
}
