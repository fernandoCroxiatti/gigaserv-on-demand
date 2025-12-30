import { useMemo, useEffect, useState, useRef } from 'react';
import { Location } from '@/types/chamado';

interface RemainingDistanceResult {
  remainingDistanceMeters: number;
  remainingDistanceText: string;
  remainingTimeSeconds: number;
  remainingTimeText: string;
  progress: number; // 0-100
}

/**
 * Decode Google Maps encoded polyline string to array of coordinates
 */
function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const poly: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return poly;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = from.lat * Math.PI / 180;
  const φ2 = to.lat * Math.PI / 180;
  const Δφ = (to.lat - from.lat) * Math.PI / 180;
  const Δλ = (to.lng - from.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find the closest point on the polyline to the current location
 * Returns the index of the closest segment and the distance along that segment
 */
function findClosestPointOnRoute(
  currentLocation: { lat: number; lng: number },
  decodedPath: Array<{ lat: number; lng: number }>
): { segmentIndex: number; distanceToPoint: number } {
  let closestIndex = 0;
  let closestDistance = Infinity;

  for (let i = 0; i < decodedPath.length; i++) {
    const dist = calculateDistance(currentLocation, decodedPath[i]);
    if (dist < closestDistance) {
      closestDistance = dist;
      closestIndex = i;
    }
  }

  return { segmentIndex: closestIndex, distanceToPoint: closestDistance };
}

/**
 * Calculate remaining distance along the polyline from closest point to end
 */
function calculateRemainingDistanceAlongRoute(
  segmentIndex: number,
  decodedPath: Array<{ lat: number; lng: number }>
): number {
  let remainingDistance = 0;

  for (let i = segmentIndex; i < decodedPath.length - 1; i++) {
    remainingDistance += calculateDistance(decodedPath[i], decodedPath[i + 1]);
  }

  return remainingDistance;
}

/**
 * Format distance for display
 */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration for display
 */
function formatDuration(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
}

/**
 * Hook to calculate remaining distance and time dynamically based on current position
 * Uses the already-loaded polyline, NO extra API calls
 * 
 * @param providerLocation - Current provider GPS location
 * @param routePolyline - Encoded polyline from route calculation
 * @param initialDistanceMeters - Initial total route distance (from route calculation)
 * @param initialDurationSeconds - Initial total route duration (from route calculation)
 * @param phase - Current navigation phase (for resetting on phase change)
 */
export function useRemainingDistance(
  providerLocation: Location | null,
  routePolyline: string,
  initialDistanceMeters: number,
  initialDurationSeconds: number,
  phase: string
): RemainingDistanceResult {
  const [result, setResult] = useState<RemainingDistanceResult>({
    remainingDistanceMeters: initialDistanceMeters,
    remainingDistanceText: formatDistance(initialDistanceMeters),
    remainingTimeSeconds: initialDurationSeconds,
    remainingTimeText: formatDuration(initialDurationSeconds),
    progress: 0,
  });

  // Track initial values for this phase
  const initialValuesRef = useRef({
    distance: initialDistanceMeters,
    duration: initialDurationSeconds,
    phase: phase,
  });

  // Decode polyline once
  const decodedPath = useMemo(() => {
    if (!routePolyline) return [];
    try {
      return decodePolyline(routePolyline);
    } catch {
      return [];
    }
  }, [routePolyline]);

  // Reset when phase changes
  useEffect(() => {
    if (phase !== initialValuesRef.current.phase) {
      initialValuesRef.current = {
        distance: initialDistanceMeters,
        duration: initialDurationSeconds,
        phase: phase,
      };
      setResult({
        remainingDistanceMeters: initialDistanceMeters,
        remainingDistanceText: formatDistance(initialDistanceMeters),
        remainingTimeSeconds: initialDurationSeconds,
        remainingTimeText: formatDuration(initialDurationSeconds),
        progress: 0,
      });
    }
  }, [phase, initialDistanceMeters, initialDurationSeconds]);

  // Update initial values when new route is calculated
  useEffect(() => {
    if (initialDistanceMeters > 0 && initialDistanceMeters !== initialValuesRef.current.distance) {
      initialValuesRef.current = {
        distance: initialDistanceMeters,
        duration: initialDurationSeconds,
        phase: phase,
      };
    }
  }, [initialDistanceMeters, initialDurationSeconds, phase]);

  // Calculate remaining distance on each position update
  useEffect(() => {
    if (!providerLocation || decodedPath.length < 2 || initialValuesRef.current.distance === 0) {
      return;
    }

    // Find closest point on route
    const { segmentIndex, distanceToPoint } = findClosestPointOnRoute(
      providerLocation,
      decodedPath
    );

    // Only calculate if reasonably close to route (< 200m)
    if (distanceToPoint > 200) {
      return;
    }

    // Calculate remaining distance along route
    const remainingDistance = calculateRemainingDistanceAlongRoute(segmentIndex, decodedPath);

    // Calculate progress (0-100)
    const totalInitialDistance = initialValuesRef.current.distance;
    const progress = totalInitialDistance > 0
      ? Math.max(0, Math.min(100, ((totalInitialDistance - remainingDistance) / totalInitialDistance) * 100))
      : 0;

    // Calculate remaining time proportionally
    const totalInitialDuration = initialValuesRef.current.duration;
    const remainingTime = totalInitialDuration > 0
      ? Math.ceil(totalInitialDuration * (remainingDistance / totalInitialDistance))
      : 0;

    // Only update if values changed significantly (avoid flicker)
    setResult(prev => {
      const distanceDiff = Math.abs(prev.remainingDistanceMeters - remainingDistance);
      const timeDiff = Math.abs(prev.remainingTimeSeconds - remainingTime);
      
      // Only update if distance changed by > 20m or time by > 10s
      if (distanceDiff > 20 || timeDiff > 10) {
        return {
          remainingDistanceMeters: remainingDistance,
          remainingDistanceText: formatDistance(remainingDistance),
          remainingTimeSeconds: remainingTime,
          remainingTimeText: formatDuration(remainingTime),
          progress,
        };
      }
      return prev;
    });
  }, [providerLocation, decodedPath]);

  return result;
}
