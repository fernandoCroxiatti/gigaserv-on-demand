/**
 * Provider validation rules
 * Pure functions - no side effects
 */

import { Location } from '../chamado/types';
import { isWithinRadius } from '../location/calculations';

/**
 * Check if provider can accept a chamado based on distance
 */
export function isProviderWithinRange(
  providerLocation: Location,
  chamadoLocation: Location,
  radarRange: number
): boolean {
  return isWithinRadius(
    { lat: chamadoLocation.lat, lng: chamadoLocation.lng },
    { lat: providerLocation.lat, lng: providerLocation.lng },
    radarRange
  );
}

/**
 * Check if provider offers a specific service
 */
export function providerOffersService(
  services: string[],
  serviceType: string
): boolean {
  return services.includes(serviceType);
}

/**
 * Check if provider is eligible for a chamado
 */
export function isProviderEligibleForChamado(
  providerServices: string[],
  providerLocation: Location | null,
  chamadoServiceType: string,
  chamadoLocation: Location,
  radarRange: number,
  declinedProviderIds: string[],
  providerId: string
): boolean {
  // Provider must have location
  if (!providerLocation) return false;
  
  // Provider must not have declined this chamado
  if (declinedProviderIds.includes(providerId)) return false;
  
  // Provider must offer the service
  if (!providerOffersService(providerServices, chamadoServiceType)) return false;
  
  // Provider must be within range
  if (!isProviderWithinRange(providerLocation, chamadoLocation, radarRange)) return false;
  
  return true;
}
