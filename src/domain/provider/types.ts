/**
 * Domain types for Provider (service provider)
 * Pure TypeScript - no React or external dependencies
 */

import { Location, ServiceType } from '../chamado/types';

/**
 * Provider entity
 */
export interface Provider {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  totalServices: number;
  online: boolean;
  location: Location;
  radarRange: number;
  services: ServiceType[];
  vehiclePlate?: string;
}

/**
 * Provider operational data
 */
export interface ProviderData {
  isOnline: boolean;
  radarRange: number;
  rating: number;
  totalServices: number;
  services: ServiceType[];
  currentLocation: Location | null;
  vehiclePlate?: string;
}

/**
 * Provider with distance (for nearby searches)
 */
export interface ProviderWithDistance extends Provider {
  distance: number; // km
}

/**
 * User profile type
 */
export type UserProfile = 'client' | 'provider';

/**
 * User entity
 */
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  activeProfile: UserProfile;
  providerData?: ProviderData;
}
