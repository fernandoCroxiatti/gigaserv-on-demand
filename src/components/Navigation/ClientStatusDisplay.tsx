import React from 'react';
import { 
  Car, 
  MapPin, 
  Navigation, 
  Check,
  Truck,
  ArrowRight,
  Clock,
  Route,
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

// Map status to icon, color and descriptive label
const statusConfig: Record<NavigationState['clientStatus'], { 
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  pulseColor: string;
  label: string;
}> = {
  a_caminho: {
    icon: Car,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    pulseColor: 'bg-primary',
    label: 'Em deslocamento',
  },
  chegando: {
    icon: Navigation,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    pulseColor: 'bg-amber-500',
    label: 'Chegando',
  },
  no_local: {
    icon: Check,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    pulseColor: 'bg-green-500',
    label: 'No local',
  },
  em_transito: {
    icon: Truck,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    pulseColor: 'bg-blue-500',
    label: 'Em transporte',
  },
  destino_final: {
    icon: MapPin,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    pulseColor: 'bg-green-500',
    label: 'Destino final',
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
      {/* Main status - Uber style with clear status label */}
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
            <div className="flex items-center gap-1.5">
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", config.bgColor, config.color)}>
                {config.label}
              </span>
              <p className="text-xs text-muted-foreground truncate">{providerName}</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* ETA and distance info - Clearer layout with icons */}
        <div className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <div>
              <span className="font-bold text-primary text-base">
                {eta && eta !== '' ? eta : '< 1 min'}
              </span>
              <p className="text-[10px] text-muted-foreground leading-tight">restantes</p>
            </div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-muted-foreground" />
            <div>
              <span className="font-semibold text-base">
                {distance && distance !== '' ? distance : '< 100 m'}
              </span>
              <p className="text-[10px] text-muted-foreground leading-tight">distância</p>
            </div>
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
