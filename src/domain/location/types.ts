/**
 * Domain types for Location/GPS
 * Pure TypeScript - no React or external dependencies
 */

/**
 * Permission states for device features
 */
export type PermissionState = 
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'prompt-with-rationale';

/**
 * Geographic coordinates
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Location with address
 */
export interface Location extends Coordinates {
  address: string;
  placeId?: string;
}

/**
 * Geolocation state
 */
export interface GeolocationState {
  location: Location | null;
  loading: boolean;
  error: string | null;
  permissionStatus: PermissionState;
}

/**
 * Geolocation options
 */
export interface GeolocationOptions {
  watch?: boolean;
  autoRequest?: boolean;
  highAccuracy?: boolean;
  timeout?: number;
}

/**
 * Result of permission check/request
 */
export interface PermissionResult {
  state: PermissionState;
  canRequest: boolean;
}
