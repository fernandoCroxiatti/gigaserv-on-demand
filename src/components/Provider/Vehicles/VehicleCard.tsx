import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Star, Pencil, Trash2, Check } from 'lucide-react';
import type { ProviderVehicle } from '@/hooks/useProviderVehicles';

interface VehicleCardProps {
  vehicle: ProviderVehicle;
  canDelete: boolean;
  onEdit: () => void;
  onSetPrimary: () => void;
  onRemove: () => void;
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  guincho_plataforma: 'Guincho Plataforma',
  guincho_asa_delta: 'Guincho Asa Delta',
  caminhao: 'Caminhão',
  utilitario: 'Utilitário',
  moto: 'Moto',
  carro: 'Carro',
};

function formatPlateDisplay(plate: string): string {
  const clean = plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
}

export function VehicleCard({ vehicle, canDelete, onEdit, onSetPrimary, onRemove }: VehicleCardProps) {
  return (
    <div className={`p-4 rounded-2xl border-2 transition-all ${
      vehicle.is_primary 
        ? 'border-provider-primary bg-provider-primary/5' 
        : 'border-border bg-card'
    }`}>
      <div className="flex items-start justify-between gap-3">
        {/* Vehicle Info */}
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            vehicle.is_primary ? 'bg-provider-primary/20' : 'bg-secondary'
          }`}>
            <Car className={`w-6 h-6 ${vehicle.is_primary ? 'text-provider-primary' : 'text-muted-foreground'}`} />
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-wider">
                {formatPlateDisplay(vehicle.plate)}
              </span>
              {vehicle.is_primary && (
                <Badge variant="secondary" className="bg-provider-primary/20 text-provider-primary text-xs">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  Principal
                </Badge>
              )}
            </div>
            {vehicle.vehicle_type && (
              <p className="text-sm text-muted-foreground">
                {VEHICLE_TYPE_LABELS[vehicle.vehicle_type] || vehicle.vehicle_type}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="flex-1 h-9"
        >
          <Pencil className="w-4 h-4 mr-1.5" />
          Editar
        </Button>
        
        {!vehicle.is_primary && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSetPrimary}
            className="flex-1 h-9 text-provider-primary hover:text-provider-primary hover:bg-provider-primary/10"
          >
            <Check className="w-4 h-4 mr-1.5" />
            Definir principal
          </Button>
        )}
        
        {canDelete && !vehicle.is_primary && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
