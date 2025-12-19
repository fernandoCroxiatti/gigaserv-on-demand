import { useState, useCallback, useRef } from 'react';
import { Location } from '@/types/chamado';
import { supabase } from '@/integrations/supabase/client';

interface RouteData {
  polyline: string;
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
}

interface UseNavigationRouteReturn {
  routeData: RouteData | null;
  isCalculating: boolean;
  error: string | null;
  calculateRoute: (origin: Location, destination: Location, chamadoId: string, phase: string) => Promise<RouteData | null>;
  forceRecalculateRoute: (origin: Location, destination: Location, chamadoId: string, phase: string) => Promise<RouteData | null>;
  clearRoute: () => void;
}

/**
 * Hook to calculate route ONCE per phase and store in database.
 * Minimizes API calls by only calculating when explicitly requested.
 * 
 * AUDIT FIX: Removed routeData from useCallback dependencies to prevent
 * unnecessary recalculations when state changes.
 */
export function useNavigationRoute(): UseNavigationRouteReturn {
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track calculated routes to prevent duplicates
  const calculatedRef = useRef<string>('');
  // Track if currently calculating to prevent concurrent calls
  const calculatingRef = useRef<boolean>(false);

  const calculateRoute = useCallback(async (
    origin: Location,
    destination: Location,
    chamadoId: string,
    phase: string
  ): Promise<RouteData | null> => {
    // Create unique key to prevent duplicate calculations
    const routeKey = `${chamadoId}-${phase}`;
    
    // AUDIT FIX: Multiple checks to prevent duplicate API calls
    // 1. Check if already calculated for this phase
    if (calculatedRef.current === routeKey) {
      console.log('[Navigation] Route already calculated for phase:', phase);
      return null;
    }
    
    // 2. Check if currently calculating (prevent concurrent calls)
    if (calculatingRef.current) {
      console.log('[Navigation] Route calculation already in progress, skipping');
      return null;
    }

    calculatingRef.current = true;
    setIsCalculating(true);
    setError(null);

    try {
      // Check if Google Maps is loaded
      if (!window.google?.maps) {
        throw new Error('Google Maps não carregado');
      }

      console.log('[Navigation] CALCULATING ROUTE (API CALL):', {
        phase,
        from: `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`,
        to: `${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}`,
      });

      const directionsService = new google.maps.DirectionsService();
      
      const result = await directionsService.route({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      });

      const leg = result.routes[0]?.legs[0];
      if (!leg) {
        throw new Error('Não foi possível calcular a rota');
      }

      // Get encoded polyline
      const polyline = result.routes[0].overview_polyline;
      
      const newRouteData: RouteData = {
        polyline: polyline,
        distanceMeters: leg.distance?.value || 0,
        durationSeconds: leg.duration?.value || 0,
        distanceText: leg.distance?.text || '',
        durationText: leg.duration?.text || '',
      };

      // Store in database for sync between client and provider
      const { error: updateError } = await supabase
        .from('chamados')
        .update({
          navigation_phase: phase,
          route_polyline: polyline,
          route_distance_meters: newRouteData.distanceMeters,
          route_duration_seconds: newRouteData.durationSeconds,
        })
        .eq('id', chamadoId);

      if (updateError) {
        console.error('[Navigation] Error saving route to DB:', updateError);
      }

      // Mark as calculated AFTER successful save
      calculatedRef.current = routeKey;
      setRouteData(newRouteData);
      
      console.log('[Navigation] ✅ Route calculated and stored:', {
        phase,
        distance: newRouteData.distanceText,
        duration: newRouteData.durationText,
      });

      return newRouteData;
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao calcular rota';
      console.error('[Navigation] ❌ Route calculation error:', err);
      setError(errorMsg);
      return null;
    } finally {
      setIsCalculating(false);
      calculatingRef.current = false;
    }
  }, []); // AUDIT FIX: Empty dependencies - no need to recreate this function

  const clearRoute = useCallback(() => {
    setRouteData(null);
    calculatedRef.current = '';
    calculatingRef.current = false;
    setError(null);
    console.log('[Navigation] Route cleared for new phase');
  }, []);

  /**
   * Force recalculate route (manual only)
   * Resets the calculated ref to allow one new API call
   */
  const forceRecalculateRoute = useCallback(async (
    origin: Location,
    destination: Location,
    chamadoId: string,
    phase: string
  ): Promise<RouteData | null> => {
    console.log('[Navigation] MANUAL recalculate requested for phase:', phase);
    
    // Reset the calculated ref to allow new calculation
    calculatedRef.current = '';
    
    // Now calculate with the normal function
    return calculateRoute(origin, destination, chamadoId, phase);
  }, [calculateRoute]);

  return {
    routeData,
    isCalculating,
    error,
    calculateRoute,
    forceRecalculateRoute,
    clearRoute,
  };
}
