import { useState, useEffect, useCallback, useRef } from 'react';
import { Location } from '@/types/chamado';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistance } from '@/lib/distance';

/**
 * Active ride statuses that enable automatic tracking mode
 */
const ACTIVE_RIDE_STATUSES = [
  'accepted',
  'negotiating', 
  'awaiting_payment',
  'in_service',
  'pending_client_confirmation'
];

/**
 * Inactive statuses that disable tracking mode
 */
const INACTIVE_RIDE_STATUSES = [
  'finished',
  'canceled',
  'idle',
  null
];

interface RideTrackingState {
  /** Is there an active ride being tracked? */
  isActiveRide: boolean;
  /** Current ride mode - provider tracks own GPS, client tracks provider */
  mode: 'provider' | 'client' | 'idle';
  /** Provider's current location (for both modes) */
  providerLocation: Location | null;
  /** Client's location (origin of the ride) */
  clientLocation: Location | null;
  /** Destination location */
  destinationLocation: Location | null;
  /** Elapsed time since ride started (in seconds) */
  elapsedTime: number;
  /** Distance traveled (in km) */
  distanceTraveled: number;
  /** Estimated price based on distance/time */
  estimatedPrice: number | null;
  /** Origin address */
  originAddress: string | null;
  /** Destination address */
  destinationAddress: string | null;
  /** Ride ID */
  rideId: string | null;
  /** Ride status */
  rideStatus: string | null;
  /** Provider name */
  providerName: string | null;
  /** Client name */
  clientName: string | null;
  /** Last position update timestamp */
  lastUpdate: Date | null;
}

interface UseRideTrackingOptions {
  /** Polling interval for ride status in ms (default: 10000) */
  statusPollingInterval?: number;
  /** Location update interval in ms (default: 5000) */
  locationUpdateInterval?: number;
}

/**
 * Hook for automatic ride tracking during active services.
 * 
 * Features:
 * - Automatic detection of active ride status
 * - Provider mode: Uses watchPosition for real-time GPS
 * - Client mode: Fetches provider location from database
 * - Calculates elapsed time, distance traveled
 * - Updates database with provider location (provider mode only)
 * 
 * @param options Configuration options
 */
export function useRideTracking(options: UseRideTrackingOptions = {}) {
  const {
    statusPollingInterval = 10000,
    locationUpdateInterval = 5000,
  } = options;

  const { chamado, user, profile, providerData } = useApp();
  
  const [state, setState] = useState<RideTrackingState>({
    isActiveRide: false,
    mode: 'idle',
    providerLocation: null,
    clientLocation: null,
    destinationLocation: null,
    elapsedTime: 0,
    distanceTraveled: 0,
    estimatedPrice: null,
    originAddress: null,
    destinationAddress: null,
    rideId: null,
    rideStatus: null,
    providerName: null,
    clientName: null,
    lastUpdate: null,
  });

  // Refs for tracking
  const watchIdRef = useRef<number | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousLocationsRef = useRef<Location[]>([]);
  const rideStartTimeRef = useRef<Date | null>(null);

  /**
   * Determine user mode based on profile
   */
  const getUserMode = useCallback((): 'provider' | 'client' | 'idle' => {
    if (!profile) return 'idle';
    return profile.active_profile === 'provider' ? 'provider' : 'client';
  }, [profile]);

  /**
   * Check if current chamado status is active
   */
  const isActiveStatus = useCallback((status: string | null): boolean => {
    if (!status) return false;
    return ACTIVE_RIDE_STATUSES.includes(status);
  }, []);

  /**
   * Calculate total distance from location history
   */
  const calculateTotalDistance = useCallback((locations: Location[]): number => {
    if (locations.length < 2) return 0;
    
    let total = 0;
    for (let i = 1; i < locations.length; i++) {
      total += calculateDistance(
        locations[i - 1].lat,
        locations[i - 1].lng,
        locations[i].lat,
        locations[i].lng
      );
    }
    return Math.round(total * 10) / 10; // Round to 1 decimal
  }, []);

  /**
   * Update provider location in database (provider mode only)
   */
  const updateProviderLocationInDb = useCallback(async (location: Location) => {
    if (!user?.id || getUserMode() !== 'provider') return;

    try {
      await supabase
        .from('provider_data')
        .update({
          current_lat: location.lat,
          current_lng: location.lng,
          current_address: location.address,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('[RideTracking] Error updating provider location:', error);
    }
  }, [user?.id, getUserMode]);

  /**
   * Fetch provider location from database (client mode)
   */
  const fetchProviderLocation = useCallback(async (providerId: string): Promise<Location | null> => {
    try {
      const { data, error } = await supabase
        .from('provider_data')
        .select('current_lat, current_lng, current_address')
        .eq('user_id', providerId)
        .maybeSingle();

      if (error || !data || !data.current_lat || !data.current_lng) {
        return null;
      }

      return {
        lat: Number(data.current_lat),
        lng: Number(data.current_lng),
        address: data.current_address || 'Localização do prestador',
      };
    } catch (error) {
      console.error('[RideTracking] Error fetching provider location:', error);
      return null;
    }
  }, []);

  /**
   * Fetch provider name
   */
  const fetchProviderName = useCallback(async (providerId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', providerId)
        .maybeSingle();

      return data?.name || null;
    } catch {
      return null;
    }
  }, []);

  /**
   * Fetch client name
   */
  const fetchClientName = useCallback(async (clientId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', clientId)
        .maybeSingle();

      return data?.name || null;
    } catch {
      return null;
    }
  }, []);

  /**
   * Start GPS tracking (provider mode only)
   */
  const startProviderTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.error('[RideTracking] Geolocation not supported');
      return;
    }

    // Clear existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    console.log('[RideTracking] Starting provider GPS tracking (watchPosition)');

    // Use watchPosition for continuous real-time tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const newLocation: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: '',
        };

        // Add to history for distance calculation (only if moved > 10m)
        const lastLocation = previousLocationsRef.current[previousLocationsRef.current.length - 1];
        if (!lastLocation || calculateDistance(
          lastLocation.lat, lastLocation.lng,
          newLocation.lat, newLocation.lng
        ) > 0.01) { // > 10 meters
          previousLocationsRef.current.push(newLocation);
        }

        // Calculate total distance
        const totalDistance = calculateTotalDistance(previousLocationsRef.current);

        // Update state
        setState(prev => ({
          ...prev,
          providerLocation: newLocation,
          distanceTraveled: totalDistance,
          lastUpdate: new Date(),
        }));

        // Update database
        await updateProviderLocationInDb(newLocation);
      },
      (error) => {
        console.error('[RideTracking] GPS error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  }, [calculateTotalDistance, updateProviderLocationInDb]);

  /**
   * Stop GPS tracking
   */
  const stopProviderTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      console.log('[RideTracking] Stopped provider GPS tracking');
    }
  }, []);

  /**
   * Start client mode - periodically fetch provider location
   */
  const startClientTracking = useCallback((providerId: string) => {
    console.log('[RideTracking] Starting client tracking mode');

    // Clear existing interval
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
    }

    // Fetch immediately
    const fetchAndUpdate = async () => {
      const location = await fetchProviderLocation(providerId);
      if (location) {
        // Add to history for distance calculation
        const lastLocation = previousLocationsRef.current[previousLocationsRef.current.length - 1];
        if (!lastLocation || calculateDistance(
          lastLocation.lat, lastLocation.lng,
          location.lat, location.lng
        ) > 0.01) {
          previousLocationsRef.current.push(location);
        }

        const totalDistance = calculateTotalDistance(previousLocationsRef.current);

        setState(prev => ({
          ...prev,
          providerLocation: location,
          distanceTraveled: totalDistance,
          lastUpdate: new Date(),
        }));
      }
    };

    fetchAndUpdate();

    // Set up interval for periodic updates
    locationIntervalRef.current = setInterval(fetchAndUpdate, locationUpdateInterval);
  }, [fetchProviderLocation, locationUpdateInterval, calculateTotalDistance]);

  /**
   * Stop client tracking
   */
  const stopClientTracking = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
      console.log('[RideTracking] Stopped client tracking mode');
    }
  }, []);

  /**
   * Start elapsed time counter
   */
  const startElapsedTimer = useCallback((startTime: Date) => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
    }

    rideStartTimeRef.current = startTime;

    const updateElapsed = () => {
      if (rideStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - rideStartTimeRef.current.getTime()) / 1000);
        setState(prev => ({ ...prev, elapsedTime: elapsed }));
      }
    };

    updateElapsed();
    elapsedIntervalRef.current = setInterval(updateElapsed, 1000);
  }, []);

  /**
   * Stop elapsed timer
   */
  const stopElapsedTimer = useCallback(() => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
    rideStartTimeRef.current = null;
  }, []);

  /**
   * Main effect: Monitor chamado status and activate/deactivate tracking
   */
  useEffect(() => {
    const mode = getUserMode();
    const isActive = chamado && isActiveStatus(chamado.status);

    if (isActive && chamado) {
      console.log('[RideTracking] Active ride detected:', chamado.id, chamado.status);

      // Reset distance history when starting new ride
      if (state.rideId !== chamado.id) {
        previousLocationsRef.current = [];
      }

      // Fetch names
      const loadNames = async () => {
        let providerName: string | null = null;
        let clientName: string | null = null;

        if (chamado.prestadorId) {
          providerName = await fetchProviderName(chamado.prestadorId);
        }
        if (chamado.clienteId) {
          clientName = await fetchClientName(chamado.clienteId);
        }

        setState(prev => ({
          ...prev,
          providerName,
          clientName,
        }));
      };
      loadNames();

      // Update state with ride info
      setState(prev => ({
        ...prev,
        isActiveRide: true,
        mode,
        clientLocation: chamado.origem,
        destinationLocation: chamado.destino,
        originAddress: chamado.origem?.address || null,
        destinationAddress: chamado.destino?.address || null,
        rideId: chamado.id,
        rideStatus: chamado.status,
        estimatedPrice: chamado.valor || chamado.valorProposto || null,
      }));

      // Start elapsed timer
      startElapsedTimer(chamado.createdAt);

      // Start appropriate tracking mode
      if (mode === 'provider') {
        startProviderTracking();
      } else if (mode === 'client' && chamado.prestadorId) {
        startClientTracking(chamado.prestadorId);
      }
    } else {
      // No active ride - stop all tracking
      console.log('[RideTracking] No active ride, stopping tracking');

      stopProviderTracking();
      stopClientTracking();
      stopElapsedTimer();

      setState({
        isActiveRide: false,
        mode: 'idle',
        providerLocation: null,
        clientLocation: null,
        destinationLocation: null,
        elapsedTime: 0,
        distanceTraveled: 0,
        estimatedPrice: null,
        originAddress: null,
        destinationAddress: null,
        rideId: null,
        rideStatus: null,
        providerName: null,
        clientName: null,
        lastUpdate: null,
      });

      previousLocationsRef.current = [];
    }

    return () => {
      stopProviderTracking();
      stopClientTracking();
      stopElapsedTimer();
    };
  }, [
    chamado?.id,
    chamado?.status,
    chamado?.prestadorId,
    getUserMode,
    isActiveStatus,
    startProviderTracking,
    stopProviderTracking,
    startClientTracking,
    stopClientTracking,
    startElapsedTimer,
    stopElapsedTimer,
    fetchProviderName,
    fetchClientName,
  ]);

  /**
   * Manual refresh function for getting fresh position
   */
  const refreshLocation = useCallback(() => {
    const mode = getUserMode();
    
    if (mode === 'provider') {
      // Get fresh GPS position
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const newLocation: Location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              address: '',
            };
            setState(prev => ({
              ...prev,
              providerLocation: newLocation,
              lastUpdate: new Date(),
            }));
            await updateProviderLocationInDb(newLocation);
          },
          (error) => console.error('[RideTracking] Refresh error:', error),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    } else if (mode === 'client' && chamado?.prestadorId) {
      // Fetch fresh provider location
      fetchProviderLocation(chamado.prestadorId).then(location => {
        if (location) {
          setState(prev => ({
            ...prev,
            providerLocation: location,
            lastUpdate: new Date(),
          }));
        }
      });
    }
  }, [getUserMode, chamado?.prestadorId, fetchProviderLocation, updateProviderLocationInDb]);

  return {
    ...state,
    refreshLocation,
  };
}
