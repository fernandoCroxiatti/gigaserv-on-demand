/**
 * Domain Layer - Pure Business Logic
 * 
 * This layer contains all business rules and domain entities.
 * It has NO dependencies on:
 * - React or any UI framework
 * - Supabase or any database
 * - External APIs
 * 
 * This makes it easy to:
 * - Unit test business logic in isolation
 * - Reuse in native mobile apps (React Native, Swift, Kotlin)
 * - Migrate to different backends without changing domain logic
 */

// Chamado domain - primary source for shared types
export * from './chamado';

// Location domain (coordinates, distance calculations)
// Note: Location type is defined in chamado/types to avoid circular deps
export { 
  calculateDistanceKm,
  isWithinRadius,
  formatDistance,
  calculateBoundingBox
} from './location/calculations';
export type { 
  Coordinates, 
  GeolocationState, 
  GeolocationOptions,
  PermissionState,
  PermissionResult
} from './location/types';

// Provider domain (service providers)
export type { 
  Provider, 
  ProviderData, 
  ProviderWithDistance,
  User,
  UserProfile 
} from './provider/types';
export { 
  isProviderWithinRange,
  providerOffersService,
  isProviderEligibleForChamado
} from './provider/validation';
