import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, Loader2, Truck } from 'lucide-react';

interface AddVehicleModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (plate: string, vehicleType?: string) => Promise<boolean>;
}

const VEHICLE_TYPES = [
  { value: 'guincho_plataforma', label: 'Guincho Plataforma' },
  { value: 'guincho_asa_delta', label: 'Guincho Asa Delta' },
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'utilitario', label: 'Utilitário' },
  { value: 'moto', label: 'Moto' },
  { value: 'carro', label: 'Carro' },
];

function formatPlate(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
}

export function AddVehicleModal({ open, onClose, onSave }: AddVehicleModalProps) {
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    
    const cleanPlate = plate.replace(/[^A-Z0-9]/g, '');
    if (cleanPlate.length < 7) {
      setError('Placa inválida. Use o formato ABC-1D23');
      return;
    }

    setSaving(true);
    try {
      const success = await onSave(plate, vehicleType || undefined);
      if (success) {
        setPlate('');
        setVehicleType('');
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setPlate('');
    setVehicleType('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="provider-theme max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Adicionar Veículo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Vehicle Plate */}
          <div className="space-y-2">
            <Label htmlFor="new-plate">
              Placa do veículo <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="new-plate"
                value={plate}
                onChange={(e) => setPlate(formatPlate(e.target.value))}
                placeholder="ABC-1D23"
                className="pl-10 h-12 rounded-xl uppercase"
                maxLength={8}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Vehicle Type (optional) */}
          <div className="space-y-2">
            <Label>Tipo de veículo (opcional)</Label>
            <div className="grid grid-cols-2 gap-2">
              {VEHICLE_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setVehicleType(vehicleType === type.value ? '' : type.value)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    vehicleType === type.value
                      ? 'border-provider-primary bg-provider-primary/10'
                      : 'border-border bg-secondary hover:border-provider-primary/50'
                  }`}
                >
                  <Truck className={`w-4 h-4 ${vehicleType === type.value ? 'text-provider-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${vehicleType === type.value ? 'text-provider-primary' : ''}`}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || plate.replace(/[^A-Z0-9]/g, '').length < 7}
              className="flex-1 bg-provider-primary hover:bg-provider-primary/90"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar veículo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
