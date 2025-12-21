import React from 'react';
import { 
  Car, 
  MapPin, 
  Navigation, 
  Check,
  Truck,
  ArrowRight,
} from 'lucide-react';
import { NavigationState, getClientStatusText } from '@/hooks/useNavigationInstructions';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface ClientStatusDisplayProps {
  status: NavigationState['clientStatus'];
  eta: string;
  distance: string;
  progress: number;
  phase: string; // Supports both old and new phase naming
  serviceType: string;
  providerName?: string;
  className?: string;
}

// Map status to icon and color
const statusConfig: Record<NavigationState['clientStatus'], { 
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  pulseColor: string;
}> = {
  a_caminho: {
    icon: Car,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    pulseColor: 'bg-primary',
  },
  chegando: {
    icon: Navigation,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    pulseColor: 'bg-amber-500',
  },
  no_local: {
    icon: Check,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    pulseColor: 'bg-green-500',
  },
  em_transito: {
    icon: Truck,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    pulseColor: 'bg-blue-500',
  },
  destino_final: {
    icon: MapPin,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    pulseColor: 'bg-green-500',
  },
};

export function ClientStatusDisplay({
  status,
  eta,
  distance,
  progress,
  phase,
  serviceType,
  providerName = 'Prestador',
  className,
}: ClientStatusDisplayProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const statusText = getClientStatusText(status, phase, serviceType);

  return (
    <div className={cn("bg-card/95 backdrop-blur-md rounded-xl shadow-card overflow-hidden", className)}>
      {/* Main status - Uber style */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          {/* Animated status icon */}
          <div className={cn("relative w-12 h-12 rounded-full flex items-center justify-center", config.bgColor)}>
            <StatusIcon className={cn("w-6 h-6", config.color)} />
            {/* Pulse animation for active states */}
            {(status === 'a_caminho' || status === 'em_transito') && (
              <span className={cn(
                "absolute inset-0 rounded-full animate-ping opacity-20",
                config.pulseColor
              )} />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base">{statusText}</p>
            <p className="text-sm text-muted-foreground">{providerName}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* ETA and distance info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm">
            <span className="font-semibold text-primary">{eta || '--'}</span>
            <span className="text-muted-foreground">restantes</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>{distance || '--'}</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Phase indicator - for guincho showing both destinations */}
      {serviceType === 'guincho' && (
        <div className="px-4 py-2 bg-secondary/50 border-t border-border/30">
          <div className="flex items-center justify-between text-xs">
            <div className={cn(
              "flex items-center gap-1.5",
              (phase === 'going_to_vehicle' || phase === 'to_client') ? 'text-primary font-medium' : 'text-muted-foreground'
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                (phase === 'going_to_vehicle' || phase === 'to_client') ? 'bg-primary' : 'bg-muted'
              )} />
              <span>Busca</span>
            </div>
            <div className="flex-1 border-t border-dashed border-muted mx-2" />
            <div className={cn(
              "flex items-center gap-1.5",
              (phase === 'going_to_destination' || phase === 'to_destination') ? 'text-primary font-medium' : 'text-muted-foreground'
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                (phase === 'going_to_destination' || phase === 'to_destination') ? 'bg-primary' : 'bg-muted'
              )} />
              <span>Destino</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
