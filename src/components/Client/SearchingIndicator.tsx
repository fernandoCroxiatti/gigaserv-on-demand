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
          icon: <MapPin className="w-4 h-4 text-muted-foreground" />,
          title: 'Aguardando',
          subtitle: 'Configure sua solicitação',
          color: 'bg-card/95',
        };
      
      case 'searching':
      case 'expanding_radius':
        return {
          icon: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
          title: `Buscando em ${currentRadius}km`,
          subtitle: `Raio ${radiusIndex + 1} de ${totalRadii}`,
          color: 'bg-card/95',
        };
      
      case 'provider_found':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-primary" />,
          title: `${providersCount} prestador${providersCount > 1 ? 'es' : ''} encontrado${providersCount > 1 ? 's' : ''}`,
          subtitle: `Em ${currentRadius}km`,
          color: 'bg-card/95',
        };
      
      case 'timeout':
        return {
          icon: <AlertCircle className="w-4 h-4 text-destructive" />,
          title: 'Nenhum disponível',
          subtitle: 'Tente novamente',
          color: 'bg-card/95',
        };
      
      case 'canceled':
        return {
          icon: <AlertCircle className="w-4 h-4 text-muted-foreground" />,
          title: 'Busca cancelada',
          subtitle: 'Inicie nova busca',
          color: 'bg-card/95',
        };
      
      default:
        return {
          icon: <Signal className="w-4 h-4 text-muted-foreground" />,
          title: 'Status desconhecido',
          subtitle: '',
          color: 'bg-card/95',
        };
    }
  };

  const content = getStateContent();
  const isSearching = state === 'searching' || state === 'expanding_radius';

  return (
    <div className={`rounded-xl p-2.5 flex items-center gap-2.5 ${content.color} backdrop-blur-md shadow-card transition-all duration-300`}>
      <div className="relative">
        <div className="w-8 h-8 bg-background rounded-full flex items-center justify-center shadow-sm">
          {content.icon}
        </div>
        {isSearching && (
          <div className="absolute inset-0 rounded-full border border-primary animate-ping opacity-30" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{content.title}</p>
        <p className="text-[10px] text-muted-foreground truncate">{content.subtitle}</p>
      </div>

      {/* Progress indicator for expanding radius */}
      {isSearching && (
        <div className="flex gap-0.5">
          {Array.from({ length: totalRadii }).map((_, i) => (
            <div
              key={i}
              className={`w-1 h-1 rounded-full transition-colors ${
                i <= radiusIndex ? 'bg-primary' : 'bg-primary/30'
              }`}
            />
          ))}
        </div>
      )}

      {/* Provider count badge */}
      {state === 'provider_found' && providersCount > 0 && (
        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
          <span className="text-[10px] font-bold text-primary-foreground">{providersCount}</span>
        </div>
      )}
    </div>
  );
}
