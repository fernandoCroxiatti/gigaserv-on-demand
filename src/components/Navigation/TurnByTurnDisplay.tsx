import React from 'react';
import { 
  ArrowUp, 
  CornerUpLeft, 
  CornerUpRight, 
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  RotateCw,
  RefreshCw,
  MapPin,
  Navigation,
  GitMerge,
} from 'lucide-react';
import { NavigationInstruction } from '@/hooks/useNavigationInstructions';
import { cn } from '@/lib/utils';

interface TurnByTurnDisplayProps {
  currentInstruction: NavigationInstruction | null;
  nextInstruction: NavigationInstruction | null;
  eta: string;
  distance: string;
  className?: string;
}

// Map icon type to Lucide component
const iconComponents: Record<NavigationInstruction['icon'], React.ComponentType<{ className?: string }>> = {
  straight: ArrowUp,
  turn_left: CornerUpLeft,
  turn_right: CornerUpRight,
  slight_left: ArrowUpLeft,
  slight_right: ArrowUpRight,
  sharp_left: CornerUpLeft,
  sharp_right: CornerUpRight,
  uturn_left: RotateCcw,
  uturn_right: RotateCw,
  merge: GitMerge,
  roundabout: RefreshCw,
  arrive: MapPin,
  depart: Navigation,
};

export function TurnByTurnDisplay({
  currentInstruction,
  nextInstruction,
  eta,
  distance,
  className,
}: TurnByTurnDisplayProps) {
  if (!currentInstruction) return null;

  const CurrentIcon = iconComponents[currentInstruction.icon] || ArrowUp;
  const NextIcon = nextInstruction ? iconComponents[nextInstruction.icon] || ArrowUp : null;

  return (
    <div className={cn("bg-card/95 backdrop-blur-md rounded-xl shadow-card overflow-hidden", className)}>
      {/* Main instruction - Google Maps style */}
      <div className="bg-primary text-primary-foreground p-3 flex items-center gap-3">
        <div className="w-14 h-14 flex items-center justify-center">
          <CurrentIcon className="w-10 h-10" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{currentInstruction.distance || 'Agora'}</span>
          </div>
          <p className="text-sm font-medium truncate opacity-90">
            {currentInstruction.streetName || currentInstruction.text}
          </p>
        </div>
      </div>

      {/* Next instruction preview - subtle */}
      {nextInstruction && NextIcon && (
        <div className="px-3 py-2 flex items-center gap-2 text-muted-foreground border-t border-border/30">
          <span className="text-xs">Depois</span>
          <NextIcon className="w-4 h-4" />
          <span className="text-xs truncate flex-1">{nextInstruction.distance} • {nextInstruction.streetName}</span>
        </div>
      )}

      {/* ETA bar */}
      <div className="px-3 py-2 flex items-center justify-between bg-secondary/50 border-t border-border/30">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <span className="text-lg font-bold text-primary">{eta || '--'}</span>
            <p className="text-[10px] text-muted-foreground">Chegada</p>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="text-center">
            <span className="text-lg font-bold">{distance || '--'}</span>
            <p className="text-[10px] text-muted-foreground">Distância</p>
          </div>
        </div>
      </div>
    </div>
  );
}
