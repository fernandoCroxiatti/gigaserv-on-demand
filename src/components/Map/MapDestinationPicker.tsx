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
 * Renders as a portal to ensure maximum z-index priority over all app elements
 * Uses a fixed center pin, reverse geocodes only on confirm to minimize API calls
 */
export function MapDestinationPicker({
  initialCenter,
  onConfirm,
  onCancel,
}: MapDestinationPickerProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(
    initialCenter 
      ? { lat: initialCenter.lat, lng: initialCenter.lng }
      : defaultCenter
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Refs to track map movement
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevent body scroll while overlay is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Update center when map is idle (after drag/zoom)
  const handleIdle = useCallback(() => {
    if (!map) return;
    const center = map.getCenter();
    if (center) {
      setMapCenter({ lat: center.lat(), lng: center.lng() });
    }
    
    // End dragging state after small delay
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
    dragTimeoutRef.current = setTimeout(() => {
      setIsDragging(false);
    }, 100);
  }, [map]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
  }, []);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    mapInstance.addListener('idle', handleIdle);
    mapInstance.addListener('dragstart', handleDragStart);
  }, [handleIdle, handleDragStart]);

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
          {/* Fullscreen Map */}
          <div className="flex-1 relative">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={initialCenter ? { lat: initialCenter.lat, lng: initialCenter.lng } : defaultCenter}
              zoom={15}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={mapOptions}
            />
            
            {/* Fixed center pin - always at map center */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10">
              <div className={cn(
                "transition-transform duration-150",
                isDragging ? "scale-110 -translate-y-2" : "scale-100"
              )}>
                <div className="relative">
                  <MapPin 
                    className="w-12 h-12 text-primary drop-shadow-lg" 
                    fill="currentColor"
                    strokeWidth={1.5}
                  />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2.5 h-2.5 bg-primary rounded-full shadow-md" />
                </div>
              </div>
              {/* Shadow under pin */}
              <div className={cn(
                "absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-5 h-1.5 bg-black/20 rounded-full transition-all duration-150",
                isDragging ? "w-4 h-1 opacity-50" : "w-5 h-1.5 opacity-100"
              )} />
            </div>

            {/* Top safe area - Back button + Instructions */}
            <div className="absolute top-0 left-0 right-0 z-20 pt-[env(safe-area-inset-top)] px-4 pb-3 bg-gradient-to-b from-background/95 via-background/80 to-transparent">
              <div className="flex items-center gap-3 pt-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCancel}
                  className="h-11 w-11 rounded-full bg-card shadow-md hover:bg-card/90"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                
                <div className="flex-1 bg-card rounded-xl px-4 py-2.5 shadow-md">
                  <p className="text-sm font-medium text-foreground">Selecione o destino</p>
                  <p className="text-xs text-muted-foreground">Arraste o mapa para escolher o local</p>
                </div>
              </div>
            </div>

            {/* Right side controls - Zoom + Recenter (in safe area) */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={handleZoomIn}
                className="h-10 w-10 rounded-full bg-card shadow-md"
              >
                <span className="text-lg font-bold">+</span>
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={handleZoomOut}
                className="h-10 w-10 rounded-full bg-card shadow-md"
              >
                <span className="text-lg font-bold">−</span>
              </Button>
              <div className="h-2" />
              <Button
                variant="secondary"
                size="icon"
                onClick={handleRecenter}
                className="h-10 w-10 rounded-full bg-card shadow-md"
              >
                <Navigation2 className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Bottom safe area - Confirm button */}
          <div className="bg-card border-t border-border px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              onClick={handleConfirm}
              disabled={isConfirming}
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
