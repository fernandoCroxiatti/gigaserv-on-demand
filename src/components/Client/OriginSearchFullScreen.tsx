import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MapPin, Loader2, Search, X } from 'lucide-react';
import { useGoogleMaps } from '../Map/GoogleMapsProvider';
import { Location } from '@/types/chamado';

interface OriginSearchFullScreenProps {
  open: boolean;
  onClose: () => void;
  onSelect: (location: Location) => void;
  initialValue?: string;
}

/**
 * Full-screen search overlay for origin address selection
 * 
 * FEATURES:
 * - 100% viewport coverage
 * - Fixed header with back button and auto-focused input
 * - Scrollable autocomplete list
 * - Works with virtual keyboard
 * - High z-index for proper layering
 */
export function OriginSearchFullScreen({
  open,
  onClose,
  onSelect,
  initialValue = '',
}: OriginSearchFullScreenProps) {
  const { isLoaded } = useGoogleMaps();
  const [value, setValue] = useState(initialValue);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const latestRequestId = useRef(0);

  // Initialize Google Places services
  useEffect(() => {
    if (isLoaded && !autocompleteService.current) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      const dummyDiv = document.createElement('div');
      placesService.current = new google.maps.places.PlacesService(dummyDiv);
    }
  }, [isLoaded]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setPredictions([]);
      // Auto-focus with slight delay for animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open, initialValue]);

  // Handle keyboard visibility (visualViewport API)
  useEffect(() => {
    if (!open) return;

    const handleResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const offset = windowHeight - viewportHeight;
        setKeyboardOffset(offset > 0 ? offset : 0);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      handleResize();
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, [open]);

  // Fetch predictions
  const fetchPredictions = useCallback((inputValue: string) => {
    if (!inputValue.trim() || !autocompleteService.current) {
      latestRequestId.current += 1;
      setPredictions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const requestId = ++latestRequestId.current;

    autocompleteService.current.getPlacePredictions(
      {
        input: inputValue,
        componentRestrictions: { country: 'br' },
      },
      (preds, status) => {
        if (requestId !== latestRequestId.current) return;

        if (status === google.maps.places.PlacesServiceStatus.OK) {
          setPredictions(preds || []);
        } else {
          setPredictions([]);
        }
        setLoading(false);
      }
    );
  }, []);

  // Debounced input change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPredictions(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value, fetchPredictions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService.current) return;

    setLoading(true);
    placesService.current.getDetails(
      { placeId: prediction.place_id, fields: ['geometry', 'formatted_address', 'place_id'] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const location: Location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            address: place.formatted_address || prediction.description,
            placeId: prediction.place_id,
          };
          onSelect(location);
          onClose();
        }
        setLoading(false);
      }
    );
  };

  const handleClear = () => {
    setValue('');
    setPredictions([]);
    inputRef.current?.focus();
  };

  const handleBack = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] bg-background flex flex-col"
          style={{ height: `calc(100vh - ${keyboardOffset}px)` }}
        >
          {/* Fixed Header */}
          <div className="flex-shrink-0 bg-background border-b border-border safe-area-inset-top">
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Back button */}
              <button
                onClick={handleBack}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>

              {/* Search input */}
              <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-secondary rounded-xl">
                <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={handleInputChange}
                  placeholder="Digite o endereço de origem"
                  className="flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder:text-muted-foreground"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />}
                {value && !loading && (
                  <button 
                    onClick={handleClear} 
                    className="p-1 hover:bg-background rounded-full flex-shrink-0"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto">
            {/* Empty state */}
            {!value.trim() && predictions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <MapPin className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Digite o endereço onde o veículo está localizado
                </p>
              </div>
            )}

            {/* No results */}
            {value.trim() && !loading && predictions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <p className="text-muted-foreground text-sm">
                  Nenhum endereço encontrado
                </p>
              </div>
            )}

            {/* Predictions list */}
            {predictions.length > 0 && (
              <div className="divide-y divide-border">
                {predictions.map((prediction) => (
                  <button
                    key={prediction.place_id}
                    onClick={() => handleSelect(prediction)}
                    className="w-full flex items-start gap-4 p-4 hover:bg-secondary transition-colors text-left active:bg-secondary/80"
                  >
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {prediction.structured_formatting.main_text}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {prediction.structured_formatting.secondary_text}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
