import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { Marker } from '@react-google-maps/api';
import { ServiceType } from '@/types/chamado';

interface ProviderMarkerData {
  id: string;
  location: { lat: number; lng: number };
  name: string;
  services: ServiceType[];
  distance?: number;
}

interface ProviderMarkersProps {
  providers: ProviderMarkerData[];
  animate?: boolean;
}

// Service-specific icons (SVG paths for car/truck icons)
const SERVICE_ICONS: Record<ServiceType, { path: string; color: string; scale: number }> = {
  guincho: {
    // Tow truck icon
    path: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    color: '#EF4444', // Red
    scale: 1.2,
  },
  borracharia: {
    // Tire/wheel icon
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z',
    color: '#F59E0B', // Amber
    scale: 1.0,
  },
  mecanica: {
    // Wrench/tool icon
    path: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
    color: '#3B82F6', // Blue
    scale: 1.0,
  },
  chaveiro: {
    // Key icon
    path: 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
    color: '#10B981', // Green
    scale: 1.0,
  },
};

// Get primary service for icon display
function getPrimaryService(services: ServiceType[]): ServiceType {
  // Prioritize: guincho > mecanica > borracharia > chaveiro
  const priority: ServiceType[] = ['guincho', 'mecanica', 'borracharia', 'chaveiro'];
  for (const service of priority) {
    if (services.includes(service)) return service;
  }
  return 'guincho';
}

// Create SVG icon for Google Maps marker
function createProviderIcon(service: ServiceType): google.maps.Symbol {
  const config = SERVICE_ICONS[service];
  return {
    path: config.path,
    fillColor: config.color,
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 2,
    scale: config.scale,
    anchor: new google.maps.Point(12, 12),
  };
}

/**
 * PROVIDER MARKERS
 * 
 * DESTRUCTIVE RENDERING: Each render completely rebuilds markers.
 * Uses provider array as single source of truth.
 * No local state persistence between renders.
 */

export function ProviderMarkers({ providers, animate = true }: ProviderMarkersProps) {
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const previousPositionsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const currentProviderIdsRef = useRef<Set<string>>(new Set());

  // Cleanup function to remove stale markers
  const cleanupStaleMarkers = useCallback((currentIds: Set<string>) => {
    const toRemove: string[] = [];
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        toRemove.push(id);
      }
    });
    
    toRemove.forEach(id => {
      console.log(`[ProviderMarkers] Removing stale marker: ${id.substring(0, 8)}`);
      markersRef.current.delete(id);
      previousPositionsRef.current.delete(id);
    });
  }, []);

  // DESTRUCTIVE: Update current provider IDs and cleanup on each render
  useEffect(() => {
    const newIds = new Set(providers.map(p => p.id));
    cleanupStaleMarkers(newIds);
    currentProviderIdsRef.current = newIds;
    
    console.log(`[ProviderMarkers] Rendering ${providers.length} markers`);
  }, [providers, cleanupStaleMarkers]);

  // Animate marker movement
  useEffect(() => {
    if (!animate) return;

    providers.forEach((provider) => {
      const marker = markersRef.current.get(provider.id);
      const prevPosition = previousPositionsRef.current.get(provider.id);
      
      if (marker && prevPosition) {
        const currentPos = provider.location;
        
        // Only animate if position changed
        if (prevPosition.lat !== currentPos.lat || prevPosition.lng !== currentPos.lng) {
          animateMarker(marker, prevPosition, currentPos);
        }
      }
      
      previousPositionsRef.current.set(provider.id, { ...provider.location });
    });
  }, [providers, animate]);

  // Smooth animation between positions
  const animateMarker = useCallback((
    marker: google.maps.Marker,
    start: { lat: number; lng: number },
    end: { lat: number; lng: number }
  ) => {
    const frames = 30;
    let frame = 0;

    const doAnimate = () => {
      frame++;
      const progress = frame / frames;
      const easeProgress = easeInOutQuad(progress);

      const lat = start.lat + (end.lat - start.lat) * easeProgress;
      const lng = start.lng + (end.lng - start.lng) * easeProgress;

      marker.setPosition({ lat, lng });

      if (frame < frames) {
        requestAnimationFrame(doAnimate);
      }
    };

    requestAnimationFrame(doAnimate);
  }, []);

  // Easing function for smooth animation
  const easeInOutQuad = (t: number): number => {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  };

  // Memoize icon creation
  const getIcon = useMemo(() => {
    const iconCache = new Map<ServiceType, google.maps.Symbol>();
    return (service: ServiceType): google.maps.Symbol => {
      if (!iconCache.has(service)) {
        iconCache.set(service, createProviderIcon(service));
      }
      return iconCache.get(service)!;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[ProviderMarkers] Unmount - clearing all markers');
      markersRef.current.clear();
      previousPositionsRef.current.clear();
      currentProviderIdsRef.current.clear();
    };
  }, []);

  return (
    <>
      {providers.map((provider) => {
        const primaryService = getPrimaryService(provider.services);
        return (
          <Marker
            key={provider.id}
            position={{ lat: provider.location.lat, lng: provider.location.lng }}
            icon={getIcon(primaryService)}
            title={`${provider.name} - ${provider.distance?.toFixed(1) || '?'}km`}
            onLoad={(marker) => {
              markersRef.current.set(provider.id, marker);
              previousPositionsRef.current.set(provider.id, { ...provider.location });
            }}
            onUnmount={() => {
              markersRef.current.delete(provider.id);
              previousPositionsRef.current.delete(provider.id);
            }}
            animation={google.maps.Animation.DROP}
          />
        );
      })}
    </>
  );
}
