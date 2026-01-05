import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Location } from '@/types/chamado';
import { Loader2, AlertCircle, MapPin, ArrowLeft, Check, Navigation2 } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface MapDestinationPickerProps {
  initialCenter?: Location | null;
  onConfirm: (location: Location) => void;
  onCancel: () => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: false, // We'll position our own
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  gestureHandling: 'greedy',
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'transit',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

const defaultCenter = { lat: -23.5505, lng: -46.6333 }; // São Paulo

/**
 * MapDestinationPicker - Fullscreen overlay for selecting destination on map
 * 
 * CAMERA LOCK RULES (MAXIMUM PRIORITY):
 * =====================================
 * This component implements a complete "camera lock" that blocks ALL automatic
 * camera movement from ANY source while the picker is active.
 * 
 * BLOCKED sources of camera movement:
 * - GPS location updates (user or provider)
 * - Origin field changes
 * - Address validation changes
 * - Form re-renders or state updates
 * - "Use my location" triggers from parent
 * - Navigation state changes
 * - Any prop changes from parent component
 * 
 * ALLOWED camera movement:
 * - User gestures (drag, pinch, zoom)
 * - Explicit "Recenter" button click (user-initiated)
 * 
 * IMPLEMENTATION:
 * - Creates completely NEW, INDEPENDENT GoogleMap instance
 * - Uses STATIC center computed ONCE on mount (stored in ref, never updated by props)
 * - Rendered via portal at document.body level to bypass all parent re-renders
 * - NO auto-centering, NO follow-user, NO GPS listeners
 * - Map center controlled EXCLUSIVELY by user gestures
 * - Ignores ALL prop updates after initial mount
 * 
 * On exit (confirm/cancel): Parent component restores normal map behavior
 */
export function MapDestinationPicker({
  initialCenter,
  onConfirm,
  onCancel,
}: MapDestinationPickerProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  
  // CAMERA LOCK: Static center computed ONCE on mount, stored in ref
  // This ref NEVER changes after mount, ensuring complete isolation from prop updates
  const staticCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  
  // Initialize static center on first render only (lazy initialization)
  if (staticCenterRef.current === null) {
    staticCenterRef.current = initialCenter 
      ? { lat: initialCenter.lat, lng: initialCenter.lng }
      : defaultCenter;
  }
  
  // Current map center (updated by user gestures, NOT by props)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(
    () => staticCenterRef.current || defaultCenter
  );
  
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Flag to ensure we don't process any external updates after mount
  const isActiveRef = useRef(true);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevent body scroll and mark picker as active
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    isActiveRef.current = true;
    
    console.log('[MapDestinationPicker] Activated - map control isolated from all external state');
    
    return () => {
      document.body.style.overflow = originalOverflow;
      isActiveRef.current = false;
      console.log('[MapDestinationPicker] Deactivated - restoring normal map behavior');
    };
  }, []);

  // On map load - set up isolated instance with NO external listeners
  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    
    // Trigger initial geocode for starting position
    const center = mapInstance.getCenter();
    if (center) {
      const initialCenter = { lat: center.lat(), lng: center.lng() };
      console.log('[MapDestinationPicker] Initial center:', initialCenter);
      setMapCenter(initialCenter);
    }
    
    // Only listen to user-initiated events (drag, idle)
    // NO geolocation watchers, NO auto-center logic
    mapInstance.addListener('idle', () => {
      if (!isActiveRef.current) return;
      const c = mapInstance.getCenter();
      if (c) {
        const newCenter = { lat: c.lat(), lng: c.lng() };
        console.log('[MapDestinationPicker] Map idle - center:', newCenter);
        setMapCenter(newCenter);
        
        // End dragging state
        if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current) setIsDragging(false);
        }, 100);
      }
    });
    
    mapInstance.addListener('dragstart', () => {
      if (!isActiveRef.current) return;
      setIsDragging(true);
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    });
    
    console.log('[MapDestinationPicker] Map loaded - user gesture control only');
  }, []);

  const onUnmount = useCallback(() => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
    setMap(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, []);

  const handleConfirm = useCallback(async () => {
    if (isConfirming || !mapCenter) return;
    
    setIsConfirming(true);
    
    try {
      // Reverse geocode the selected location
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: mapCenter });
      const address = response.results[0]?.formatted_address || `${mapCenter.lat.toFixed(6)}, ${mapCenter.lng.toFixed(6)}`;
      
      onConfirm({
        lat: mapCenter.lat,
        lng: mapCenter.lng,
        address,
      });
    } catch (error) {
      console.error('[MapDestinationPicker] Geocode error:', error);
      // Fallback to coords as address
      onConfirm({
        lat: mapCenter.lat,
        lng: mapCenter.lng,
        address: `${mapCenter.lat.toFixed(6)}, ${mapCenter.lng.toFixed(6)}`,
      });
    } finally {
      setIsConfirming(false);
    }
  }, [mapCenter, onConfirm, isConfirming]);

  const handleRecenter = useCallback(() => {
    if (!map || !navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const center = { lat: position.coords.latitude, lng: position.coords.longitude };
        map.panTo(center);
        setMapCenter(center);
      },
      (error) => console.error('Geolocation error:', error)
    );
  }, [map]);

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    map.setZoom((map.getZoom() || 15) + 1);
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    map.setZoom((map.getZoom() || 15) - 1);
  }, [map]);

  // State for resolved address
  const [resolvedAddress, setResolvedAddress] = useState<string>('');
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize geocoder
  useEffect(() => {
    if (isLoaded && !geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
  }, [isLoaded]);

  // Reverse geocode on map center change (debounced)
  useEffect(() => {
    if (!geocoderRef.current || !mapCenter) return;

    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }

    geocodeTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await geocoderRef.current!.geocode({ location: mapCenter });
        if (response.results[0]) {
          setResolvedAddress(response.results[0].formatted_address);
        }
      } catch (error) {
        console.error('[MapDestinationPicker] Geocode error:', error);
      }
    }, 300);

    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, [mapCenter]);

  // Render as portal to ensure maximum z-index
  const overlayContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-background flex flex-col"
      style={{ touchAction: 'none' }}
    >
      {/* Loading state */}
      {loadError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-6">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="font-medium text-destructive">Erro ao carregar mapa</p>
          </div>
        </div>
      )}

      {!isLoaded && !loadError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Carregando mapa...</p>
          </div>
        </div>
      )}

      {isLoaded && !loadError && (
        <>
          {/* Fullscreen Map - CAMERA LOCK: center uses static ref, NOT props */}
          <div className="flex-1 relative">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={staticCenterRef.current}
              zoom={16}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={mapOptions}
            />
            
            {/* Fixed center pin - always at map center */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10">
              <div className={cn(
                "transition-transform duration-150",
                isDragging ? "scale-110 -translate-y-3" : "scale-100"
              )}>
                <div className="relative">
                  <MapPin 
                    className="w-14 h-14 text-primary drop-shadow-lg" 
                    fill="currentColor"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
              {/* Shadow under pin */}
              <div className={cn(
                "absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 w-6 h-2 bg-black/30 rounded-full blur-sm transition-all duration-150",
                isDragging ? "w-4 h-1.5 opacity-50" : "w-6 h-2 opacity-100"
              )} />
            </div>

            {/* Instructional overlay - centered above pin */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(100%+4rem)] pointer-events-none z-10">
              <div className={cn(
                "bg-foreground/90 text-background px-4 py-2 rounded-full shadow-lg transition-opacity duration-200",
                isDragging ? "opacity-0" : "opacity-100"
              )}>
                <p className="text-sm font-medium whitespace-nowrap">Arraste o mapa para ajustar</p>
              </div>
            </div>

            {/* Top safe area - Back button only */}
            <div className="absolute top-0 left-0 right-0 z-20 pt-[env(safe-area-inset-top)] px-4">
              <div className="flex items-center gap-3 pt-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCancel}
                  className="h-12 w-12 rounded-full bg-card shadow-lg hover:bg-card/90"
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>
              </div>
            </div>

            {/* Right side controls - Zoom + Recenter */}
            <div className="absolute right-4 bottom-[180px] z-20 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={handleZoomIn}
                className="h-11 w-11 rounded-full bg-card shadow-lg border border-border"
              >
                <span className="text-xl font-bold">+</span>
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={handleZoomOut}
                className="h-11 w-11 rounded-full bg-card shadow-lg border border-border"
              >
                <span className="text-xl font-bold">−</span>
              </Button>
              <div className="h-1" />
              <Button
                variant="secondary"
                size="icon"
                onClick={handleRecenter}
                className="h-11 w-11 rounded-full bg-card shadow-lg border border-border"
              >
                <Navigation2 className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Bottom safe area - Address + Confirm button */}
          <div className="bg-card border-t border-border px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            {/* Resolved address display */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Destino selecionado</p>
                <p className="text-sm font-medium text-foreground line-clamp-2">
                  {resolvedAddress || 'Movendo mapa...'}
                </p>
              </div>
            </div>

            <Button
              onClick={handleConfirm}
              disabled={isConfirming || !resolvedAddress}
              className="w-full h-14 text-base font-semibold rounded-xl shadow-md"
              size="lg"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Confirmando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Confirmar destino
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  // Use portal to render at document root level, above everything
  return createPortal(overlayContent, document.body);
}

export { MapDestinationPicker as default };
