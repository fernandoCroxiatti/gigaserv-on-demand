import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

const libraries: ("places" | "geometry" | "drawing")[] = ['places', 'geometry'];

interface GoogleMapsContextType {
  isLoaded: boolean;
  loadError: Error | undefined;
  apiKeyMissing: boolean;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({
  isLoaded: false,
  loadError: undefined,
  apiKeyMissing: true,
});

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const apiKeyMissing = !apiKey;

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

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries,
    // Only attempt to load if we have an API key
    preventGoogleFontsLoading: apiKeyMissing,
  });

  return (
    <GoogleMapsContext.Provider value={{ 
      isLoaded: apiKeyMissing ? false : isLoaded, 
      loadError: apiKeyMissing ? new Error('API Key não configurada') : loadError,
      apiKeyMissing 
    }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}
