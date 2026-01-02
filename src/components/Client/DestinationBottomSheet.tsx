import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, Clock, Loader2, Search, ArrowLeft } from 'lucide-react';
import { Location } from '@/types/chamado';
import { AddressHistoryItem } from '@/hooks/useAddressHistory';
import { useGoogleMaps } from '../Map/GoogleMapsProvider';

interface DestinationBottomSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (location: Location) => void;
  recentAddresses: AddressHistoryItem[];
  initialValue?: string;
}

/**
 * Bottom Sheet profissional padrão Uber/99 para seleção de destino
 * - Abre da parte inferior da tela
 * - Sobe automaticamente acima do teclado virtual
 * - Autocomplete e histórico sempre visíveis
 * - Mapa visível ao fundo com overlay escurecido
 */
export function DestinationBottomSheet({
  open,
  onClose,
  onSelect,
  recentAddresses,
  initialValue = '',
}: DestinationBottomSheetProps) {
  const { isLoaded } = useGoogleMaps();
  const [value, setValue] = useState(initialValue);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const latestRequestId = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Initialize Google services
  useEffect(() => {
    if (isLoaded && !autocompleteService.current) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      const dummyDiv = document.createElement('div');
      placesService.current = new google.maps.places.PlacesService(dummyDiv);
    }
  }, [isLoaded]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setValue(initialValue);
      // Small delay to allow animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    } else {
      setPredictions([]);
    }
  }, [open, initialValue]);

  // Keyboard height detection via visualViewport API
  useEffect(() => {
    if (!open) return;

    const handleViewportResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const estimatedKeyboardHeight = windowHeight - viewportHeight;
        setKeyboardHeight(Math.max(0, estimatedKeyboardHeight));
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      handleViewportResize();
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
    };
  }, [open]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setValue(inputValue);

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

  const handleSelectPrediction = async (prediction: google.maps.places.AutocompletePrediction) => {
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

  const handleSelectRecent = (item: AddressHistoryItem) => {
    const location: Location = {
      lat: item.lat,
      lng: item.lng,
      address: item.address,
      placeId: item.placeId,
    };
    onSelect(location);
    onClose();
  };

  const handleClear = () => {
    setValue('');
    setPredictions([]);
    inputRef.current?.focus();
  };

  const showRecent = !value.trim() && recentAddresses.length > 0;
  const showPredictions = predictions.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay - dims the map */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            style={{ paddingBottom: keyboardHeight }}
            className="fixed left-0 right-0 bottom-0 z-50 bg-card rounded-t-3xl shadow-2xl flex flex-col"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header with back button */}
            <div className="flex items-center gap-3 px-4 pb-3">
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <h2 className="text-lg font-semibold flex-1">Para onde?</h2>
            </div>

            {/* Search input */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-3 p-3.5 bg-secondary rounded-xl ring-1 ring-border/50">
                <Search className="w-5 h-5 text-primary flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={handleInputChange}
                  placeholder="Oficina, casa ou outro destino"
                  className="flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder:text-muted-foreground"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {value && !loading && (
                  <button onClick={handleClear} className="p-1 hover:bg-background rounded-full">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Content area - scrollable */}
            <div 
              className="flex-1 overflow-y-auto px-4 pb-6"
              style={{ maxHeight: `calc(60vh - ${keyboardHeight}px)` }}
            >
              {/* Recent addresses */}
              {showRecent && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
                    Endereços recentes
                  </p>
                  <div className="bg-secondary/50 rounded-xl overflow-hidden">
                    {recentAddresses.map((item, index) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelectRecent(item)}
                        className={`w-full flex items-start gap-3 p-3.5 hover:bg-secondary transition-colors text-left ${
                          index !== recentAddresses.length - 1 ? 'border-b border-border/50' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-sm font-medium leading-tight line-clamp-2">{item.address}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Predictions */}
              {showPredictions && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
                    Sugestões
                  </p>
                  <div className="bg-secondary/50 rounded-xl overflow-hidden">
                    {predictions.map((prediction, index) => (
                      <button
                        key={prediction.place_id}
                        onClick={() => handleSelectPrediction(prediction)}
                        className={`w-full flex items-start gap-3 p-3.5 hover:bg-secondary transition-colors text-left ${
                          index !== predictions.length - 1 ? 'border-b border-border/50' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm font-medium leading-tight">
                            {prediction.structured_formatting.main_text}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {prediction.structured_formatting.secondary_text}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state when typing but no results */}
              {value.trim() && !showPredictions && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum endereço encontrado</p>
                  <p className="text-xs mt-1">Tente digitar de outra forma</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
