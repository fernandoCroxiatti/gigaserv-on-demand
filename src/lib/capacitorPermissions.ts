import { Capacitor } from '@capacitor/core';
import { Geolocation, PermissionStatus as GeoPermissionStatus } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource, Photo, PermissionStatus as CameraPermissionStatus } from '@capacitor/camera';
import { PushNotifications, PermissionStatus as PushPermissionStatus } from '@capacitor/push-notifications';

export type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied' | 'unavailable';

export interface PermissionResult {
  state: PermissionState;
  canRequest: boolean;
}

// Check if running in native app
export const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
};

// ============= GEOLOCATION PERMISSIONS =============

export const isGeolocationAvailable = (): boolean => {
  return Capacitor.isPluginAvailable('Geolocation');
};

export const checkGeolocationPermission = async (): Promise<PermissionResult> => {
  if (!isNativeApp() || !isGeolocationAvailable()) {
    // Fall back to web API
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return {
          state: result.state as PermissionState,
          canRequest: result.state === 'prompt',
        };
      } catch {
        return { state: 'prompt', canRequest: true };
      }
    }
    return { state: 'prompt', canRequest: true };
  }

  try {
    const status = await Geolocation.checkPermissions();
    console.log('[CapacitorPermissions] Geolocation status:', status);
    
    const state = mapPermissionState(status.location);
    return {
      state,
      canRequest: state === 'prompt' || state === 'prompt-with-rationale',
    };
  } catch (error) {
    console.error('[CapacitorPermissions] Error checking geolocation:', error);
    return { state: 'unavailable', canRequest: false };
  }
};

export const requestGeolocationPermission = async (): Promise<PermissionResult> => {
  if (!isNativeApp() || !isGeolocationAvailable()) {
    // Fall back to web API - requesting location triggers permission
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ state: 'unavailable', canRequest: false });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => resolve({ state: 'granted', canRequest: false }),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve({ state: 'denied', canRequest: false });
          } else {
            resolve({ state: 'granted', canRequest: false });
          }
        },
        { timeout: 10000 }
      );
    });
  }

  try {
    const status = await Geolocation.requestPermissions();
    console.log('[CapacitorPermissions] Geolocation request result:', status);
    
    const state = mapPermissionState(status.location);
    return {
      state,
      canRequest: false,
    };
  } catch (error) {
    console.error('[CapacitorPermissions] Error requesting geolocation:', error);
    return { state: 'denied', canRequest: false };
  }
};

export const getCurrentPosition = async (): Promise<{ lat: number; lng: number } | null> => {
  if (!isNativeApp() || !isGeolocationAvailable()) {
    // Fall back to web API
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }

  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
    
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch (error) {
    console.error('[CapacitorPermissions] Error getting position:', error);
    return null;
  }
};

export const watchPosition = (
  callback: (position: { lat: number; lng: number }) => void,
  errorCallback?: (error: any) => void
): string | number | null => {
  if (!isNativeApp() || !isGeolocationAvailable()) {
    // Fall back to web API
    if (!navigator.geolocation) return null;

    return navigator.geolocation.watchPosition(
      (position) => {
        callback({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      errorCallback,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  // Use Capacitor's watch
  Geolocation.watchPosition(
    { enableHighAccuracy: true },
    (position, err) => {
      if (err) {
        errorCallback?.(err);
        return;
      }
      if (position) {
        callback({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      }
    }
  ).then((id) => {
    console.log('[CapacitorPermissions] Watch ID:', id);
  });

  return 'capacitor-watch';
};

export const clearWatch = (watchId: string | number): void => {
  if (typeof watchId === 'number') {
    navigator.geolocation.clearWatch(watchId);
  } else if (watchId === 'capacitor-watch') {
    Geolocation.clearWatch({ id: watchId });
  }
};

// ============= CAMERA PERMISSIONS =============

export const isCameraAvailable = (): boolean => {
  return Capacitor.isPluginAvailable('Camera');
};

export const checkCameraPermission = async (): Promise<PermissionResult> => {
  if (!isNativeApp() || !isCameraAvailable()) {
    // Web doesn't have a camera permission check without requesting
    return { state: 'prompt', canRequest: true };
  }

  try {
    const status = await Camera.checkPermissions();
    console.log('[CapacitorPermissions] Camera status:', status);
    
    // Check both camera and photos permissions
    const cameraState = mapPermissionState(status.camera);
    const photosState = mapPermissionState(status.photos);
    
    // Return the most restrictive state
    if (cameraState === 'denied' || photosState === 'denied') {
      return { state: 'denied', canRequest: false };
    }
    if (cameraState === 'granted' && photosState === 'granted') {
      return { state: 'granted', canRequest: false };
    }
    
    return {
      state: 'prompt',
      canRequest: true,
    };
  } catch (error) {
    console.error('[CapacitorPermissions] Error checking camera:', error);
    return { state: 'unavailable', canRequest: false };
  }
};

export const requestCameraPermission = async (): Promise<PermissionResult> => {
  if (!isNativeApp() || !isCameraAvailable()) {
    // Web - permission is requested when camera is used
    return { state: 'prompt', canRequest: true };
  }

  try {
    const status = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    console.log('[CapacitorPermissions] Camera request result:', status);
    
    const cameraState = mapPermissionState(status.camera);
    const photosState = mapPermissionState(status.photos);
    
    if (cameraState === 'denied' || photosState === 'denied') {
      return { state: 'denied', canRequest: false };
    }
    if (cameraState === 'granted' && photosState === 'granted') {
      return { state: 'granted', canRequest: false };
    }
    
    return { state: 'prompt', canRequest: true };
  } catch (error) {
    console.error('[CapacitorPermissions] Error requesting camera:', error);
    return { state: 'denied', canRequest: false };
  }
};

export interface TakePhotoOptions {
  quality?: number;
  allowEditing?: boolean;
  resultType?: CameraResultType;
  source?: CameraSource;
  width?: number;
  height?: number;
}

export const takePhoto = async (options: TakePhotoOptions = {}): Promise<Photo | null> => {
  if (!isNativeApp() || !isCameraAvailable()) {
    console.log('[CapacitorPermissions] Camera not available on this platform');
    return null;
  }

  try {
    // Check permission first
    const permResult = await checkCameraPermission();
    
    if (permResult.state === 'denied') {
      console.log('[CapacitorPermissions] Camera permission denied');
      return null;
    }

    if (permResult.canRequest) {
      const requestResult = await requestCameraPermission();
      if (requestResult.state !== 'granted') {
        console.log('[CapacitorPermissions] Camera permission not granted after request');
        return null;
      }
    }

    const photo = await Camera.getPhoto({
      quality: options.quality ?? 90,
      allowEditing: options.allowEditing ?? false,
      resultType: options.resultType ?? CameraResultType.Uri,
      source: options.source ?? CameraSource.Prompt,
      width: options.width,
      height: options.height,
    });

    return photo;
  } catch (error: any) {
    if (error?.message?.includes('User cancelled')) {
      console.log('[CapacitorPermissions] User cancelled photo');
      return null;
    }
    console.error('[CapacitorPermissions] Error taking photo:', error);
    return null;
  }
};

export const pickImage = async (): Promise<Photo | null> => {
  return takePhoto({ source: CameraSource.Photos });
};

// ============= PUSH NOTIFICATION PERMISSIONS =============

export const isPushAvailable = (): boolean => {
  return isNativeApp() && Capacitor.isPluginAvailable('PushNotifications');
};

export const checkPushPermission = async (): Promise<PermissionResult> => {
  if (!isPushAvailable()) {
    // Web - use Notification API
    if ('Notification' in window) {
      const permission = Notification.permission;
      return {
        state: permission === 'default' ? 'prompt' : permission as PermissionState,
        canRequest: permission === 'default',
      };
    }
    return { state: 'unavailable', canRequest: false };
  }

  try {
    const status = await PushNotifications.checkPermissions();
    console.log('[CapacitorPermissions] Push status:', status);
    
    const state = mapPermissionState(status.receive);
    return {
      state,
      canRequest: state === 'prompt' || state === 'prompt-with-rationale',
    };
  } catch (error) {
    console.error('[CapacitorPermissions] Error checking push:', error);
    return { state: 'unavailable', canRequest: false };
  }
};

export const requestPushPermission = async (): Promise<PermissionResult> => {
  if (!isPushAvailable()) {
    // Web - use Notification API
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return {
        state: permission === 'default' ? 'prompt' : permission as PermissionState,
        canRequest: false,
      };
    }
    return { state: 'unavailable', canRequest: false };
  }

  try {
    const status = await PushNotifications.requestPermissions();
    console.log('[CapacitorPermissions] Push request result:', status);
    
    const state = mapPermissionState(status.receive);
    
    // Register if granted
    if (state === 'granted') {
      await PushNotifications.register();
    }
    
    return {
      state,
      canRequest: false,
    };
  } catch (error) {
    console.error('[CapacitorPermissions] Error requesting push:', error);
    return { state: 'denied', canRequest: false };
  }
};

// ============= HELPERS =============

function mapPermissionState(state: string): PermissionState {
  switch (state) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
      return 'prompt';
    case 'prompt-with-rationale':
      return 'prompt-with-rationale';
    default:
      return 'prompt';
  }
}

// Open app settings (for when permission is denied)
export const openAppSettings = async (): Promise<void> => {
  if (!isNativeApp()) {
    // Web - can't open settings
    console.log('[CapacitorPermissions] Cannot open settings on web');
    return;
  }

  // Note: This requires @capacitor/app-launcher or similar
  // For now, we'll just log a message
  console.log('[CapacitorPermissions] User should open device settings manually');
};
