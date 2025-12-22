import { useCallback, useRef } from 'react';
import { Location } from '@/types/chamado';

interface RouteDeviationResult {
  isOffRoute: boolean;
  distanceFromRoute: number;
}

interface UseRouteDeviationOptions {
  /** Maximum distance from route before considered off-route (meters) */
  maxDeviationMeters?: number;
  /** Minimum time off-route before triggering recalculation (ms) */
  minTimeOffRoute?: number;
  /** Minimum time between recalculations (ms) - debounce */
  minRecalculateInterval?: number;
  /** Callback when route recalculation is needed */
  onRecalculateNeeded?: () => void;
}

// Default deviation threshold (100 meters from route - increased to reduce API calls)
const DEFAULT_MAX_DEVIATION = 100;
// Time to wait before triggering recalculation (5 seconds for confirmation)
const DEFAULT_MIN_TIME_OFF_ROUTE = 5000;
// MINIMUM 2 MINUTES between recalculations to reduce API costs
const DEFAULT_MIN_RECALCULATE_INTERVAL = 120000;

/**
 * Decode Google Maps encoded polyline to array of coordinates
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
 * Calculate distance from a point to a line segment
 */
function pointToSegmentDistance(
  point: { lat: number; lng: number },
  segStart: { lat: number; lng: number },
  segEnd: { lat: number; lng: number }
): number {
  const R = 6371e3; // Earth radius in meters
  
  // Convert to radians
  const lat1 = segStart.lat * Math.PI / 180;
  const lng1 = segStart.lng * Math.PI / 180;
  const lat2 = segEnd.lat * Math.PI / 180;
  const lng2 = segEnd.lng * Math.PI / 180;
  const lat3 = point.lat * Math.PI / 180;
  const lng3 = point.lng * Math.PI / 180;
  
  // Calculate cross-track distance (simplified for short distances)
  const d13 = Math.sqrt(
    Math.pow((lat3 - lat1) * R, 2) + 
    Math.pow((lng3 - lng1) * R * Math.cos(lat1), 2)
  );
  
  const d12 = Math.sqrt(
    Math.pow((lat2 - lat1) * R, 2) + 
    Math.pow((lng2 - lng1) * R * Math.cos(lat1), 2)
  );
  
  const d23 = Math.sqrt(
    Math.pow((lat3 - lat2) * R, 2) + 
    Math.pow((lng3 - lng2) * R * Math.cos(lat2), 2)
  );
  
  // If segment is very short, return distance to start point
  if (d12 < 1) return d13;
  
  // Check if point projects onto segment
  const dot = ((lat3 - lat1) * (lat2 - lat1) + (lng3 - lng1) * (lng2 - lng1));
  const lenSq = ((lat2 - lat1) * (lat2 - lat1) + (lng2 - lng1) * (lng2 - lng1));
  const param = lenSq > 0 ? dot / lenSq : -1;
  
  if (param < 0) return d13;
  if (param > 1) return d23;
  
  // Calculate perpendicular distance
  const closestLat = lat1 + param * (lat2 - lat1);
  const closestLng = lng1 + param * (lng2 - lng1);
  
  return Math.sqrt(
    Math.pow((lat3 - closestLat) * R, 2) + 
    Math.pow((lng3 - closestLng) * R * Math.cos(closestLat), 2)
  );
}

/**
 * Hook to detect if user has deviated from the calculated route
 * and trigger automatic route recalculation with strict controls.
 * 
 * OPTIMIZED FOR COST REDUCTION:
 * - 100m deviation threshold (vs 50m before)
 * - 2 minute minimum between recalculations
 * - 5 second confirmation before triggering
 */
export function useRouteDeviation(options: UseRouteDeviationOptions = {}) {
  const {
    maxDeviationMeters = DEFAULT_MAX_DEVIATION,
    minTimeOffRoute = DEFAULT_MIN_TIME_OFF_ROUTE,
    minRecalculateInterval = DEFAULT_MIN_RECALCULATE_INTERVAL,
    onRecalculateNeeded,
  } = options;

  const offRouteStartRef = useRef<number | null>(null);
  const lastRecalculateRef = useRef<number>(0);
  const decodedRouteRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const isRecalculatingRef = useRef<boolean>(false);

  /**
   * Check if current location is off the route
   */
  const checkDeviation = useCallback((
    currentLocation: Location,
    routePolyline: string | null
  ): RouteDeviationResult => {
    if (!routePolyline || !currentLocation) {
      return { isOffRoute: false, distanceFromRoute: 0 };
    }

    // Decode polyline if changed (cached for performance)
    if (decodedRouteRef.current.length === 0) {
      try {
        decodedRouteRef.current = decodePolyline(routePolyline);
      } catch (e) {
        console.error('[RouteDeviation] Failed to decode polyline:', e);
        return { isOffRoute: false, distanceFromRoute: 0 };
      }
    }

    const routePoints = decodedRouteRef.current;
    if (routePoints.length < 2) {
      return { isOffRoute: false, distanceFromRoute: 0 };
    }

    // Find minimum distance to any segment of the route
    let minDistance = Infinity;
    
    for (let i = 0; i < routePoints.length - 1; i++) {
      const distance = pointToSegmentDistance(
        { lat: currentLocation.lat, lng: currentLocation.lng },
        routePoints[i],
        routePoints[i + 1]
      );
      
      if (distance < minDistance) {
        minDistance = distance;
      }
      
      // Early exit if clearly on route
      if (minDistance < maxDeviationMeters * 0.3) break;
    }

    const isOffRoute = minDistance > maxDeviationMeters;
    const now = Date.now();

    if (isOffRoute) {
      // Start tracking off-route time
      if (offRouteStartRef.current === null) {
        offRouteStartRef.current = now;
        console.log('[RouteDeviation] User went off route, distance:', minDistance.toFixed(0), 'm');
      }

      // Check if off-route long enough AND debounce period passed
      const timeOffRoute = now - offRouteStartRef.current;
      const timeSinceLastRecalc = now - lastRecalculateRef.current;

      // STRICT CONDITIONS:
      // 1. Off-route for at least 5 seconds (confirmation)
      // 2. At least 2 minutes since last recalculation
      // 3. Not currently recalculating
      if (
        timeOffRoute >= minTimeOffRoute && 
        timeSinceLastRecalc >= minRecalculateInterval &&
        !isRecalculatingRef.current
      ) {
        console.log('[RouteDeviation] Triggering route recalculation (controlled)');
        isRecalculatingRef.current = true;
        lastRecalculateRef.current = now;
        decodedRouteRef.current = []; // Clear cached route
        
        // Call the recalculate callback
        onRecalculateNeeded?.();
        
        // Reset the recalculating flag after a delay
        setTimeout(() => {
          isRecalculatingRef.current = false;
        }, 5000);
      }
    } else {
      // Reset off-route timer when back on route
      if (offRouteStartRef.current !== null) {
        console.log('[RouteDeviation] User back on route');
        offRouteStartRef.current = null;
      }
    }

    return { isOffRoute, distanceFromRoute: minDistance };
  }, [maxDeviationMeters, minTimeOffRoute, minRecalculateInterval, onRecalculateNeeded]);

  /**
   * Clear cached route data (call when route changes or phase changes)
   */
  const clearRouteCache = useCallback(() => {
    decodedRouteRef.current = [];
    offRouteStartRef.current = null;
    isRecalculatingRef.current = false;
  }, []);

  /**
   * Force reset the recalculation timer (for manual recalculations)
   */
  const resetRecalculateTimer = useCallback(() => {
    lastRecalculateRef.current = Date.now();
    isRecalculatingRef.current = false;
  }, []);

  return {
    checkDeviation,
    clearRouteCache,
    resetRecalculateTimer,
  };
}
