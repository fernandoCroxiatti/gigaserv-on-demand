/**
 * Location calculation utilities
 * Pure functions - no side effects
 */

import { Coordinates } from './types';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistanceKm(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371; // Earth's radius in km
  
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Check if a point is within a radius from center
 */
export function isWithinRadius(
  point: Coordinates,
  center: Coordinates,
  radiusKm: number
): boolean {
  return calculateDistanceKm(point, center) <= radiusKm;
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate bounding box for efficient range queries
 */
export function calculateBoundingBox(
  center: Coordinates,
  radiusKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  // Approximate degrees per km at equator
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos(toRadians(center.lat));
  
  const deltaLat = radiusKm / kmPerDegLat;
  const deltaLng = radiusKm / kmPerDegLng;
  
  return {
    minLat: center.lat - deltaLat,
    maxLat: center.lat + deltaLat,
    minLng: center.lng - deltaLng,
    maxLng: center.lng + deltaLng,
  };
}
