import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

const libraries: ("places" | "geometry" | "drawing")[] = ['places', 'geometry'];

interface GoogleMapsContextType {
  isLoaded: boolean;
  loadError: Error | undefined;
  apiKeyMissing: boolean;
  requestLoad: () => void;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({
  isLoaded: false,
  loadError: undefined,
  apiKeyMissing: true,
  requestLoad: () => {},
});

// Lazy loader component - only loads Google Maps when requested
function GoogleMapsLoader({ children, onLoad }: { children: ReactNode; onLoad: (isLoaded: boolean, error?: Error) => void }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries,
  });

  useEffect(() => {
    onLoad(isLoaded, loadError);
  }, [isLoaded, loadError, onLoad]);

  return <>{children}</>;
}

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const apiKeyMissing = !apiKey;
  
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | undefined>(undefined);

  // Debug log (temporary)
  useEffect(() => {
    console.log("Google Maps API Key carregada:", !apiKeyMissing);
    if (apiKeyMissing) {
      console.warn(
        "⚠️ VITE_GOOGLE_MAPS_API_KEY não encontrada no .env\n" +
        "Adicione ao arquivo .env:\n" +
        'VITE_GOOGLE_MAPS_API_KEY="sua_chave_aqui"'
      );
    }
  }, [apiKeyMissing]);

  const requestLoad = useCallback(() => {
    if (!apiKeyMissing && !shouldLoad) {
      setShouldLoad(true);
    }
  }, [apiKeyMissing, shouldLoad]);

  const handleLoad = useCallback((loaded: boolean, error?: Error) => {
    setIsLoaded(loaded);
    setLoadError(error);
  }, []);

  const contextValue = {
    isLoaded: apiKeyMissing ? false : isLoaded,
    loadError: apiKeyMissing ? new Error('API Key não configurada') : loadError,
    apiKeyMissing,
    requestLoad,
  };

  // Only render the loader when maps are requested
  if (shouldLoad && !apiKeyMissing) {
    return (
      <GoogleMapsContext.Provider value={contextValue}>
        <GoogleMapsLoader onLoad={handleLoad}>
          {children}
        </GoogleMapsLoader>
      </GoogleMapsContext.Provider>
    );
  }

  return (
    <GoogleMapsContext.Provider value={contextValue}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  const context = useContext(GoogleMapsContext);
  
  // Auto-request load when hook is used
  useEffect(() => {
    context.requestLoad();
  }, [context]);
  
  return context;
}
