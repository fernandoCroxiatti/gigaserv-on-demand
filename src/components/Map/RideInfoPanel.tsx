import React from 'react';
import { Clock, MapPin, Navigation, DollarSign, User, Car, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RideInfoPanelProps {
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Distance traveled in km */
  distanceTraveled: number;
  /** Origin address */
  originAddress: string | null;
  /** Destination address */
  destinationAddress: string | null;
  /** Estimated/agreed price */
  estimatedPrice: number | null;
  /** Provider name (shown to client) */
  providerName?: string | null;
  /** Client name (shown to provider) */
  clientName?: string | null;
  /** Current mode */
  mode: 'provider' | 'client' | 'idle';
  /** Ride status */
  rideStatus: string | null;
  /** Last update timestamp */
  lastUpdate: Date | null;
  /** Callback for manual refresh */
  onRefresh?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format seconds into HH:MM:SS or MM:SS
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format price to BRL currency
 */
function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Get status label in Portuguese
 */
function getStatusLabel(status: string | null): string {
  const statusLabels: Record<string, string> = {
    accepted: 'Aceito',
    negotiating: 'Negociando',
    awaiting_payment: 'Aguardando Pagamento',
    in_service: 'Em Serviço',
    pending_client_confirmation: 'Aguardando Confirmação',
  };
  return statusLabels[status || ''] || status || '';
}

/**
 * Truncate address to fit in panel
 */
function truncateAddress(address: string | null, maxLength: number = 40): string {
  if (!address) return '-';
  if (address.length <= maxLength) return address;
  return address.substring(0, maxLength) + '...';
}

/**
 * Floating panel showing ride information during active service.
 * 
 * Displays:
 * - Elapsed time since ride started
 * - Distance traveled (calculated from GPS history)
 * - Origin and destination addresses
 * - Estimated/agreed price
 * - Provider/client name based on mode
 */
export function RideInfoPanel({
  elapsedTime,
  distanceTraveled,
  originAddress,
  destinationAddress,
  estimatedPrice,
  providerName,
  clientName,
  mode,
  rideStatus,
  lastUpdate,
  onRefresh,
  className,
}: RideInfoPanelProps) {
  return (
    <div
      className={cn(
        'absolute top-3 left-3 right-3 z-20',
        'bg-card/95 backdrop-blur-sm rounded-xl shadow-lg border border-border/50',
        'p-3 space-y-2',
        className
      )}
    >
      {/* Header with status and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">
            {getStatusLabel(rideStatus)}
          </span>
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Main stats row */}
      <div className="flex items-center justify-between gap-4">
        {/* Elapsed Time */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{formatTime(elapsedTime)}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tempo</p>
          </div>
        </div>

        {/* Distance Traveled */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
            <Navigation className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{distanceTraveled.toFixed(1)} km</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Distância</p>
          </div>
        </div>

        {/* Price */}
        {estimatedPrice && (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-500/10">
              <DollarSign className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{formatPrice(estimatedPrice)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor</p>
            </div>
          </div>
        )}
      </div>

      {/* Addresses */}
      <div className="space-y-1.5 pt-1 border-t border-border/30">
        {/* Origin */}
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500/20 mt-0.5">
            <MapPin className="w-3 h-3 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Origem</p>
            <p className="text-xs text-foreground truncate">{truncateAddress(originAddress)}</p>
          </div>
        </div>

        {/* Destination */}
        {destinationAddress && (
          <div className="flex items-start gap-2">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 mt-0.5">
              <MapPin className="w-3 h-3 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Destino</p>
              <p className="text-xs text-foreground truncate">{truncateAddress(destinationAddress)}</p>
            </div>
          </div>
        )}
      </div>

      {/* User info row */}
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        {mode === 'client' && providerName && (
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-foreground font-medium">{providerName}</span>
          </div>
        )}
        {mode === 'provider' && clientName && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-foreground font-medium">{clientName}</span>
          </div>
        )}
        
        {lastUpdate && (
          <p className="text-[10px] text-muted-foreground">
            Atualizado: {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}
