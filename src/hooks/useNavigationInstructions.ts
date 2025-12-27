import { useState, useEffect, useCallback, useRef } from 'react';
import { Location } from '@/types/chamado';

export interface NavigationInstruction {
  icon: 'straight' | 'turn_left' | 'turn_right' | 'slight_left' | 'slight_right' | 'sharp_left' | 'sharp_right' | 'uturn_left' | 'uturn_right' | 'merge' | 'roundabout' | 'arrive' | 'depart';
  text: string;
  streetName: string;
  distance: string;
  distanceMeters: number;
}

export interface NavigationState {
  currentInstruction: NavigationInstruction | null;
  nextInstruction: NavigationInstruction | null;
  instructions: NavigationInstruction[];
  eta: string;
  etaSeconds: number;
  distance: string;
  distanceMeters: number;
  progress: number; // 0-100
  isOffRoute: boolean;
  clientStatus: 'a_caminho' | 'chegando' | 'no_local' | 'em_transito' | 'destino_final';
}

// Navigation phase types (supports both old and new naming)
type NavigationPhase = 'to_client' | 'at_client' | 'to_destination' | 'finished' | 'going_to_vehicle' | 'going_to_destination';

interface UseNavigationInstructionsOptions {
  providerLocation: Location | null;
  destination: Location | null;
  phase: NavigationPhase;
  isProvider: boolean;
}

// Normalize phase to handle both old and new naming
function normalizePhaseForStatus(phase: NavigationPhase): 'going_to_vehicle' | 'going_to_destination' {
  if (phase === 'to_client' || phase === 'going_to_vehicle' || phase === 'at_client') {
    return 'going_to_vehicle';
  }
  return 'going_to_destination';
}

/**
 * Hook to get turn-by-turn navigation instructions and status
 */
export function useNavigationInstructions({
  providerLocation,
  destination,
  phase,
  isProvider,
}: UseNavigationInstructionsOptions): NavigationState {
  const [state, setState] = useState<NavigationState>({
    currentInstruction: null,
    nextInstruction: null,
    instructions: [],
    eta: '',
    etaSeconds: 0,
    distance: '',
    distanceMeters: 0,
    progress: 0,
    isOffRoute: false,
    clientStatus: 'a_caminho',
  });

  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const lastCalculationRef = useRef<string>('');
  const initialDistanceRef = useRef<number>(0);
  const lastPhaseRef = useRef<string>(phase);
  
  // CRITICAL: Reset initial distance when phase changes (e.g., to_destination for guincho)
  useEffect(() => {
    if (lastPhaseRef.current !== phase) {
      console.log('[NavigationInstructions] Phase changed from', lastPhaseRef.current, 'to', phase, '- resetting distance tracking');
      initialDistanceRef.current = 0;
      lastCalculationRef.current = '';
      lastPhaseRef.current = phase;
      
      // Reset state for new phase
      setState(prev => ({
        ...prev,
        eta: '',
        etaSeconds: 0,
        distance: '',
        distanceMeters: 0,
        progress: 0,
        clientStatus: phase === 'to_destination' || phase === 'going_to_destination' ? 'em_transito' : 'a_caminho',
      }));
    }
  }, [phase]);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((from: Location, to: Location): number => {
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
  }, []);

  // Parse maneuver to icon type
  const parseManeuver = useCallback((maneuver: string | undefined): NavigationInstruction['icon'] => {
    if (!maneuver) return 'straight';
    
    const maneuverMap: Record<string, NavigationInstruction['icon']> = {
      'turn-left': 'turn_left',
      'turn-right': 'turn_right',
      'turn-slight-left': 'slight_left',
      'turn-slight-right': 'slight_right',
      'turn-sharp-left': 'sharp_left',
      'turn-sharp-right': 'sharp_right',
      'uturn-left': 'uturn_left',
      'uturn-right': 'uturn_right',
      'merge': 'merge',
      'roundabout-left': 'roundabout',
      'roundabout-right': 'roundabout',
      'straight': 'straight',
      'ferry': 'straight',
    };

    return maneuverMap[maneuver] || 'straight';
  }, []);

  // Extract street name from instruction HTML
  const extractStreetName = useCallback((instructionHtml: string): string => {
    // Remove HTML tags and extract destination street
    const text = instructionHtml.replace(/<[^>]*>/g, '');
    
    // Try to find "para" or "em" followed by street name
    const match = text.match(/(?:para|em|na|pela)\s+(.+?)(?:\s*$)/i);
    if (match) return match[1];
    
    // Fallback: return cleaned text
    return text.slice(0, 50);
  }, []);

  // Get client status based on distance and phase
  const getClientStatus = useCallback((distanceMeters: number, currentPhase: NavigationPhase): NavigationState['clientStatus'] => {
    const normalizedPhase = normalizePhaseForStatus(currentPhase);
    if (normalizedPhase === 'going_to_vehicle') {
      if (distanceMeters <= 50) return 'no_local';
      if (distanceMeters <= 200) return 'chegando';
      return 'a_caminho';
    } else {
      if (distanceMeters <= 50) return 'destino_final';
      if (distanceMeters <= 200) return 'chegando';
      return 'em_transito';
    }
  }, []);

  // Calculate and update navigation
  useEffect(() => {
    if (!providerLocation || !destination) return;
    
    // Check if Google Maps is available
    if (typeof google === 'undefined' || !google.maps) {
      console.log('[NavigationInstructions] Google Maps not loaded yet');
      return;
    }

    const calculateKey = `${providerLocation.lat.toFixed(4)},${providerLocation.lng.toFixed(4)}`;
    
    // Throttle calculations - only recalculate if moved significantly
    if (lastCalculationRef.current === calculateKey) return;
    lastCalculationRef.current = calculateKey;

    // Calculate direct distance for status
    const directDistance = calculateDistance(providerLocation, destination);
    
    // Update status based on direct distance (normalize phase for status calculation)
    const clientStatus = getClientStatus(directDistance, phase);
    
    // Set initial distance if not set
    if (initialDistanceRef.current === 0) {
      initialDistanceRef.current = directDistance;
    }
    
    // Calculate progress
    const progress = initialDistanceRef.current > 0 
      ? Math.max(0, Math.min(100, 100 - (directDistance / initialDistanceRef.current * 100)))
      : 0;
    
    // Format distance and ETA for immediate update (estimates)
    const estimatedSpeedKmH = 40; // Average city speed
    const etaSeconds = Math.ceil((directDistance / 1000) / estimatedSpeedKmH * 3600);
    const etaMinutes = Math.ceil(etaSeconds / 60);
    
    setState(prev => ({
      ...prev,
      clientStatus,
      distanceMeters: directDistance,
      distance: directDistance < 1000 
        ? `${Math.round(directDistance)} m` 
        : `${(directDistance / 1000).toFixed(1)} km`,
      progress,
      // Provide estimated ETA if not calculated yet
      eta: prev.eta || (etaMinutes < 60 ? `${etaMinutes} min` : `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}min`),
      etaSeconds: prev.etaSeconds || etaSeconds,
    }));

    // Only calculate detailed instructions for provider
    if (!isProvider) return;

    // Initialize directions service
    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new google.maps.DirectionsService();
    }

    // Get detailed route with steps
    directionsServiceRef.current.route({
      origin: { lat: providerLocation.lat, lng: providerLocation.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: google.maps.TravelMode.DRIVING,
    }).then(result => {
      const leg = result.routes[0]?.legs[0];
      if (!leg || !leg.steps) return;

      // Set initial distance for progress calculation
      if (initialDistanceRef.current === 0) {
        initialDistanceRef.current = leg.distance?.value || 0;
      }

      // Parse instructions
      const instructions: NavigationInstruction[] = leg.steps.map(step => ({
        icon: parseManeuver(step.maneuver),
        text: step.instructions?.replace(/<[^>]*>/g, '') || '',
        streetName: extractStreetName(step.instructions || ''),
        distance: step.distance?.text || '',
        distanceMeters: step.distance?.value || 0,
      }));

      // Add arrival instruction
      const isGoingToClient = phase === 'going_to_vehicle' || phase === 'to_client';
      instructions.push({
        icon: 'arrive',
        text: isGoingToClient ? 'Chegou ao veículo' : 'Chegou ao destino',
        streetName: destination.address || 'Destino',
        distance: '',
        distanceMeters: 0,
      });

      setState(prev => ({
        ...prev,
        currentInstruction: instructions[0] || null,
        nextInstruction: instructions[1] || null,
        instructions,
        eta: leg.duration?.text || '',
        etaSeconds: leg.duration?.value || 0,
        distance: leg.distance?.text || '',
        distanceMeters: leg.distance?.value || 0,
        isOffRoute: false,
      }));
    }).catch(err => {
      console.error('[Navigation] Error getting instructions:', err);
    });

  }, [providerLocation, destination, phase, isProvider, calculateDistance, getClientStatus, parseManeuver, extractStreetName]);

  return state;
}

/**
 * Get human-readable status text for client
 */
export function getClientStatusText(status: NavigationState['clientStatus'], phase: string, serviceType: string): string {
  const statusMap: Record<NavigationState['clientStatus'], string> = {
    'a_caminho': 'Prestador a caminho',
    'chegando': 'Prestador chegando',
    'no_local': 'Prestador no local',
    'em_transito': serviceType === 'guincho' ? 'Veículo em transporte' : 'Serviço em andamento',
    'destino_final': 'Chegando ao destino final',
  };
  
  return statusMap[status] || 'Em atendimento';
}

/**
 * Get icon name for navigation instruction
 */
export function getInstructionIconName(icon: NavigationInstruction['icon']): string {
  const iconMap: Record<NavigationInstruction['icon'], string> = {
    'straight': 'ArrowUp',
    'turn_left': 'CornerUpLeft',
    'turn_right': 'CornerUpRight',
    'slight_left': 'ArrowUpLeft',
    'slight_right': 'ArrowUpRight',
    'sharp_left': 'CornerLeftDown',
    'sharp_right': 'CornerRightDown',
    'uturn_left': 'RotateCcw',
    'uturn_right': 'RotateCw',
    'merge': 'GitMerge',
    'roundabout': 'RefreshCw',
    'arrive': 'MapPin',
    'depart': 'Navigation',
  };
  
  return iconMap[icon] || 'ArrowUp';
}
