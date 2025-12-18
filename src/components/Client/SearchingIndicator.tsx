import React from 'react';
import { Loader2, MapPin, Signal, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SearchState } from '@/hooks/useProgressiveSearch';

interface SearchingIndicatorProps {
  state: SearchState;
  currentRadius: number;
  providersCount: number;
  radiusIndex: number;
  totalRadii: number;
}

export function SearchingIndicator({
  state,
  currentRadius,
  providersCount,
  radiusIndex,
  totalRadii,
}: SearchingIndicatorProps) {
  const getStateContent = () => {
    switch (state) {
      case 'idle':
        return {
          icon: <MapPin className="w-5 h-5 text-muted-foreground" />,
          title: 'Aguardando',
          subtitle: 'Configure sua solicitação',
          color: 'bg-secondary',
        };
      
      case 'searching':
      case 'expanding_radius':
        return {
          icon: <Loader2 className="w-5 h-5 text-primary animate-spin" />,
          title: `Buscando em ${currentRadius}km...`,
          subtitle: `Raio ${radiusIndex + 1} de ${totalRadii}`,
          color: 'bg-primary/10',
        };
      
      case 'provider_found':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-primary" />,
          title: `${providersCount} prestador${providersCount > 1 ? 'es' : ''} encontrado${providersCount > 1 ? 's' : ''}`,
          subtitle: `Dentro de ${currentRadius}km`,
          color: 'bg-primary/10',
        };
      
      case 'timeout':
        return {
          icon: <AlertCircle className="w-5 h-5 text-destructive" />,
          title: 'Nenhum prestador disponível',
          subtitle: 'Tente novamente em alguns minutos',
          color: 'bg-destructive/10',
        };
      
      case 'canceled':
        return {
          icon: <AlertCircle className="w-5 h-5 text-muted-foreground" />,
          title: 'Busca cancelada',
          subtitle: 'Inicie uma nova busca',
          color: 'bg-secondary',
        };
      
      default:
        return {
          icon: <Signal className="w-5 h-5 text-muted-foreground" />,
          title: 'Status desconhecido',
          subtitle: '',
          color: 'bg-secondary',
        };
    }
  };

  const content = getStateContent();
  const isSearching = state === 'searching' || state === 'expanding_radius';

  return (
    <div className={`rounded-2xl p-3 flex items-center gap-3 ${content.color} transition-all duration-300`}>
      <div className="relative">
        <div className="w-10 h-10 bg-card rounded-full flex items-center justify-center shadow-sm">
          {content.icon}
        </div>
        {isSearching && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30" />
            <div className="absolute inset-0 rounded-full border border-primary/50 animate-pulse" />
          </>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{content.title}</p>
        <p className="text-xs text-muted-foreground truncate">{content.subtitle}</p>
      </div>

      {/* Progress indicator for expanding radius */}
      {isSearching && (
        <div className="flex gap-1">
          {Array.from({ length: totalRadii }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i <= radiusIndex ? 'bg-primary' : 'bg-primary/30'
              }`}
            />
          ))}
        </div>
      )}

      {/* Provider count badge */}
      {state === 'provider_found' && providersCount > 0 && (
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <span className="text-sm font-bold text-primary-foreground">{providersCount}</span>
        </div>
      )}
    </div>
  );
}
