import React from 'react';
import { Provider, Location } from '@/types/chamado';
import { useApp } from '@/contexts/AppContext';
import { MapPin, Navigation } from 'lucide-react';

interface MapViewProps {
  showProviders?: boolean;
  origem?: Location;
  destino?: Location | null;
  showRoute?: boolean;
  className?: string;
}

export function MapView({ 
  showProviders = false, 
  origem, 
  destino, 
  showRoute = false,
  className = '' 
}: MapViewProps) {
  const { availableProviders, user } = useApp();
  const isProvider = user.activeProfile === 'provider';
  
  // Only show route if both origem and destino exist
  const canShowRoute = showRoute && origem && destino;

  return (
    <div className={`relative w-full h-full bg-gradient-to-b from-blue-100 to-blue-50 overflow-hidden ${className}`}>
      {/* Map grid pattern */}
      <div className="absolute inset-0 opacity-30">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Simulated roads */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-0 right-0 h-8 bg-white/60 transform -translate-y-1/2" />
        <div className="absolute top-0 bottom-0 left-1/2 w-8 bg-white/60 transform -translate-x-1/2" />
        <div className="absolute top-1/4 left-0 right-0 h-4 bg-white/40" />
        <div className="absolute top-3/4 left-0 right-0 h-4 bg-white/40" />
      </div>

      {/* Route line - only if destination exists */}
      {canShowRoute && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isProvider ? '#2563EB' : '#1DB954'} />
              <stop offset="100%" stopColor={isProvider ? '#1d4ed8' : '#16a34a'} />
            </linearGradient>
          </defs>
          <path
            d="M 30% 70% Q 50% 30% 70% 35%"
            stroke="url(#routeGradient)"
            strokeWidth="4"
            strokeDasharray="8 4"
            fill="none"
            className="animate-pulse"
          />
        </svg>
      )}

      {/* Provider markers */}
      {showProviders && availableProviders.filter(p => p.online).map((provider, index) => (
        <div
          key={provider.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000"
          style={{
            left: `${30 + index * 20 + Math.sin(Date.now() / 1000 + index) * 2}%`,
            top: `${40 + index * 10 + Math.cos(Date.now() / 1000 + index) * 2}%`,
          }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-provider-primary/30 rounded-full animate-ping" />
            <div className="relative w-10 h-10 bg-provider-primary rounded-full flex items-center justify-center shadow-uber border-2 border-white">
              <Navigation className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      ))}

      {/* Origin marker */}
      {origem && (
        <div 
          className="absolute transform -translate-x-1/2 -translate-y-full"
          style={{ left: '30%', top: '70%' }}
        >
          <div className="relative animate-bounce-soft">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-uber ${
              isProvider ? 'bg-provider-primary' : 'bg-primary'
            }`}>
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full ${
              isProvider ? 'bg-provider-primary' : 'bg-primary'
            }`} />
          </div>
        </div>
      )}

      {/* Destination marker - only if destination exists */}
      {destino && (
        <div 
          className="absolute transform -translate-x-1/2 -translate-y-full"
          style={{ left: '70%', top: '35%' }}
        >
          <div className="relative">
            <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center shadow-uber">
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-foreground rounded-full" />
          </div>
        </div>
      )}

      {/* User location (center) */}
      <div 
        className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
      >
        <div className="relative">
          <div className={`absolute inset-0 rounded-full animate-ping opacity-50 ${
            isProvider ? 'bg-provider-primary' : 'bg-primary'
          }`} style={{ animationDuration: '2s' }} />
          <div className={`relative w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-4 border-white ${
            isProvider ? 'bg-provider-primary' : 'bg-primary'
          }`}>
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        </div>
      </div>

      {/* Map attribution */}
      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground/50 bg-white/50 px-2 py-1 rounded">
        GIGA S.O.S Map
      </div>
    </div>
  );
}
