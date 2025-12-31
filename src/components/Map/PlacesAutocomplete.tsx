import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Location } from '@/types/chamado';
import { MapPin, Loader2, X, Clock } from 'lucide-react';
import { AddressHistoryItem } from '@/hooks/useAddressHistory';

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: Location) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  recentAddresses?: AddressHistoryItem[];
  showRecentOnFocus?: boolean;
}

/**
 * PlacesAutocomplete with dynamic dropdown positioning
 * 
 * LAYOUT FEATURES:
 * - Dropdown appears ABOVE input field (bottom-full)
 * - Max height is calculated dynamically based on available space
 * - Considers: header height (~64px), safe-area, and visual padding
 * - Internal scroll when list exceeds available space
 * - Works properly with virtual keyboard on mobile
 */
export function PlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Digite um endereço',
  icon,
  className = '',
  recentAddresses = [],
  showRecentOnFocus = false,
}: PlacesAutocompleteProps) {
  const { isLoaded } = useGoogleMaps();
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState<number>(240);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const latestRequestId = useRef(0);

  // Calculate available space for dropdown (above input)
  const calculateDropdownHeight = useCallback(() => {
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Space above the input: top of container minus header (~64px) and safe-area padding
    const headerHeight = 64; // Approximate header height
    const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10) || 0;
    const padding = 16; // Visual padding from top
    
    // Available space = distance from top of container to top of viewport, minus header and padding
    const availableSpace = containerRect.top - headerHeight - safeAreaTop - padding;
    
    // Clamp between minimum (120px) and maximum (400px for very tall screens)
    const calculatedHeight = Math.max(120, Math.min(availableSpace, 400));
    
    setDropdownMaxHeight(calculatedHeight);
  }, []);

  // Recalculate on open and on resize
  useEffect(() => {
    if (isOpen || showRecent) {
      calculateDropdownHeight();
      
      // Also listen for resize (e.g., keyboard appearing/disappearing)
      window.addEventListener('resize', calculateDropdownHeight);
      
      // Recalculate after a short delay to catch keyboard animations
      const timeoutId = setTimeout(calculateDropdownHeight, 300);
      
      return () => {
        window.removeEventListener('resize', calculateDropdownHeight);
        clearTimeout(timeoutId);
      };
    }
  }, [isOpen, showRecent, calculateDropdownHeight]);

  useEffect(() => {
    if (isLoaded && !autocompleteService.current) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      // Create a dummy div for PlacesService
      const dummyDiv = document.createElement('div');
      placesService.current = new google.maps.places.PlacesService(dummyDiv);
    }
  }, [isLoaded]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowRecent(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    onChange(inputValue);
    setShowRecent(false);

    if (!inputValue.trim() || !autocompleteService.current) {
      latestRequestId.current += 1; // invalidate pending callbacks
      setPredictions([]);
      setIsOpen(false);
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
        // Ignore out-of-order responses
        if (requestId !== latestRequestId.current) return;

        if (status === google.maps.places.PlacesServiceStatus.OK) {
          setPredictions(preds || []);
          setIsOpen(true);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          setPredictions([]);
          setIsOpen(false);
        } else {
          console.error('Autocomplete status:', status);
          setPredictions([]);
          setIsOpen(false);
        }

        setLoading(false);
      }
    );
  };

  const handleFocus = () => {
    if (predictions.length > 0) {
      setIsOpen(true);
    } else if (showRecentOnFocus && recentAddresses.length > 0 && !value.trim()) {
      setShowRecent(true);
    }
  };

  const handleSelect = async (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService.current) return;

    setLoading(true);
    try {
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
            onChange(location.address);
            onSelect(location);
            setPredictions([]);
          }
          setIsOpen(false);
          setShowRecent(false);
          setLoading(false);
        }
      );
    } catch (error) {
      console.error('Place details error:', error);
      setLoading(false);
    }
  };

  const handleSelectRecent = (item: AddressHistoryItem) => {
    const location: Location = {
      lat: item.lat,
      lng: item.lng,
      address: item.address,
      placeId: item.placeId,
    };
    onChange(location.address);
    onSelect(location);
    setShowRecent(false);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setPredictions([]);
    setShowRecent(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl">
        {icon || <MapPin className="w-5 h-5 text-muted-foreground" />}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        {value && !loading && (
          <button onClick={handleClear} className="p-1 hover:bg-background rounded-full">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Recent addresses dropdown - positioned above input with dynamic height */}
      {showRecent && recentAddresses.length > 0 && (
        <div 
          className="absolute bottom-full left-0 right-0 mb-2 bg-card rounded-xl shadow-uber-lg border border-border z-[100] overflow-hidden"
          style={{ maxHeight: dropdownMaxHeight }}
        >
          <div className="px-3 py-2 border-b border-border bg-card sticky top-0 z-10">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Endereços recentes</p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: dropdownMaxHeight - 40 }}>
            {recentAddresses.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectRecent(item)}
                className="w-full flex items-start gap-3 p-3 hover:bg-secondary transition-colors text-left border-b border-border last:border-0"
              >
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.address}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Google Places predictions - positioned above input with dynamic height */}
      {isOpen && predictions.length > 0 && (
        <div 
          className="absolute bottom-full left-0 right-0 mb-2 bg-card rounded-xl shadow-uber-lg border border-border z-[100] overflow-hidden"
          style={{ maxHeight: dropdownMaxHeight }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: dropdownMaxHeight }}>
            {predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                onClick={() => handleSelect(prediction)}
                className="w-full flex items-start gap-3 p-3 hover:bg-secondary transition-colors text-left border-b border-border last:border-0"
              >
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {prediction.structured_formatting.main_text}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {prediction.structured_formatting.secondary_text}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
