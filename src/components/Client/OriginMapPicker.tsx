import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '../Map/GoogleMapsProvider';
import { Location } from '@/types/chamado';
import { Loader2, AlertCircle, MapPin, ArrowLeft, Check, Navigation2, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface OriginMapPickerProps {
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
  zoomControl: false,
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
 * OriginMapPicker - Fullscreen overlay for selecting origin on map (Uber-style)
 * 
 * Features:
 * - Map as main element (occupies most of the screen)
 * - Fixed center pin that user drags map to position
 * - Search field at top for quick address lookup
 * - Dynamic address resolution in footer
 * - Clear instructional text
 */
export function OriginMapPicker({
  initialCenter,
  onConfirm,
  onCancel,
}: OriginMapPickerProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  
  // Static center computed ONCE on mount
  const staticCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  if (staticCenterRef.current === null) {
    staticCenterRef.current = initialCenter 
      ? { lat: initialCenter.lat, lng: initialCenter.lng }
      : defaultCenter;
  }
  
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(
    () => staticCenterRef.current || defaultCenter
  );
  
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string>('');
  const [searchValue, setSearchValue] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  
  const isActiveRef = useRef(true);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize services
  useEffect(() => {
    if (isLoaded) {
      if (!geocoderRef.current) {
        geocoderRef.current = new google.maps.Geocoder();
      }
      if (!autocompleteService.current) {
        autocompleteService.current = new google.maps.places.AutocompleteService();
      }
    }
  }, [isLoaded]);

  // Prevent body scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    isActiveRef.current = true;
    
    return () => {
      document.body.style.overflow = originalOverflow;
      isActiveRef.current = false;
    };
  }, []);

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
        console.error('[OriginMapPicker] Geocode error:', error);
      }
    }, 300);

    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, [mapCenter]);

  // Search predictions
  useEffect(() => {
    if (!searchValue.trim() || !autocompleteService.current) {
      setPredictions([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      autocompleteService.current!.getPlacePredictions(
        {
          input: searchValue,
          componentRestrictions: { country: 'br' },
        },
        (preds, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            setPredictions(preds || []);
          } else {
            setPredictions([]);
          }
        }
      );
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchValue]);

  const handleIdle = useCallback(() => {
    if (!map || !isActiveRef.current) return;
    
    const center = map.getCenter();
    if (center) {
      setMapCenter({ lat: center.lat(), lng: center.lng() });
    }
    
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
    dragTimeoutRef.current = setTimeout(() => {
      if (isActiveRef.current) {
        setIsDragging(false);
      }
    }, 100);
  }, [map]);

  const handleDragStart = useCallback(() => {
    if (!isActiveRef.current) return;
    setIsDragging(true);
    setShowPredictions(false);
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
  }, []);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    mapInstance.addListener('idle', handleIdle);
    mapInstance.addListener('dragstart', handleDragStart);
    
    // Initialize places service
    const dummyDiv = document.createElement('div');
    placesService.current = new google.maps.places.PlacesService(dummyDiv);
  }, [handleIdle, handleDragStart]);

  const onUnmount = useCallback(() => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
    setMap(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (isConfirming || !mapCenter || !resolvedAddress) return;
    
    setIsConfirming(true);
    
    onConfirm({
      lat: mapCenter.lat,
      lng: mapCenter.lng,
      address: resolvedAddress,
    });
    
    setIsConfirming(false);
  }, [mapCenter, resolvedAddress, onConfirm, isConfirming]);

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

  const handleSelectPrediction = useCallback((prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService.current || !map) return;

    placesService.current.getDetails(
      { placeId: prediction.place_id, fields: ['geometry', 'formatted_address'] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const newCenter = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };
          map.panTo(newCenter);
          setMapCenter(newCenter);
          setResolvedAddress(place.formatted_address || prediction.description);
        }
        setShowPredictions(false);
        setSearchValue('');
        inputRef.current?.blur();
      }
    );
  }, [map]);

  const overlayContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-background flex flex-col"
      style={{ touchAction: 'none' }}
    >
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
              center={staticCenterRef.current}
              zoom={16}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={mapOptions}
            />
            
            {/* Fixed center pin */}
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
              <div className={cn(
                "absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 w-6 h-2 bg-black/30 rounded-full blur-sm transition-all duration-150",
                isDragging ? "w-4 h-1.5 opacity-50" : "w-6 h-2 opacity-100"
              )} />
            </div>

            {/* Instructional overlay */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(100%+4rem)] pointer-events-none z-10">
              <div className={cn(
                "bg-foreground/90 text-background px-4 py-2 rounded-full shadow-lg transition-opacity duration-200",
                isDragging || showPredictions ? "opacity-0" : "opacity-100"
              )}>
                <p className="text-sm font-medium whitespace-nowrap">Arraste o mapa para marcar o local do veículo</p>
              </div>
            </div>

            {/* Top safe area - Back button + Search */}
            <div className="absolute top-0 left-0 right-0 z-20 pt-[env(safe-area-inset-top)] px-4">
              <div className="flex items-center gap-3 pt-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCancel}
                  className="h-12 w-12 rounded-full bg-card shadow-lg hover:bg-card/90 flex-shrink-0"
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>
                
                {/* Search input */}
                <div className="flex-1 relative">
                  <div className="flex items-center gap-3 px-4 py-3 bg-card rounded-xl shadow-lg">
                    <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchValue}
                      onChange={(e) => {
                        setSearchValue(e.target.value);
                        setShowPredictions(true);
                      }}
                      onFocus={() => setShowPredictions(true)}
                      placeholder="Buscar endereço ou ponto de referência"
                      className="flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder:text-muted-foreground"
                      autoComplete="off"
                    />
                  </div>
                  
                  {/* Predictions dropdown */}
                  {showPredictions && predictions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                      {predictions.map((prediction) => (
                        <button
                          key={prediction.place_id}
                          onClick={() => handleSelectPrediction(prediction)}
                          className="w-full flex items-start gap-3 p-3 hover:bg-secondary transition-colors text-left border-b border-border last:border-b-0"
                        >
                          <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {prediction.structured_formatting.main_text}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {prediction.structured_formatting.secondary_text}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right side controls */}
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
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Local do veículo</p>
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
                  Confirmar local do veículo
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return createPortal(overlayContent, document.body);
}

export { OriginMapPicker as default };
