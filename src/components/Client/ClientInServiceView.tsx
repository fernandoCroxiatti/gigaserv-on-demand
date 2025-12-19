import React from 'react';
import { NavigationFullScreen } from '../Navigation/NavigationFullScreen';

/**
 * Client In-Service View
 * Renders full-screen GPS navigation tracking for the client during active service.
 * Shows real-time provider location, route, ETA and distance.
 * Uses NavigationFullScreen component in client mode.
 */
export function ClientInServiceView() {
  return <NavigationFullScreen mode="client" />;
}
