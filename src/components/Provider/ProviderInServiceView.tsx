import React from 'react';
import { NavigationFullScreen } from '../Navigation/NavigationFullScreen';

/**
 * Provider In-Service View
 * Renders full-screen GPS navigation for the provider during active service.
 * Uses NavigationFullScreen component with two phases:
 * - Phase 1: Going to vehicle location
 * - Phase 2: Going to final destination (for guincho services)
 */
export function ProviderInServiceView() {
  return <NavigationFullScreen mode="provider" />;
}
